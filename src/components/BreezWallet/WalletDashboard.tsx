import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import { useBreezWallet } from '../../contexts/BreezWalletContext';

interface Transaction {
  id: string;
  type: 'incoming' | 'outgoing';
  amount: number;
  timestamp: Date;
  status: 'completed' | 'pending' | 'failed';
  description?: string;
}

const WalletDashboard: Component = () => {
  const breezWallet = useBreezWallet();
  const [showSats, setShowSats] = createSignal(true);
  const [isLoading, setIsLoading] = createSignal(true);
  const [balance, setBalance] = createSignal(0);
  const [transactions, setTransactions] = createSignal<Transaction[]>([]);
  const [connectionStatus, setConnectionStatus] = createSignal<'connected' | 'disconnected' | 'connecting'>('connecting');

  // Initialize and listen to Breez events
  createEffect(() => {
    const initWallet = async () => {
      try {
        setIsLoading(true);
        
        // Get initial balance
        const walletBalance = await breezWallet?.getBalance();
        if (walletBalance !== undefined) {
          setBalance(walletBalance);
        }
        
        // Get transaction history
        const txHistory = await breezWallet?.getTransactions();
        if (txHistory) {
          setTransactions(txHistory as Transaction[]);
        }
        
        // Listen for payment events
        breezWallet?.addEventListener('payment', (event) => {
          console.log('Payment event:', event);
          // Refresh balance and transactions
          initWallet();
        });

        setConnectionStatus('connected');
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
        setConnectionStatus('disconnected');
        setIsLoading(false);
      }
    };

    if (breezWallet) {
      initWallet();
    }
  });

  const formatBalance = (sats: number): string => {
    if (showSats()) {
      return `${sats.toLocaleString()} sats`;
    }
    // Convert sats to BTC (1 BTC = 100,000,000 sats)
    const btc = sats / 100000000;
    return `${btc.toFixed(8)} BTC`;
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusColor = (status: Transaction['status']): string => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div class="wallet-dashboard">
      {/* Header */}
      <div class="dashboard-header">
        <h1>Breez Wallet</h1>
        <div class="connection-status">
          <span class={`status-indicator ${connectionStatus()}`}></span>
          <span class="status-text">{connectionStatus()}</span>
        </div>
      </div>

      {/* Balance Card */}
      <div class="balance-card">
        <div class="balance-header">
          <h2>Balance</h2>
          <button 
            class="toggle-unit-btn"
            onClick={() => setShowSats(!showSats())}
          >
            {showSats() ? 'Show BTC' : 'Show Sats'}
          </button>
        </div>
        <div class="balance-amount">
          <Show
            when={!isLoading()}
            fallback={<div class="loading-spinner">Loading...</div>}
          >
            {formatBalance(balance())}
          </Show>
        </div>
      </div>

      {/* Quick Actions */}
      <div class="quick-actions">
        <button 
          class="action-btn primary"
          onClick={() => breezWallet?.openReceiveDialog()}
          disabled={connectionStatus() !== 'connected'}
        >
          <span class="icon">↓</span>
          Receive
        </button>
        <button 
          class="action-btn primary"
          onClick={() => breezWallet?.openSendDialog()}
          disabled={connectionStatus() !== 'connected' || balance() === 0}
        >
          <span class="icon">↑</span>
          Send
        </button>
      </div>

      {/* Transactions List */}
      <div class="transactions-section">
        <div class="section-header">
          <h2>Recent Transactions</h2>
          <button class="view-all-btn">View All</button>
        </div>
        
        <div class="transactions-list">
          <Show
            when={!isLoading()}
            fallback={
              <div class="loading-container">
                <div class="loading-spinner">Loading transactions...</div>
              </div>
            }
          >
            <Show
              when={transactions().length > 0}
              fallback={
                <div class="empty-state">
                  <p>No transactions yet</p>
                  <p class="empty-state-subtitle">Start by receiving some sats!</p>
                </div>
              }
            >
              <For each={transactions()}>
                {(tx) => (
                  <div class="transaction-item">
                    <div class="transaction-icon">
                      <span class={tx.type === 'incoming' ? 'icon-incoming' : 'icon-outgoing'}>
                        {tx.type === 'incoming' ? '↓' : '↑'}
                      </span>
                    </div>
                    <div class="transaction-details">
                      <div class="transaction-description">
                        {tx.description || (tx.type === 'incoming' ? 'Received' : 'Sent')}
                      </div>
                      <div class="transaction-date">
                        {formatDate(tx.timestamp)}
                      </div>
                    </div>
                    <div class="transaction-amount">
                      <div class={`amount ${tx.type}`}>
                        {tx.type === 'incoming' ? '+' : '-'}{formatBalance(tx.amount)}
                      </div>
                      <div class={`transaction-status ${getStatusColor(tx.status)}`}>
                        {tx.status}
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </div>
      </div>

      {/* Wallet Info */}
      <div class="wallet-info">
        <button class="info-btn" onClick={() => breezWallet?.openSettings()}>
          ⚙️ Settings
        </button>
        <button class="info-btn" onClick={() => breezWallet?.exportLogs()}>
          📄 Export Logs
        </button>
      </div>
    </div>
  );
};

export default WalletDashboard;
