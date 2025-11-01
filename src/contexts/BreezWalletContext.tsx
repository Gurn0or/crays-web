import { createContext, useContext, ParentComponent, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { createEffect } from 'solid-js';

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
      
      // Check if wallet exists
      const walletExists = localStorage.getItem('breez_wallet_exists');
      if (walletExists) {
        setState('hasWallet', true);
      }
    } catch (error) {
      console.error('Failed to initialize Breez SDK:', error);
      setState('error', error instanceof Error ? error.message : 'Initialization failed');
    }
  });

  // Create effect for event listeners
  createEffect(() => {
    if (!state.isInitialized) return;

    // Set up event listeners for wallet events
    const handleBalanceUpdate = (event: CustomEvent) => {
      setState('balance', event.detail.balance);
    };

    const handleConnectionChange = (event: CustomEvent) => {
      setState('isConnected', event.detail.connected);
    };

    const handleError = (event: CustomEvent) => {
      setState('error', event.detail.error);
    };

    window.addEventListener('breez:balance', handleBalanceUpdate as EventListener);
    window.addEventListener('breez:connection', handleConnectionChange as EventListener);
    window.addEventListener('breez:error', handleError as EventListener);

    // Cleanup function
    return () => {
      window.removeEventListener('breez:balance', handleBalanceUpdate as EventListener);
      window.removeEventListener('breez:connection', handleConnectionChange as EventListener);
      window.removeEventListener('breez:error', handleError as EventListener);
    };
  });

  // Actions
  const actions: BreezWalletActions = {
    createWallet: async () => {
      try {
        setState('error', null);
        
        // Generate mnemonic (24 words)
        const mnemonic = generateMnemonic();
        
        // Store wallet creation flag
        localStorage.setItem('breez_wallet_exists', 'true');
        
        setState({
          mnemonic,
          hasWallet: true,
          isConnected: true,
        });
        
        return { mnemonic };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create wallet';
        setState('error', errorMessage);
        throw error;
      }
    },

    restoreWallet: async (mnemonic: string) => {
      try {
        setState('error', null);
        
        // Validate mnemonic
        if (!validateMnemonic(mnemonic)) {
          throw new Error('Invalid mnemonic phrase');
        }
        
        // Restore wallet from mnemonic
        localStorage.setItem('breez_wallet_exists', 'true');
        
        setState({
          mnemonic,
          hasWallet: true,
          isConnected: true,
        });
        
        // Refresh balance after restore
        await actions.refreshBalance();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to restore wallet';
        setState('error', errorMessage);
        throw error;
      }
    },

    disconnect: async () => {
      try {
        setState('error', null);
        
        // Disconnect from Breez node
        setState({
          isConnected: false,
          mnemonic: null,
          balance: 0,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect';
        setState('error', errorMessage);
        throw error;
      }
    },

    refreshBalance: async () => {
      try {
        setState('error', null);
        
        if (!state.isConnected) {
          throw new Error('Wallet not connected');
        }
        
        // Fetch current balance from Breez SDK
        const balance = await fetchBalance();
        setState('balance', balance);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to refresh balance';
        setState('error', errorMessage);
        throw error;
      }
    },

    getBalance: async () => {
      try {
        if (!state.isConnected) {
          return 0;
        }
        
        const balance = await fetchBalance();
        return balance;
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
