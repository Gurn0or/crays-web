import { EventEmitter } from 'events';

// Breez SDK minimal types (adapt to actual SDK types in your project)
interface BreezSDKLike {
  payInvoice: (params: { invoice: string }) => Promise<any>;
  receivePayment: (params: { amountMsat: number; description: string; expiry?: number }) => Promise<any>;
  listPayments: (params?: { limit?: number }) => Promise<any>;
  nodeInfo: () => Promise<any>;
  sync?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  addEventListener?: (event: string, cb: (payload: any) => void) => void;
}

// BreezConfig interface
export interface BreezConfig {
  mnemonic: string;
  apiKey: string;
  network: 'mainnet' | 'testnet' | 'regtest';
  workingDir: string;
}

// PaymentRequest interface
export interface PaymentRequest {
  amount: number;
  description?: string;
  expiry?: number;
}

// InvoiceRequest interface
export interface InvoiceRequest {
  amountMsat: number;
  description: string;
  expiry?: number;
}

// BreezEvent type
export type BreezEvent =
  | 'payment_received'
  | 'payment_sent'
  | 'payment_failed'
  | 'invoice_paid'
  | 'balance_updated'
  | 'connection_status_changed'
  | 'error';

// Parse result types
export type ParsedInput =
  | { type: 'bolt11'; invoice: string }
  | { type: 'lnurl'; lnurl: string }
  | { type: 'onchain'; address: string }
  | { type: 'unknown'; raw: string };

// BreezService class extending EventEmitter
export class BreezService extends EventEmitter {
  private static instance: BreezService | null = null;
  private config: BreezConfig | null = null;
  private connected = false;
  private breezSDK: BreezSDKLike | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private balance = 0;

  private constructor() {
    super();
  }

  // Singleton pattern
  public static getBreezService(): BreezService {
    if (!BreezService.instance) {
      BreezService.instance = new BreezService();
    }
    return BreezService.instance;
  }

  // Connect method with Breez SDK initialization
  public async connect(config: BreezConfig): Promise<void> {
    try {
      if (this.connected) {
        console.warn('BreezService is already connected');
        return;
      }
      this.config = config;
      // Initialize Breez SDK (assuming SDK is imported from wasmLoader or similar)
      const { initBreezSDK } = await import('./wasmLoader');

      this.breezSDK = (await initBreezSDK({
        apiKey: config.apiKey,
        network: config.network,
        workingDir: config.workingDir,
        mnemonic: config.mnemonic,
      })) as BreezSDKLike;

      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connection_status_changed', { connected: true });

      // Setup event listeners after successful connection
      this.setupEventListeners();

      // Initial balance refresh
      await this.refreshBalance();
      console.log('BreezService connected successfully');
    } catch (error) {
      this.connected = false;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to connect BreezService:', errorMessage);
      this.emit('error', { message: 'Connection failed', error: errorMessage });

      // Attempt reconnection
      this.handleReconnection();

      throw new Error(`Failed to connect to Breez SDK: ${errorMessage}`);
    }
  }

  // Disconnect method
  public async disconnect(): Promise<void> {
    try {
      if (!this.connected) {
        console.warn('BreezService is not connected');
        return;
      }
      // Clear reconnection timer if exists
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      // Disconnect from Breez SDK
      if (this.breezSDK && typeof this.breezSDK.disconnect === 'function') {
        await this.breezSDK.disconnect();
      }
      this.connected = false;
      this.breezSDK = null;
      this.balance = 0;
      this.reconnectAttempts = 0;

      this.emit('connection_status_changed', { connected: false });

      // Remove all listeners
      this.removeAllListeners();

      console.log('BreezService disconnected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error during disconnect:', errorMessage);
      this.emit('error', { message: 'Disconnect failed', error: errorMessage });
      throw new Error(`Failed to disconnect from Breez SDK: ${errorMessage}`);
    }
  }

  // Get balance method (msat)
  public async getBalance(): Promise<number> {
    try {
      if (!this.connected || !this.breezSDK) {
        throw new Error('BreezService is not connected');
      }
      // Fetch balance from Breez SDK
      const balanceInfo = await this.breezSDK.nodeInfo();
      this.balance = balanceInfo?.channelsBalanceMsat || 0;

      return this.balance;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching balance:', errorMessage);
      this.emit('error', { message: 'Failed to get balance', error: errorMessage });
      throw new Error(`Failed to get balance: ${errorMessage}`);
    }
  }

  // Check if connected
  public isConnected(): boolean {
    return this.connected;
  }

  // Setup event listeners for payment events
  private setupEventListeners(): void {
    if (!this.breezSDK || typeof this.breezSDK.addEventListener !== 'function') {
      return;
    }
    try {
      // Listen for payment received events
      this.breezSDK.addEventListener('paymentReceived', (payment: any) => {
        this.emit('payment_received', payment);
        this.refreshBalance().catch((err) =>
          console.error('Failed to refresh balance after payment received:', err)
        );
      });
      // Listen for payment sent events
      this.breezSDK.addEventListener('paymentSent', (payment: any) => {
        this.emit('payment_sent', payment);
        this.refreshBalance().catch((err) =>
          console.error('Failed to refresh balance after payment sent:', err)
        );
      });
      // Listen for payment failed events
      this.breezSDK.addEventListener('paymentFailed', (payment: any) => {
        this.emit('payment_failed', payment);
      });
      // Listen for invoice paid events
      this.breezSDK.addEventListener('invoicePaid', (invoice: any) => {
        this.emit('invoice_paid', invoice);
        this.refreshBalance().catch((err) =>
          console.error('Failed to refresh balance after invoice paid:', err)
        );
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error setting up event listeners:', errorMessage);
      this.emit('error', { message: 'Failed to setup event listeners', error: errorMessage });
    }
  }

  // Refresh balance method
  public async refreshBalance(): Promise<void> {
    try {
      const newBalance = await this.getBalance();
      this.emit('balance_updated', { balance: newBalance });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error refreshing balance:', errorMessage);
      this.emit('error', { message: 'Failed to refresh balance', error: errorMessage });
    }
  }

  // Reconnection logic
  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', {
        message: 'Max reconnection attempts reached',
        error: 'Could not reconnect to Breez SDK',
      });
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    this.reconnectTimer = setTimeout(async () => {
      if (this.config) {
        try {
          await this.connect(this.config);
        } catch (error) {
          // swallow; connect will schedule another retry
        }
      }
    }, delay);
  }

  // New methods
  // 1) Pay a Lightning invoice (BOLT11)
  public async payInvoice(invoice: string): Promise<any> {
    try {
      if (!this.connected || !this.breezSDK) {
        throw new Error('BreezService is not connected');
      }
      if (!invoice || typeof invoice !== 'string') {
        throw new Error('Invalid invoice');
      }
      const parsed = this.parseInput(invoice);
      if (parsed.type !== 'bolt11') {
        throw new Error('Input is not a BOLT11 invoice');
      }
      const res = await this.breezSDK.payInvoice({ invoice });
      await this.refreshBalance();
      return res;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { message: 'Failed to pay invoice', error: errorMessage });
      throw new Error(`Failed to pay invoice: ${errorMessage}`);
    }
  }

  // 2) Create invoice from sats and description
  public async createInvoice(amountSats: number, description: string, expiry?: number): Promise<any> {
    try {
      if (!this.connected || !this.breezSDK) {
        throw new Error('BreezService is not connected');
      }
      if (!Number.isFinite(amountSats) || amountSats <= 0) {
        throw new Error('Amount must be a positive number of sats');
      }
      if (!description) {
        throw new Error('Description is required');
      }
      const amountMsat = Math.round(amountSats * 1000);
      const invoice = await this.breezSDK.receivePayment({ amountMsat, description, expiry });
      return invoice;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { message: 'Failed to create invoice', error: errorMessage });
      throw new Error(`Failed to create invoice: ${errorMessage}`);
    }
  }

  // 3) List payments
  public async listPayments(limit?: number): Promise<any> {
    try {
      if (!this.connected || !this.breezSDK) {
        throw new Error('BreezService is not connected');
      }
      const res = await this.breezSDK.listPayments({ limit });
      return res;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { message: 'Failed to list payments', error: errorMessage });
      throw new Error(`Failed to list payments: ${errorMessage}`);
    }
  }

  // 4) Parse input for invoice/address types
  public parseInput(input: string): ParsedInput {
    const raw = input.trim();
    const lower = raw.toLowerCase();
    // BOLT11 typical prefixes: lnbc (mainnet), lntb (testnet), lnbcrt (regtest)
    const isBolt11 = /^(lnbc|lntb|lnbcrt)[0-9a-z]+$/.test(lower);
    if (isBolt11) return { type: 'bolt11', invoice: raw };

    // LNURL: usually bech32-encoded starting with lnurl
    if (/^lnurl[0-9a-z]+$/.test(lower)) return { type: 'lnurl', lnurl: raw };

    // Onchain address rough detection (bech32 bc1/tb1/bcrt1 or base58 1/3/m/n)
    if (/^(bc1|tb1|bcrt1)[0-9a-z]+$/.test(lower) || /^[13mn][1-9A-HJ-NP-Za-km-z]{20,59}$/.test(raw)) {
      return { type: 'onchain', address: raw };
    }

    return { type: 'unknown', raw };
  }

  // 5) Get node info
  public async getNodeInfo(): Promise<any> {
    try {
      if (!this.connected || !this.breezSDK) {
        throw new Error('BreezService is not connected');
      }
      const info = await this.breezSDK.nodeInfo();
      return info;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { message: 'Failed to get node info', error: errorMessage });
      throw new Error(`Failed to get node info: ${errorMessage}`);
    }
  }

  // 6) Force network sync
  public async sync(): Promise<void> {
    try {
      if (!this.connected || !this.breezSDK) {
        throw new Error('BreezService is not connected');
      }
      if (typeof this.breezSDK.sync === 'function') {
        await this.breezSDK.sync();
      } else {
        // fallback: call nodeInfo to trigger/ensure connectivity in some SDKs
        await this.breezSDK.nodeInfo();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { message: 'Failed to sync', error: errorMessage });
      throw new Error(`Failed to sync: ${errorMessage}`);
    }
  }

  // Legacy utility methods kept for backward compatibility
  public async createInvoiceLegacy(request: InvoiceRequest): Promise<any> {
    // delegate to new method
    return this.createInvoice(Math.round(request.amountMsat / 1000), request.description, request.expiry);
  }

  public async sendPaymentLegacy(request: PaymentRequest): Promise<any> {
    // no invoice provided in legacy type; keep original passthrough if SDK supports amount-only
    if (!this.connected || !this.breezSDK) throw new Error('BreezService is not connected');
    const payment = await (this.breezSDK as any).sendPayment?.({
      amount: request.amount,
      description: request.description,
      expiry: request.expiry,
    });
    await this.refreshBalance();
    return payment;
  }

  // Get current balance without fetching from SDK
  public getCurrentBalance(): number {
    return this.balance;
  }
}

// Export singleton instance getter
export const getBreezService = BreezService.getBreezService;
// Export default
export default BreezService;
