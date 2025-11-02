import { Component, For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import styles from './BreezWallet.module.scss';

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

  const cn = (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' ');

  const statusBadgeClass = createMemo(() =>
    cn(
      styles.badge,
      connectionStatus() === 'connected' && styles.success,
      connectionStatus() === 'connecting' && styles.pending,
      connectionStatus() === 'disconnected' && styles.failed,
    )
  );

  return (
    <div class={styles.dashboard}>
      <div class={styles.gridRow}>
        <section class={cn(styles.card, styles.gridCol12)}>
          <div class={styles.dashboardHeader}>
            <div>
              <h1>Breez Wallet</h1>
              <p class={styles.helperText}>
                Manage your Breez Lightning wallet balance and activity.
              </p>
            </div>
            <div class={styles.statusGroup}>
              <span class={statusBadgeClass()}>{connectionStatus()}</span>
            </div>
          </div>
        </section>

        <section class={cn(styles.card, styles.balanceCard)}>
          <header class={styles.balanceHeader}>
            <h2>Balance</h2>
            <div class={styles.balanceActions}>
              <button
                class={cn(styles.btn, styles.btnSecondary)}
                onClick={() => setShowSats(!showSats())}
                type="button"
              >
                {showSats() ? 'Show BTC' : 'Show Sats'}
              </button>
              <Show when={props.onRefresh}>
                <button
                  class={cn(styles.btn, styles.btnSecondary, isRefreshing() && styles.loading)}
                  onClick={handleRefresh}
                  disabled={isRefreshing()}
                  type="button"
                >
                  {isRefreshing() ? 'Refreshing…' : 'Refresh'}
                </button>
              </Show>
            </div>
          </header>

          <div class={styles.balanceDisplay}>
            <Show
              when={!isLoading()}
              fallback={
                <div class={styles.loading}>
                  <span class={styles.spinner} />
                  Loading balance…
                </div>
              }
            >
              <div class={styles.balance}>{formatBalance(props.balance)}</div>
              <div class={styles.balanceFiat}>Lightning wallet balance</div>
            </Show>
          </div>
        </section>

        <section class={cn(styles.card, styles.actionsCard)}>
          <h2 class={styles.sectionTitle}>Quick actions</h2>
          <div class={styles.quickActions}>
            <button
              class={cn(styles.btn, styles.btnPrimary, styles.btnIcon, styles.btnBlock)}
              onClick={props.onReceive}
              disabled={!props.isConnected}
              type="button"
            >
              <span aria-hidden="true">↓</span>
              Receive
            </button>
            <button
              class={cn(styles.btn, styles.btnPrimary, styles.btnIcon, styles.btnBlock)}
              onClick={props.onSend}
              disabled={!props.isConnected || props.balance === 0}
              type="button"
            >
              <span aria-hidden="true">↑</span>
              Send
            </button>
          </div>
        </section>

        <section class={cn(styles.card, styles.activityCard)}>
          <div class={styles.transactionsHeader}>
            <h2 class={styles.sectionTitle}>Recent transactions</h2>
            <button class={cn(styles.btn, styles.btnSecondary)} disabled type="button">
              View all
            </button>
          </div>

          <Show
            when={!isLoading()}
            fallback={
              <div class={styles.loadingContainer}>
                <div class={styles.loading}>
                  <span class={styles.spinner} />
                  Loading transactions…
                </div>
              </div>
            }
          >
            <Show
              when={transactions().length > 0}
              fallback={
                <div class={styles.emptyState}>
                  <p>No transactions yet</p>
                  <p class={styles.emptyStateSubtitle}>Start by receiving some sats!</p>
                </div>
              }
            >
              <div class={styles.txList}>
                <For each={transactions()}>
                  {(tx) => (
                    <div
                      class={cn(
                        styles.txItem,
                        tx.type === 'incoming' && styles.incoming,
                        tx.type === 'outgoing' && styles.outgoing,
                      )}
                    >
                      <div class={styles.txIcon} aria-hidden="true">
                        {tx.type === 'incoming' ? '↓' : '↑'}
                      </div>
                      <div class={styles.txMeta}>
                        <div class={styles.txTitle}>
                          {tx.description || (tx.type === 'incoming' ? 'Received' : 'Sent')}
                        </div>
                        <div class={styles.txSub}>{formatDate(tx.timestamp)}</div>
                      </div>
                      <div class={styles.txAmt}>
                        {tx.type === 'incoming' ? '+' : '-'}{formatBalance(tx.amount)}
                        <span
                          class={cn(
                            styles.badge,
                            tx.status === 'completed' && styles.success,
                            tx.status === 'pending' && styles.pending,
                            tx.status === 'failed' && styles.failed,
                          )}
                        >
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </section>
      </div>

      <section class={cn(styles.card, styles.gridCol12)}>
        <h2 class={styles.sectionTitle}>Node status</h2>
        <div class={styles.nodeStatusGrid}>
          <div class={styles.nodeStatusCard}>
            <span class={styles.label}>Connection</span>
            <span class={statusBadgeClass()}>
              {connectionStatus() === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div class={styles.nodeStatusCard}>
            <span class={styles.label}>Last sync</span>
            <span>Just now</span>
          </div>
          <div class={styles.nodeStatusCard}>
            <span class={styles.label}>Network</span>
            <span>Lightning</span>
          </div>
        </div>
      </section>

      <section class={cn(styles.card, styles.gridCol12, styles.helpSection)}>
        <h2 class={styles.sectionTitle}>Need help?</h2>
        <ul class={styles.helpList}>
          <li>Create or restore your wallet with your mnemonic phrase.</li>
          <li>Receive funds by generating a Lightning invoice.</li>
          <li>Send payments instantly with Lightning invoices or LNURL.</li>
          <li>Keep your mnemonic phrase safe – it is required to recover your wallet.</li>
        </ul>
      </section>
    </div>
  );
};

export default WalletDashboard;
