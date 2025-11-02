import { Component, For, Show, createEffect, createMemo, createSignal } from 'solid-js';

interface Transaction {
  id: string;
  type: 'incoming' | 'outgoing';
  amount: number;
  timestamp: Date;
  status: 'completed' | 'pending' | 'failed';
  description?: string;
}

interface WalletDashboardProps {
  balance: number;
  isConnected: boolean;
  onSend: () => void;
  onReceive: () => void;
  onRefresh?: () => Promise<void> | void;
}

const WalletDashboard: Component<WalletDashboardProps> = (props) => {
  const [showSats, setShowSats] = createSignal(true);
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [transactions] = createSignal<Transaction[]>([]);
  const [connectionStatus, setConnectionStatus] = createSignal<'connected' | 'disconnected' | 'connecting'>('connecting');

  createEffect(() => {
    setConnectionStatus(props.isConnected ? 'connected' : 'disconnected');
  });

  const isLoading = createMemo(() => connectionStatus() === 'connecting' || isRefreshing());

  const formatBalance = (sats: number): string => {
    if (showSats()) {
      return `${sats.toLocaleString()} sats`;
    }
    const btc = sats / 100000000;
    return `${btc.toFixed(8)} BTC`;
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  const handleRefresh = async () => {
    if (!props.onRefresh) return;
    try {
      setIsRefreshing(true);
      await props.onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div class="wallet-dashboard">
      <div class="dashboard-header">
        <h1>Breez Wallet</h1>
        <div class="connection-status">
          <span class={`status-indicator ${connectionStatus()}`}></span>
          <span class="status-text">{connectionStatus()}</span>
        </div>
      </div>

      <div class="balance-card">
        <div class="balance-header">
          <h2>Balance</h2>
          <div class="balance-actions">
            <button
              class="toggle-unit-btn"
              onClick={() => setShowSats(!showSats())}
            >
              {showSats() ? 'Show BTC' : 'Show Sats'}
            </button>
            <Show when={props.onRefresh}>
              <button
                class="refresh-btn"
                classList={{ loading: isRefreshing() }}
                onClick={handleRefresh}
                disabled={isRefreshing()}
              >
                {isRefreshing() ? 'Refreshing…' : 'Refresh'}
              </button>
            </Show>
          </div>
        </div>
        <div class="balance-amount">
          <Show
            when={!isLoading()}
            fallback={<div class="loading-spinner">Loading...</div>}
          >
            {formatBalance(props.balance)}
          </Show>
        </div>
      </div>

      <div class="quick-actions">
        <button
          class="action-btn primary"
          onClick={props.onReceive}
          disabled={!props.isConnected}
        >
          <span class="icon">↓</span>
          Receive
        </button>
        <button
          class="action-btn primary"
          onClick={props.onSend}
          disabled={!props.isConnected || props.balance === 0}
        >
          <span class="icon">↑</span>
          Send
        </button>
      </div>

      <div class="transactions-section">
        <div class="section-header">
          <h2>Recent Transactions</h2>
          <button class="view-all-btn" disabled>
            View All
          </button>
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

      <div class="node-info">
        <h2>Node Status</h2>
        <div class="status-cards">
          <div class="status-card">
            <span class="status-label">Connection</span>
            <span class={`status-value ${connectionStatus()}`}>
              {connectionStatus() === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div class="status-card">
            <span class="status-label">Last Sync</span>
            <span class="status-value">Just now</span>
          </div>
          <div class="status-card">
            <span class="status-label">Network</span>
            <span class="status-value">Lightning</span>
          </div>
        </div>
      </div>

      <div class="help-section">
        <h2>Need Help?</h2>
        <ul>
          <li>• Create a new wallet or restore an existing one using your mnemonic phrase.</li>
          <li>• Receive funds by generating a Lightning invoice.</li>
          <li>• Send payments instantly with Lightning invoices or LNURL.</li>
          <li>• Keep your mnemonic phrase safe – it's the only way to recover your wallet.</li>
        </ul>
      </div>
    </div>
  );
};

export default WalletDashboard;
