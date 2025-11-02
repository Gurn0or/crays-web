import { bech32 } from "@scure/base";
import { nip04, nip47, nip57, Relay, relayInit, utils } from "../lib/nTools";
import { Kind } from "../constants";
import { NostrRelaySignedEvent, NostrUserZaps, PrimalArticle, PrimalDVM, PrimalNote, PrimalUser, PrimalZap } from "../types/primal";
import { logError } from "./logger";
import { decrypt, enableWebLn, sendPayment, signEvent } from "./nostrAPI";
import { decodeNWCUri } from "./wallet";
import { hexToBytes, parseBolt11 } from "../utils";
import { StreamingData } from "./streaming";
import { getBreezService } from "../lib/breez/breezService";

export let lastZapError: string = "";

// Breez SDK payment helper (no-op if Breez not available)
export const payWithBreez = async (invoice: string): Promise<boolean> => {
  try {
    const breez = await getBreezService();
    if (!breez || typeof (breez as any).payInvoice !== 'function') return false;
    const res = await (breez as any).payInvoice(invoice);
    if (res && (res.success === true || res.status === 'paid')) return true;
    return false;
  } catch (e) {
    console.error('Breez pay failed', e);
    lastZapError = String(e);
    return false;
  }
};

export const zapOverNWC = async (pubkey: string, nwcEnc: string, invoice: string) => {
  let promises: Promise<boolean>[] = [];
  let relays: Relay[] = [];
  let result: boolean = false;

  try {
    const nwc = await decrypt(pubkey, nwcEnc);
    const nwcConfig = decodeNWCUri(nwc);

    if (!nwcConfig) {
      lastZapError = "Failed to decode NWC URI";
      return false;
    }

    const { secret, walletPubkey, relayUrl } = nwcConfig;

    const relay = relayInit(relayUrl);
    await relay.connect();
    relays.push(relay);

    const reqId = utils.generateId();

    promises.push(
      new Promise<boolean>(async (res, rej) => {
        const timeout = setTimeout(() => {
          rej(new Error("NWC payment timeout"));
        }, 30000);

        const sub = relay.sub([
          {
            kinds: [23195],
            authors: [walletPubkey],
            "#e": [reqId],
          },
        ]);

        sub.on("event", async (event) => {
          clearTimeout(timeout);
          try {
            const decryptedContent = await nip04.decrypt(secret, walletPubkey, event.content);
            const response = JSON.parse(decryptedContent);
            if (response.result_type === "pay_invoice") {
              res(true);
            } else if (response.error) {
              lastZapError = response.error.message || "NWC payment failed";
              rej(new Error(lastZapError));
            } else {
              rej(new Error("Unknown NWC response"));
            }
          } catch (e) {
            lastZapError = String(e);
            rej(e);
          }
        });

        const content = JSON.stringify({
          method: "pay_invoice",
          params: {
            invoice,
          },
        });

        const encryptedContent = await nip04.encrypt(secret, walletPubkey, content);

        const payEvent = {
          kind: 23194,
          pubkey: hexToBytes(utils.getPublicKey(secret)),
          created_at: Math.floor(Date.now() / 1000),
          tags: [["p", walletPubkey]],
          content: encryptedContent,
          id: reqId,
        };

        const signedEvent = await signEvent(payEvent, secret);
        await relay.publish(signedEvent);
      })
    );

    result = await Promise.race(promises);
    return result;
  } catch (e) {
    lastZapError = String(e);
    logError("zapOverNWC", e);
    return false;
  } finally {
    relays.forEach((relay) => relay.close());
  }
};

export const zapNote = async (
  item: PrimalNote | PrimalArticle | PrimalUser | PrimalDVM,
  sender: string,
  amount: number,
  comment: string = "",
  nwcEnc?: string
): Promise<boolean> => {
  let user: PrimalUser | undefined;
  let eventId: string | undefined;

  if ('noteId' in item) {
    user = item.user;
    eventId = item.noteId;
  } else if ('naddr' in item) {
    user = item.user;
    eventId = item.noteId;
  } else if ('pubkey' in item) {
    user = item;
    eventId = undefined;
  } else if ('dvmPubkey' in item) {
    user = {
      pubkey: item.dvmPubkey,
      lud16: item.lud16,
      lud06: item.lud06,
    } as PrimalUser;
    eventId = undefined;
  }

  if (!user) {
    lastZapError = "No user info available";
    return false;
  }

  try {
    const callback = await getZapEndpoint(user);
    if (!callback) {
      lastZapError = "No zap endpoint found";
      return false;
    }

    const zapReq = nip57.makeZapRequest({
      profile: user.pubkey,
      event: eventId,
      amount: amount * 1000,
      comment,
      relays: ["wss://relay.primal.net"],
    });

    const signedZapReq = (await signEvent(zapReq)) as NostrRelaySignedEvent;
    const encodedZapReq = encodeURI(JSON.stringify(signedZapReq));

    const url = `${callback}?amount=${amount * 1000}&nostr=${encodedZapReq}`;
    const res = await fetch(url);

    if (!res.ok) {
      lastZapError = `Fetch failed: ${res.status} ${res.statusText}`;
      return false;
    }

    const body = await res.json();
    const invoice = body.pr;

    if (!invoice) {
      lastZapError = "No invoice returned";
      return false;
    }

    // Try Breez first
    const breezPaid = await payWithBreez(invoice);
    if (breezPaid) return true;

    // Then try NWC if available
    if (nwcEnc) {
      const nwcPaid = await zapOverNWC(sender, nwcEnc, invoice);
      if (nwcPaid) return true;
    }

    // Finally try WebLN
    const enabled = await enableWebLn();
    if (!enabled) {
      lastZapError = "No payment method available";
      return false;
    }

    const payment = await sendPayment(invoice);
    return !!payment?.preimage;
  } catch (e) {
    lastZapError = String(e);
    logError("zapNote", e);
    return false;
  }
};

export const getZapEndpoint = async (user: PrimalUser): Promise<string | null> => {
  try {
    let lnurl = "";
    let callback = "";

    if (user.lud16) {
      const [name, domain] = user.lud16.split("@");
      lnurl = `https://${domain}/.well-known/lnurlp/${name}`;
    } else if (user.lud06) {
      const { words } = bech32.decode(user.lud06, 1023);
      const data = bech32.fromWords(words);
      lnurl = new TextDecoder().decode(Uint8Array.from(data));
    }

    if (!lnurl) {
      return null;
    }

    const res = await fetch(lnurl);
    if (!res.ok) {
      return null;
    }

    const body = await res.json();
    if (body.allowsNostr && body.nostrPubkey) {
      callback = body.callback;
    }

    return callback;
  } catch (e) {
    logError('getZapEndpoint', e);
    return null;
  }
};

export const canUserReceiveZaps = (user?: PrimalUser) => {
  return !!user && !!(user.lud16 || user.lud06);
};

export const convertToZap = (zap: PrimalZap): NostrUserZaps => {
  const zapRequest = JSON.parse(zap.zapRequest || '{}');
  const zapRecepient = zap.recepient;

  const { amount, description, id, created_at, sig, pubkey } = zap;

  return {
    id,
    amount,
    pubkey,
    message: description,
    eventId: zapRequest.tags?.find((t: string[]) => t[0] === 'e')?.[1] || '',
    sender: zapRequest.pubkey,
    recepient: zapRecepient,
    created_at,
  };
};

export const zapArticle = zapNote;
export const zapProfile = zapNote;
export const zapDVM = zapNote;
export const zapSubscription = zapNote;
