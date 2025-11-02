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
      throw new Error('Invalid NWC URI');
    }

    const { relayUrls, walletPubkey, secret } = nwcConfig;

    relays = relayUrls.map(url => relayInit(url));

    await Promise.all(relays.map(relay => relay.connect()));

    for (let relay of relays) {
      const promise = new Promise<boolean>(async (resolve) => {
        try {
          const content = JSON.stringify({
            method: 'pay_invoice',
            params: { invoice }
          });

          const encryptedContent = await nip04.encrypt(secret, walletPubkey, content);

          const eventToSign = {
            kind: 23194,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', walletPubkey]],
            content: encryptedContent,
            pubkey: secret
          };

          const signedEvent = await signEvent(eventToSign, secret);

          let timeout: ReturnType<typeof setTimeout>;
          const responsePromise = new Promise<boolean>((resolveResponse) => {
            relay.on('event', async (event: NostrRelaySignedEvent) => {
              if (event.kind === 23195 && event.pubkey === walletPubkey) {
                try {
                  const decryptedContent = await nip04.decrypt(secret, walletPubkey, event.content);
                  const response = JSON.parse(decryptedContent);

                  if (response.result) {
                    clearTimeout(timeout);
                    resolveResponse(true);
                  } else if (response.error) {
                    clearTimeout(timeout);
                    lastZapError = response.error.message || 'NWC payment failed';
                    resolveResponse(false);
                  }
                } catch (e) {
                  logError('zapOverNWC decrypt', e);
                }
              }
            });
          });

          timeout = setTimeout(() => {
            resolveResponse(false);
          }, 30000);

          relay.publish(signedEvent);

          const success = await responsePromise;
          resolve(success);
        } catch (e) {
          logError('zapOverNWC relay', e);
          resolve(false);
        }
      });

      promises.push(promise);
    }

    const results = await Promise.race(promises);
    result = results;
  } catch (e) {
    logError('zapOverNWC', e);
    lastZapError = String(e);
  } finally {
    relays.forEach(relay => relay.close());
  }

  return result;
};

export const makeZapReceipt = async (
  zapEndpoint: string,
  amount: number,
  comment: string,
  zapRequest: NostrRelaySignedEvent,
  relays: string[],
  lnurl: string,
): Promise<string | null> => {
  let invoice: string | null = null;
  let errorMsg = 'Failed to generate invoice';

  try {
    const zapEndpointCall = `${zapEndpoint}?` + `amount=${amount * 1000}&` + `nostr=${encodeURIComponent(JSON.stringify(zapRequest))}&` + `lnurl=${lnurl}`;

    const res = await fetch(zapEndpointCall);

    if (!res.ok) {
      errorMsg = `Invoice generation failed with status ${res.status}`;
      throw new Error(errorMsg);
    }

    const body = await res.json();

    if (body.status === 'ERROR') {
      errorMsg = body.reason || errorMsg;
      throw new Error(errorMsg);
    }

    invoice = body.pr;
  } catch (e) {
    logError('makeZapReceipt', e);
    lastZapError = errorMsg;
  }

  return invoice;
};

export const zapNote = async (
  target: PrimalNote | PrimalArticle | PrimalUser | PrimalDVM | StreamingData,
  sender: PrimalUser,
  amount: number,
  comment: string,
  relays: string[],
  nwcEnc?: string,
) => {
  let successfulZap = false;
  lastZapError = '';

  try {
    const recipientUser = 'user' in target ? target.user : target;

    if (!recipientUser || (!recipientUser.lud16 && !recipientUser.lud06)) {
      lastZapError = 'Recipient has no lightning address';
      return false;
    }

    let lnurl = recipientUser.lud16 || recipientUser.lud06 || '';

    if (lnurl.startsWith('LNURL')) {
      lnurl = lnurl.toLowerCase();
    } else if (lnurl.includes('@')) {
      const [name, domain] = lnurl.split('@');
      lnurl = `https://${domain}/.well-known/lnurlp/${name}`;
    }

    const zapEndpoint = await getZapEndpoint(lnurl);

    if (!zapEndpoint) {
      lastZapError = 'Failed to fetch zap endpoint';
      return false;
    }

    let tags: string[][] = [
      ['relays', ...relays],
      ['amount', String(amount * 1000)],
      ['lnurl', lnurl],
      ['p', recipientUser.pubkey],
    ];

    if ('post' in target && target.post) {
      tags.push(['e', target.post.id]);
    } else if ('id' in target) {
      tags.push(['e', target.id]);
    }

    const zapRequest: NostrRelaySignedEvent = await signEvent({
      kind: Kind.ZapRequest,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: comment,
      pubkey: sender.pubkey,
    });

    const invoice = await makeZapReceipt(
      zapEndpoint,
      amount,
      comment,
      zapRequest,
      relays,
      lnurl,
    );

    if (!invoice) {
      lastZapError = lastZapError || 'Failed to generate invoice';
      return false;
    }

    // Try Breez first if available
    const breezSuccess = await payWithBreez(invoice);
    if (breezSuccess) {
      return true;
    }

    // Try NWC if configured
    if (nwcEnc) {
      const nwcSuccess = await zapOverNWC(sender.pubkey, nwcEnc, invoice);
      if (nwcSuccess) {
        return true;
      }
    }

    // Fall back to WebLN
    await enableWebLn();
    await sendPayment(invoice);
    successfulZap = true;
  } catch (e) {
    logError('zapNote', e);
    lastZapError = String(e);
  }

  return successfulZap;
};

export const getZapEndpoint = async (lnurl: string): Promise<string | null> => {
  let callback: string | null = null;

  try {
    if (lnurl.startsWith('lnurl')) {
      const { words } = bech32.decode(lnurl, 1000);
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
export const zapStream = zapNote;
