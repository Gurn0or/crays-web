import { Component, Show, createMemo, createSignal } from 'solid-js';
import { useBreezWallet } from '../../contexts/BreezWalletContext';
import WalletSetup from './WalletSetup';
import WalletDashboard from './WalletDashboard';
import SendModal from './SendModal';
import ReceiveModal from './ReceiveModal';
import styles from './BreezWallet.module.scss';

const Wallet: Component = () => {
  const [walletState, walletActions] = useBreezWallet();
  const [sendOpen, setSendOpen] = createSignal(false);
  const [receiveOpen, setReceiveOpen] = createSignal(false);

  const hasWallet = createMemo(() => walletState.hasWallet);
  const isConnected = createMemo(() => walletState.isConnected);
  const walletBalance = createMemo(() => walletState.balance ?? 0);

  const handleSendOpen = () => setSendOpen(true);
  const handleSendClose = () => setSendOpen(false);
  const handleReceiveOpen = () => setReceiveOpen(true);
  const handleReceiveClose = () => setReceiveOpen(false);

  return (
    <div class={styles.walletRoot}>
      <Show when={walletState.error}>
        <div class={styles.walletError} role="alert">
          <p class={styles.errorText}>Error initializing wallet: {walletState.error}</p>
        </div>
      </Show>

      <Show
        when={hasWallet()}
        fallback={<WalletSetup />}
      >
        <WalletDashboard
          balance={walletBalance()}
          isConnected={isConnected()}
          onSend={handleSendOpen}
          onReceive={handleReceiveOpen}
          onRefresh={walletActions.refreshBalance}
        />
      </Show>

      <Show when={sendOpen()}>
        <SendModal
          isOpen={sendOpen()}
          onClose={handleSendClose}
          balanceSats={walletBalance()}
        />
      </Show>

      <Show when={receiveOpen()}>
        <ReceiveModal
          isOpen={receiveOpen()}
          onClose={handleReceiveClose}
        />
      </Show>
    </div>
  );
};

export default Wallet;
