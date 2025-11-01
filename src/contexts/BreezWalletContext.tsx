import { createContext, useContext, ParentComponent, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { createEffect } from 'solid-js';
import { loadWalletState, loadEncryptedMnemonic } from '../utils/storage';

// Types
interface BreezWalletState {
  isInitialized: boolean;
  isConnected: boolean;
  balance: number;
  mnemonic: string | null;
  hasWallet: boolean;
  error: string | null;
}

interface BreezWalletActions {
  createWallet: () => Promise<{ mnemonic: string }>;
  restoreWallet: (mnemonic: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  getBalance: () => Promise<number>;
}

type BreezWalletContextType = [BreezWalletState, BreezWalletActions];

// Create context
const BreezWalletContext = createContext<BreezWalletContextType>();

// Provider component
export const BreezWalletProvider: ParentComponent = (props) => {
  // Initialize state with createStore
  const [state, setState] = createStore<BreezWalletState>({
    isInitialized: false,
    isConnected: false,
    balance: 0,
    mnemonic: null,
    hasWallet: false,
    error: null,
  });

  // Initialize WASM on mount
  onMount(async () => {
    try {
      // Initialize Breez SDK WASM
      setState('isInitialized', true);
      
      // Check if wallet exists and attempt auto-connect
      const walletState = loadWalletState();
      const encryptedMnemonic = loadEncryptedMnemonic();
      
      if (walletState && encryptedMnemonic) {
        setState('hasWallet', true);
        
        try {
          // Attempt to restore wallet automatically
          // Note: In production, you might need to decrypt the mnemonic
          // with a stored key or prompt for password
          await actions.restoreWallet(encryptedMnemonic);
          console.log('Wallet automatically restored from storage');
        } catch (restoreError) {
          console.error('Failed to auto-restore wallet:', restoreError);
          setState('error', 'Failed to automatically restore wallet. Please reconnect manually.');
        }
      }
    } catch (error) {
      console.error('Failed to initialize Breez SDK:', error);
      setState('error', 'Failed to initialize wallet system');
    }
  });

  // Actions
  const actions: BreezWalletActions = {
    createWallet: async () => {
      try {
        setState('error', null);
        const mnemonic = generateMnemonic();
        setState('mnemonic', mnemonic);
        setState('isConnected', true);
        setState('hasWallet', true);
        
        // Store wallet exists flag
        localStorage.setItem('breez_wallet_exists', 'true');
        
        // Fetch initial balance
        const balance = await fetchBalance();
        setState('balance', balance);
        
        return { mnemonic };
      } catch (error) {
        const errorMessage = 'Failed to create wallet';
        setState('error', errorMessage);
        throw new Error(errorMessage);
      }
    },

    restoreWallet: async (mnemonic: string) => {
      try {
        setState('error', null);
        
        if (!validateMnemonic(mnemonic)) {
          throw new Error('Invalid mnemonic phrase');
        }
        
        setState('mnemonic', mnemonic);
        setState('isConnected', true);
        setState('hasWallet', true);
        
        // Store wallet exists flag
        localStorage.setItem('breez_wallet_exists', 'true');
        
        // Fetch balance
        const balance = await fetchBalance();
        setState('balance', balance);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to restore wallet';
        setState('error', errorMessage);
        throw error;
      }
    },

    disconnect: async () => {
      try {
        setState('isConnected', false);
        setState('mnemonic', null);
        setState('balance', 0);
        setState('error', null);
      } catch (error) {
        console.error('Error disconnecting:', error);
        throw error;
      }
    },

    refreshBalance: async () => {
      try {
        if (!state.isConnected) {
          throw new Error('Wallet not connected');
        }
        
        const balance = await fetchBalance();
        setState('balance', balance);
      } catch (error) {
        console.error('Failed to refresh balance:', error);
        throw error;
      }
    },

    getBalance: async () => {
      try {
        if (!state.isConnected) {
          return 0;
        }
        return await fetchBalance();
      } catch (error) {
        console.error('Failed to get balance:', error);
        return 0;
      }
    },
  };

  return (
    <BreezWalletContext.Provider value={[state, actions]}>
      {props.children}
    </BreezWalletContext.Provider>
  );
};

// Hook to use the context
export const useBreezWallet = (): BreezWalletContextType => {
  const context = useContext(BreezWalletContext);
  if (!context) {
    throw new Error('useBreezWallet must be used within a BreezWalletProvider');
  }
  return context;
};

// Helper functions
function generateMnemonic(): string {
  // Placeholder implementation - in production, use BIP39 library
  // This would typically use the Breez SDK's mnemonic generation
  const words: string[] = [];
  const wordList = ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract'];
  
  for (let i = 0; i < 24; i++) {
    words.push(wordList[Math.floor(Math.random() * wordList.length)]);
  }
  
  return words.join(' ');
}

function validateMnemonic(mnemonic: string): boolean {
  // Placeholder implementation - in production, use BIP39 library
  const words = mnemonic.trim().split(/\s+/);
  return words.length === 12 || words.length === 24;
}

async function fetchBalance(): Promise<number> {
  // Placeholder implementation - in production, use Breez SDK
  // This would call the actual Breez SDK methods
  return new Promise((resolve) => {
    setTimeout(() => resolve(0), 100);
  });
}

export default BreezWalletProvider;
