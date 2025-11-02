import { createSignal, Show } from "solid-js";
import { getBreezService } from "../../lib/breez/breezService";
import { decode } from "light-bolt11-decoder";
// Simple helpers for sats/BTC conversion
const SATS_PER_BTC = 100_000_000;
const satsToBtc = (sats: number) => (sats ? sats / SATS_PER_BTC : 0);
const btcToSats = (btc: number) => Math.round(btc * SATS_PER_BTC);
export type SendModalProps = {
  isOpen: boolean;
  onClose: () => void;
  balanceSats: number; // user's spendable balance in sats
};
// A very lightweight QR picker placeholder. Replace with a real scanner component if available.
function QrScanButton(props: { onResult: (text: string) => void }) {
  let inputRef: HTMLInputElement | undefined;
  const onPick = async () => {
    // Fallback: prompt for a string as a pseudo-scan in web context
    const val = window.prompt("Paste invoice or address from QR");
    if (val) props.onResult(val.trim());
  };
  return (
    <button type="button" class="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300" onClick={onPick} aria-label="Scan QR">
      📷
      <input ref={inputRef} type="file" accept="image/*" class="hidden" />
    </button>
  );
}
export default function SendModal(props: SendModalProps) {
  // Step control
  const [step, setStep] = createSignal<"form" | "confirm" | "sending" | "success" | "error">("form");
  // Inputs
  const [invoiceOrAddress, setInvoiceOrAddress] = createSignal("");
  const [amountSats, setAmountSats] = createSignal<number>(undefined as any);
  const [amountBtcStr, setAmountBtcStr] = createSignal("");
  const [memo, setMemo] = createSignal("");
  // Derived / info
  const [decoded, setDecoded] = createSignal<any>(null);
  const [feeEstimateSats, setFeeEstimateSats] = createSignal<number | null>(null);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
  const [txDetails, setTxDetails] = createSignal<any>(null);
  const reset = () => {
    setStep("form");
    setInvoiceOrAddress("");
    setAmountSats(undefined as any);
    setAmountBtcStr("");
    setMemo("");
    setDecoded(null);
    setFeeEstimateSats(null);
    setErrorMsg(null);
    setTxDetails(null);
  };
  const closeAndReset = () => {
    reset();
    props.onClose?.();
  };
  const decodeInvoiceIfNeeded = (value: string) => {
    try {
      const val = value.trim();
      if (!val) {
        setDecoded(null);
        return;
      }
      // Only attempt to decode if it looks like a BOLT11 invoice (starts with ln...)
      if (/^ln/i.test(val)) {
        const d = decode(val);
        setDecoded(d);
        // Extract amount from invoice if present (milli-sats in some cases). Try amounts fields.
        const amountSection = d.sections?.find((s: any) => s.name === "amount" || s.name === "msatoshi");
        if (amountSection?.value) {
          const s = String(amountSection.value);
          let parsedSats: number | undefined;
          if (/^\d+$/.test(s)) {
            parsedSats = Number(s);
          } else if (/^\d+\.\d+$/.test(s)) {
            parsedSats = Number(s);
          }
          if (typeof parsedSats === "number" && !Number.isNaN(parsedSats)) {
            // If msat detected, convert to sats
            if (String(amountSection.name).toLowerCase().includes("msat")) {
              parsedSats = Math.floor(parsedSats / 1000);
            }
            setAmountSats(parsedSats);
            setAmountBtcStr(String(satsToBtc(parsedSats)));
          }
        }
        // Extract description/memo if exists
        const desc = d.sections?.find((s: any) => s.name === "description");
        if (desc?.value) setMemo(String(desc.value));
      } else {
        setDecoded(null);
      }
    } catch (e: any) {
      // Not a fatal error, just clear decoded
      setDecoded(null);
    }
  };
  const onInvoiceChange = (v: string) => {
    setInvoiceOrAddress(v);
    decodeInvoiceIfNeeded(v);
  };
  // Amount handling
  const onSatsChange = (v: string) => {
    const n = Number(v.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n)) {
      setAmountSats(Number.isNaN(n) ? (undefined as any) : Math.floor(n));
      setAmountBtcStr(n ? String(satsToBtc(n)) : "");
    }
  };
  const onBtcChange = (v: string) => {
    setAmountBtcStr(v);
    const n = Number(v.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n)) {
      setAmountSats(n ? btcToSats(n) : (undefined as any));
    }
  };
  const canProceed = () => {
    const inv = invoiceOrAddress().trim();
    const amt = amountSats();
    if (!inv) return false;
    if (!amt || amt <= 0) return false;
    if (amt > props.balanceSats) return false;
    return true;
  };
  // Dummy fee estimate: 0.3% of amount with a min 1 sat. Replace with real API if available.
  const refreshFeeEstimate = () => {
    const amt = amountSats() || 0;
    if (!amt) {
      setFeeEstimateSats(null);
      return;
    }
    const est = Math.max(1, Math.round(amt * 0.003));
    setFeeEstimateSats(est);
  };
  // Keep fee estimate updated when amount changes
  const handleAmountInputBlur = () => {
    refreshFeeEstimate();
  };
  const goToConfirm = () => {
    setErrorMsg(null);
    if (!canProceed()) return;
    refreshFeeEstimate();
    setStep("confirm");
  };
  const submitPayment = async () => {
    setStep("sending");
    setErrorMsg(null);
    try {
      // Prefer invoice decoding; else pass raw string
      const inv = invoiceOrAddress().trim();
      const amt = amountSats();
      const note = memo().trim();
      // getBreezService().payInvoice may accept the invoice and optional amount for zero-amount invoices
      const service = getBreezService();
      const res = await service.payInvoice(inv, amt ?? undefined, note || undefined);
      setTxDetails(res);
      setStep("success");
    } catch (e: any) {
      setErrorMsg(e?.message || "Payment failed");
      setStep("error");
    }
  };
  const Summary = () => (
    <div class="space-y-2 text-sm">
      <div class="flex justify-between">Invoice/Address<span class="truncate max-w-[60%]" title={invoiceOrAddress()}>{invoiceOrAddress()}</span></div>
      <div class="flex justify-between">Amount{amountSats()} sats ({satsToBtc(amountSats()||0)} BTC)</div>
      <Show when={memo().trim()}>
        <div class="flex justify-between">Memo<span class="truncate max-w-[60%]" title={memo()}>{memo()}</span></div>
      </Show>
      <Show when={feeEstimateSats()}>
        <div class="flex justify-between">Estimated fee{feeEstimateSats()} sats</div>
      </Show>
      <div class="flex justify-between font-medium border-t pt-2">Total (est.){(amountSats()||0)+(feeEstimateSats()||0)} sats</div>
    </div>
  );
  if (!props.isOpen) return null as any;
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-md rounded-lg bg-white shadow-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold">Send Payment</h2>
          <button aria-label="Close" class="text-gray-500 hover:text-black" onClick={closeAndReset}>✕</button>
        </div>
        <Show when={step()==="form"}>
          <div class="space-y-4">
            <div class="space-y-1">
              <label class="text-sm font-medium">Lightning invoice or address</label>
              <div class="flex gap-2">
                <input class="flex-1 border rounded px-3 py-2" placeholder="lnbc1... or address" value={invoiceOrAddress()} onInput={(e) => onInvoiceChange((e.currentTarget as HTMLInputElement).value)} />
                <QrScanButton onResult={(t) => onInvoiceChange(t)} />
              </div>
              <Show when={decoded()}>
                <p class="text-xs text-gray-500">Invoice detected and decoded.</p>
              </Show>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-sm font-medium">Amount (sats)</label>
                <input class="w-full border rounded px-3 py-2" inputMode="numeric" placeholder="e.g. 2100" value={amountSats() as any} onInput={(e) => onSatsChange((e.currentTarget as HTMLInputElement).value)} onBlur={handleAmountInputBlur} />
              </div>
              <div>
                <label class="text-sm font-medium">Amount (BTC)</label>
                <input class="w-full border rounded px-3 py-2" inputMode="decimal" placeholder="e.g. 0.000021" value={amountBtcStr()} onInput={(e) => onBtcChange((e.currentTarget as HTMLInputElement).value)} onBlur={handleAmountInputBlur} />
              </div>
            </div>
            <Show when={(amountSats()||0) > props.balanceSats}>
              <p class="text-sm text-red-600">Amount exceeds available balance of {props.balanceSats} sats.</p>
            </Show>
            <div class="space-y-1">
              <label class="text-sm font-medium">Memo (optional)</label>
              <input class="w-full border rounded px-3 py-2" placeholder="Add a note" value={memo()} onInput={(e) => setMemo((e.currentTarget as HTMLInputElement).value)} />
            </div>
            <Show when={feeEstimateSats()!==null}>
              <div class="text-sm text-gray-700">Estimated fee: {feeEstimateSats()} sats</div>
            </Show>
            <div class="flex justify-end gap-2 pt-2">
              <button class="px-3 py-2 rounded border" onClick={closeAndReset}>Cancel</button>
              <button class="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" disabled={!canProceed()} onClick={goToConfirm}>Review</button>
            </div>
          </div>
        </Show>
        <Show when={step()==="confirm"}>
          <div class="space-y-4">
            <Summary />
            <div class="flex justify-end gap-2 pt-2">
              <button class="px-3 py-2 rounded border" onClick={() => setStep("form")}>Back</button>
              <button class="px-3 py-2 rounded bg-blue-600 text-white" onClick={submitPayment}>Confirm and Pay</button>
            </div>
          </div>
        </Show>
        <Show when={step()==="sending"}>
          <div class="flex flex-col items-center gap-2 py-6">
            <div class="animate-spin h-6 w-6 rounded-full border-2 border-gray-300 border-t-blue-600"></div>
            <p class="text-sm text-gray-700">Sending payment...</p>
          </div>
        </Show>
        <Show when={step()==="success"}>
          <div class="space-y-3">
            <h3 class="text-green-700 font-medium">Payment sent successfully</h3>
            <div class="bg-gray-50 border rounded p-3 text-sm">
              <pre class="whitespace-pre-wrap break-all">{JSON.stringify(txDetails(), null, 2)}</pre>
            </div>
            <div class="flex justify-end">
              <button class="px-3 py-2 rounded bg-green-600 text-white" onClick={closeAndReset}>Done</button>
            </div>
          </div>
        </Show>
        <Show when={step()==="error"}>
          <div class="space-y-3">
            <h3 class="text-red-700 font-medium">Payment failed</h3>
            <Show when={errorMsg()}>
              <div class="text-sm text-red-600">{errorMsg()}</div>
            </Show>
            <div class="flex justify-end gap-2">
              <button class="px-3 py-2 rounded border" onClick={() => setStep("form")}>Back</button>
              <button class="px-3 py-2 rounded bg-blue-600 text-white" onClick={submitPayment}>Retry</button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
