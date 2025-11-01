import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import { useBreezWallet } from '../../hooks/useBreezWallet';
import './WalletDashboard.css';

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
          setTransactions(txHistory);
        }

        // Set connection status
        const status = await breezWallet?.getConnectionStatus();
        if (status) {
          setConnectionStatus(status);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
        setIsLoading(false);
        setConnectionStatus('disconnected');
      }
    };

    initWallet();

    // Listen for real-time balance updates
    const handleBalanceUpdate = (newBalance: number) => {
      setBalance(newBalance);
    };

    // Listen for new transactions
    const handleNewTransaction = (tx: Transaction) => {
      setTransactions(prev => [tx, ...prev]);
    };

    // Listen for connection status changes
    const handleConnectionChange = (status: 'connected' | 'disconnected' | 'connecting') => {
      setConnectionStatus(status);
    };

    // Register event listeners
    breezWallet?.on('balanceUpdate', handleBalanceUpdate);
    breezWallet?.on('newTransaction', handleNewTransaction);
    breezWallet?.on('connectionChange', handleConnectionChange);

    // Cleanup
    return () => {
      breezWallet?.off('balanceUpdate', handleBalanceUpdate);
      breezWallet?.off('newTransaction', handleNewTransaction);
      breezWallet?.off('connectionChange', handleConnectionChange);
    };
  });

  // Convert satoshis to BTC
  const toBTC = (sats: number): string => {
    return (sats / 100000000).toFixed(8);
  };

  // Format balance display
  const formatBalance = () => {
    if (showSats()) {
      return `${balance().toLocaleString()} sats`;
    }
    return `${toBTC(balance())} BTC`;
  };

  // Format transaction amount
  const formatTxAmount = (amount: number, type: 'incoming' | 'outgoing') => {
    const prefix = type === 'incoming' ? '+' : '-';
    if (showSats()) {
      return `${prefix}${amount.toLocaleString()} sats`;
    }
    return `${prefix}${toBTC(amount)} BTC`;
  };

  // Format timestamp
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Quick action handlers
  const handleSend = () => {
    console.log('Send action triggered');
    // Navigation or modal logic would go here
  };

  const handleReceive = () => {
    console.log('Receive action triggered');
    // Navigation or modal logic would go here
  };

  const handleSettings = () => {
    console.log('Settings action triggered');
    // Navigation or modal logic would go here
  };

  return (
    <div class="wallet-dashboard">
      {/* Connection Status Indicator */}
      <div class={`connection-status connection-status--${connectionStatus()}`}>
        <span class="connection-status__dot"></span>
        <span class="connection-status__text">
          {connectionStatus() === 'connected' && 'Connected'}
          {connectionStatus() === 'disconnected' && 'Disconnected'}
          {connectionStatus() === 'connecting' && 'Connecting...'}
        </span>
      </div>

      <Show when={!isLoading()} fallback={
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p class="loading-text">Loading wallet...</p>
        </div>
      }>
        <div class="dashboard-grid">
          {/* Balance Display */}
          <section class="balance-card">
            <div class="balance-card__header">
              <h2 class="balance-card__title">Total Balance</h2>
              <button 
                class="balance-toggle"
                onClick={() => setShowSats(!showSats())}
                aria-label="Toggle between sats and BTC"
              >
                {showSats() ? 'BTC' : 'sats'}
              </button>
            </div>
            <div class="balance-card__amount">
              {formatBalance()}
            </div>
            <div class="balance-card__secondary">
              {showSats() 
                ? `≈ ${toBTC(balance())} BTC`
                : `≈ ${balance().toLocaleString()} sats`
              }
            </div>
          </section>

          {/* Quick Actions */}
          <section class="quick-actions">
            <button 
              class="action-button action-button--send"
              onClick={handleSend}
              disabled={connectionStatus() !== 'connected'}
            >
              <svg class="action-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 19V5M5 12l7-7 7 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Send</span>
            </button>

            <button 
              class="action-button action-button--receive"
              onClick={handleReceive}
              disabled={connectionStatus() !== 'connected'}
            >
              <svg class="action-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 5v14M5 12l7 7 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Receive</span>
            </button>

            <button 
              class="action-button action-button--settings"
              onClick={handleSettings}
            >
              <svg class="action-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Settings</span>
            </button>
          </section>

          {/* Recent Transactions */}
          <section class="transactions-card">
            <h3 class="transactions-card__title">Recent Transactions</h3>
            
            <Show when={transactions().length > 0} fallback={
              <div class="empty-state">
                <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
                  <path d="M9 3v18M3 9h6M3 15h6" stroke-width="2"/>
                </svg>
                <h4 class="empty-state__title">No transactions yet</h4>
                <p class="empty-state__description">
                  Your transaction history will appear here once you start sending or receiving payments.
                </p>
              </div>
            }>
              <ul class="transactions-list">
                <For each={transactions()}>
                  {(tx) => (
                    <li class={`transaction-item transaction-item--${tx.type}`}>
                      <div class="transaction-item__icon-wrapper">
                        <svg 
                          class={`transaction-item__icon transaction-item__icon--${tx.type}`}
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor"
                        >
                          {tx.type === 'incoming' ? (
                            <path d="M12 5v14M5 12l7 7 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          ) : (
                            <path d="M12 19V5M5 12l7-7 7 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          )}
                        </svg>
                      </div>
                      
                      <div class="transaction-item__content">
                        <div class="transaction-item__details">
                          <span class="transaction-item__type">
                            {tx.type === 'incoming' ? 'Received' : 'Sent'}
                          </span>
                          {tx.description && (
                            <span class="transaction-item__description">{tx.description}</span>
                          )}
                        </div>
                        <span class="transaction-item__timestamp">
                          {formatTimestamp(tx.timestamp)}
                        </span>
                      </div>
                      
                      <div class="transaction-item__amount-wrapper">
                        <span class={`transaction-item__amount transaction-item__amount--${tx.type}`}>
                          {formatTxAmount(tx.amount, tx.type)}
                        </span>
                        <span class={`transaction-item__status transaction-item__status--${tx.status}`}>
                          {tx.status}
                        </span>
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>
        </div>
      </Show>
    </div>
  );
};

export default WalletDashboard;
