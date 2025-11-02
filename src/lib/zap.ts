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
    const request = await nip47.makeNwcRequestEvent(nwcConfig.pubkey, hexToBytes(nwcConfig.secret), invoice);
    const signed = await signEvent(request);

    for (const url of nwcConfig.relays) {
      const relay = relayInit(url);
      await relay.connect();
      relays.push(relay);

      promises.push(
        new Promise<boolean>((resolve) => {
          let resolved = false;
          const sub = relay.sub([{ kinds: [23195], authors: [nwcConfig.pubkey] }]);

          sub.on('event', async (event: NostrRelaySignedEvent) => {
            try {
              const response = await nip04.decrypt(nwcConfig.secret, nwcConfig.pubkey, event.content);
              const resp = JSON.parse(response);

              if (resp.result_type === 'pay_invoice' && resp.result && !resolved) {
                resolved = true;
                result = true;
                resolve(true);
              } else if (resp.error && !resolved) {
                resolved = true;
                lastZapError = resp.error.message || 'NWC error';
                resolve(false);
              }
            } catch (e) {
              if (!resolved) {
                resolved = true;
                lastZapError = String(e);
                resolve(false);
              }
            }
          });

          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve(false);
            }
          }, 30000);
        })
      );

      await relay.publish(signed);
    }

    await Promise.race(promises);
    return result;
  } catch (e) {
    logError('zapOverNWC', e);
    lastZapError = String(e);
    return false;
  } finally {
    relays.forEach((r) => r.close());
  }
};

export const zapNote = async (
  note: PrimalNote | PrimalArticle | PrimalDVM,
  sender: string | undefined,
  amount: number,
  comment: string,
  relays: Relay[],
  nwc?: [string, string],
  useBreez = false
) => {
  if (!sender || !note.user) {
    return { success: false } as any;
  }

  const callback = await getZapEndpoint(note.user);

  if (!callback) {
    return { success: false } as any;
  }

  const sats = Math.round(amount * 1000);

  let payload: any = {
    profile: note.user.pubkey,
    event: note.post.id,
    amount: sats,
    relays: relays.map(r => r.url),
  };

  if (comment.length > 0) {
    // @ts-ignore
    payload.comment = comment;
  }

  const zapReq = nip57.makeZapRequest(payload);

  try {
    const signedEvent = await signEvent(zapReq);
    const event = encodeURIComponent(JSON.stringify(signedEvent));
    const r2 = await (await fetch(`${callback}?amount=${sats}&nostr=${event}`)).json();
    const pr = r2.pr;

    if (useBreez) {
      const breezPaid = await payWithBreez(pr);
      if (breezPaid) return { success: true, event: signedEvent } as any;
    }

    if (nwc && nwc[1] && nwc[1].length > 0) {
      const success = await zapOverNWC(sender, nwc[1], pr);
      return { success, event: signedEvent } as any;
    }

    await enableWebLn();
    await sendPayment(pr);
    return { success: true, event: signedEvent } as any;
  } catch (reason) {
    console.error('Failed to zap: ', reason);
    return { success: false } as any;
  }
};

export const zapStream = async (
  stream: StreamingData,
  sender: string | undefined,
  host: PrimalUser | undefined,
  amount: number,
  comment: string,
  relays: Relay[],
  nwc?: [string, string],
  useBreez = false
) => {
  if (!sender || !host) {
    return { success: false } as any;
  }

  const callback = await getZapEndpoint(host);

  if (!callback) {
    return { success: false } as any;
  }

  const a = `${Kind.LiveEvent}:${stream.pubkey}:${stream.id}`;
  const sats = Math.round(amount * 1000);

  let payload: any = {
    profile: host.pubkey,
    event: stream.event?.id || null,
    amount: sats,
    relays: relays.map(r => r.url),
  };

  if (comment.length > 0) {
    // @ts-ignore
    payload.comment = comment;
  }

  const zapReq = nip57.makeZapRequest(payload);

  if (!zapReq.tags.find((t: string[]) => t[0] === 'a' && t[1] === a)) {
    zapReq.tags.push(['a', a]);
  }

  try {
    const signedEvent = await signEvent(zapReq);
    const event = encodeURIComponent(JSON.stringify(signedEvent));
    const r2 = await (await fetch(`${callback}?amount=${sats}&nostr=${event}`)).json();
    const pr = r2.pr;

    if (useBreez) {
      const breezPaid = await payWithBreez(pr);
      if (breezPaid) return { success: true, event: signedEvent } as any;
    }

    if (nwc && nwc[1] && nwc[1].length > 0) {
      const success = await zapOverNWC(sender, nwc[1], pr);
      return { success, event: signedEvent } as any;
    }

    await enableWebLn();
    await sendPayment(pr);
    return { success: true, event: signedEvent } as any;
  } catch (reason) {
    console.error('Failed to zap: ', reason);
    return { success: false } as any;
  }
};

// Restored and completed helper functions
export const getZapEndpoint = async (user: PrimalUser): Promise<string | null> => {
  try {
    let lnurl: string = '';
    let callback: string | null = null;

    if (user.lud16) {
      const [name, domain] = user.lud16.split('@');
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
