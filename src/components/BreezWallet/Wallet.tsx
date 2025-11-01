import { Component, Show, createSignal } from 'solid-js';
import { useBreezWallet } from './hooks/useBreezWallet';
import WalletSetup from './WalletSetup';
import WalletDashboard from './WalletDashboard';
import SendModal from './SendModal';
import ReceiveModal from './ReceiveModal';

const Wallet: Component = () => {
  const wallet = useBreezWallet();
  const [sendOpen, setSendOpen] = createSignal(false);
  const [receiveOpen, setReceiveOpen] = createSignal(false);

  const handleSendOpen = () => setSendOpen(true);
  const handleSendClose = () => setSendOpen(false);
  const handleReceiveOpen = () => setReceiveOpen(true);
  const handleReceiveClose = () => setReceiveOpen(false);

  return (
    <div class="wallet-container">
      <Show when={wallet.error}>
        <div class="wallet-error" role="alert">
          <p>Error initializing wallet: {wallet.error}</p>
        </div>
      </Show>

      <Show when={!wallet.hasWallet()} fallback={
        <Show when={wallet.connected()}>
          <WalletDashboard
            balance={wallet.balance()}
            address={wallet.address()}
            onSend={handleSendOpen}
            onReceive={handleReceiveOpen}
          />
        </Show>
      }>
        <WalletSetup />
      </Show>

      <Show when={sendOpen()}>
        <SendModal
          isOpen={sendOpen()}
          onClose={handleSendClose}
          balance={wallet.balance()}
          onSend={wallet.sendPayment}
        />
      </Show>

      <Show when={receiveOpen()}>
        <ReceiveModal
          isOpen={receiveOpen()}
          onClose={handleReceiveClose}
          address={wallet.address()}
          onGenerateInvoice={wallet.generateInvoice}
        />
      </Show>
    </div>
  );
};

export default Wallet;
