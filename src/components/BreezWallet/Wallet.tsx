import { Component, Match, Show, Switch, createMemo, createSignal } from 'solid-js';
import { useBreezWallet } from '../../contexts/BreezWalletContext';
import WalletSetup from './WalletSetup';
import WalletDashboard from './WalletDashboard';
import SendModal from './SendModal';
import ReceiveModal from './ReceiveModal';

import './Wallet.css';

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
    <section class="wallet-container">
      <header class="wallet-header">
        <div>
          <h1>Breez Lightning Wallet</h1>
          <p class="wallet-subtitle">
            Manage your Lightning balance, send payments, and receive sats directly inside Crays.
          </p>
        </div>
      </header>

      <Switch>
        <Match when={walletState.error}>
          <div class="wallet-error" role="alert">
            <h2>We ran into a problem</h2>
            <p>{walletState.error}</p>
          </div>
        </Match>

        <Match when={!walletState.isInitialized}>
          <div class="wallet-loading" role="status" aria-live="polite">
            <div class="loading-spinner" />
            <p>Preparing your Breez wallet…</p>
          </div>
        </Match>

        <Match when={!hasWallet()}>
          <WalletSetup />
        </Match>

        <Match when={hasWallet()}>
          <WalletDashboard
            balance={walletBalance()}
            isConnected={isConnected()}
            onSend={handleSendOpen}
            onReceive={handleReceiveOpen}
            onRefresh={walletActions.refreshBalance}
          />
        </Match>
      </Switch>

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
    </section>
  );
};

export default Wallet;
