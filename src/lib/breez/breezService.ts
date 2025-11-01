import { EventEmitter } from 'events';

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

// BreezService class extending EventEmitter
export class BreezService extends EventEmitter {
  private static instance: BreezService | null = null;
  private config: BreezConfig | null = null;
  private connected: boolean = false;
  private breezSDK: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private balance: number = 0;

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
      // This is a placeholder - actual implementation depends on Breez SDK API
      const { initBreezSDK } = await import('./wasmLoader');
      
      this.breezSDK = await initBreezSDK({
        apiKey: config.apiKey,
        network: config.network,
        workingDir: config.workingDir,
        mnemonic: config.mnemonic,
      });

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

  // Get balance method
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
    if (!this.breezSDK) {
      console.error('Cannot setup event listeners: SDK not initialized');
      return;
    }

    try {
      // Listen for payment received events
      this.breezSDK.addEventListener('paymentReceived', (payment: any) => {
        this.emit('payment_received', payment);
        this.refreshBalance().catch(err => 
          console.error('Failed to refresh balance after payment received:', err)
        );
      });

      // Listen for payment sent events
      this.breezSDK.addEventListener('paymentSent', (payment: any) => {
        this.emit('payment_sent', payment);
        this.refreshBalance().catch(err => 
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
        this.refreshBalance().catch(err => 
          console.error('Failed to refresh balance after invoice paid:', err)
        );
      });

      console.log('Event listeners setup successfully');
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
      console.error('Max reconnection attempts reached');
      this.emit('error', { 
        message: 'Max reconnection attempts reached', 
        error: 'Could not reconnect to Breez SDK' 
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      if (this.config) {
        try {
          await this.connect(this.config);
        } catch (error) {
          console.error('Reconnection attempt failed:', error);
          // handleReconnection will be called again from connect() on failure
        }
      }
    }, delay);
  }

  // Utility method to create invoice
  public async createInvoice(request: InvoiceRequest): Promise<any> {
    try {
      if (!this.connected || !this.breezSDK) {
        throw new Error('BreezService is not connected');
      }

      const invoice = await this.breezSDK.receivePayment({
        amountMsat: request.amountMsat,
        description: request.description,
        expiry: request.expiry,
      });

      return invoice;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating invoice:', errorMessage);
      this.emit('error', { message: 'Failed to create invoice', error: errorMessage });
      throw new Error(`Failed to create invoice: ${errorMessage}`);
    }
  }

  // Utility method to send payment
  public async sendPayment(request: PaymentRequest): Promise<any> {
    try {
      if (!this.connected || !this.breezSDK) {
        throw new Error('BreezService is not connected');
      }

      const payment = await this.breezSDK.sendPayment({
        amount: request.amount,
        description: request.description,
        expiry: request.expiry,
      });

      return payment;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error sending payment:', errorMessage);
      this.emit('error', { message: 'Failed to send payment', error: errorMessage });
      throw new Error(`Failed to send payment: ${errorMessage}`);
    }
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
