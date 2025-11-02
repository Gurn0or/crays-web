import { Component, createSignal, createMemo, For, Show } from 'solid-js';
import styles from './BreezWallet.module.scss';

type WalletMode = 'select' | 'create' | 'restore';
type Step = 'mode' | 'mnemonic' | 'verify' | 'success';

interface VerificationWord {
  index: number;
  word: string;
}

const WalletSetup: Component = () => {
  
  // State management
  const [mode, setMode] = createSignal<WalletMode>('select');
  const [currentStep, setCurrentStep] = createSignal<Step>('mode');
  const [mnemonic, setMnemonic] = createSignal<string[]>([]);
  const [verificationWords, setVerificationWords] = createSignal<VerificationWord[]>([]);
  const [userInputs, setUserInputs] = createSignal<Record<string, string>>({});
  const [error, setError] = createSignal<string>('');
  const [copiedIndex, setCopiedIndex] = createSignal<number | null>(null);
  const [balance, setBalance] = createSignal<number>(0);
  
  // Progress indicator
  const steps: Step[] = ['mode', 'mnemonic', 'verify', 'success'];
  const currentStepIndex = createMemo(() => steps.indexOf(currentStep()));
  const progress = createMemo(() => ((currentStepIndex() + 1) / steps.length) * 100);
  
  // Generate mnemonic (mock implementation - replace with actual Breez SDK)
  const generateMnemonic = (): string[] => {
    const words = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent',
      'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident',
      'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire',
      'across', 'act', 'action', 'actor', 'actress', 'actual'
    ];
    return Array.from({ length: 12 }, () => 
      words[Math.floor(Math.random() * words.length)]
    );
  };
  
  // Get random words for verification
  const getVerificationWords = (): VerificationWord[] => {
    const indices = new Set<number>();
    while (indices.size < 3) {
      indices.add(Math.floor(Math.random() * 12));
    }
    return Array.from(indices)
      .sort((a, b) => a - b)
      .map(index => ({ index, word: mnemonic()[index] }));
  };
  
  // Handle mode selection
  const handleModeSelect = (selectedMode: WalletMode) => {
    setMode(selectedMode);
    if (selectedMode === 'create') {
      setMnemonic(generateMnemonic());
      setCurrentStep('mnemonic');
    } else if (selectedMode === 'restore') {
      // For restore, go directly to verification
      setCurrentStep('verify');
    }
  };
  
  // Handle mnemonic confirmation
  const handleMnemonicConfirmed = () => {
    setVerificationWords(getVerificationWords());
    setCurrentStep('verify');
  };
  
  // Copy mnemonic word
  const copyWord = (word: string, index: number) => {
    navigator.clipboard.writeText(word);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  
  // Handle verification
  const handleVerification = () => {
    setError('');
    const allCorrect = verificationWords().every(
      ({ index, word }) => userInputs()[index.toString()] === word
    );
    
    if (allCorrect) {
      setCurrentStep('success');
      // Initialize wallet balance (mock)
      setBalance(0);
    } else {
      setError('The words you entered do not match. Please try again.');
    }
  };
  
  // Handle input change
  const handleInputChange = (index: number, value: string) => {
    setUserInputs({ ...userInputs(), [index.toString()]: value });
  };
  
  return (
    <div class={styles.walletSetup}>
      {/* Progress bar */}
      <div class={styles.progressContainer}>
        <div
          class={styles.progressBar}
          style={`width: ${progress()}%`}
        />
      </div>

      {/* Mode Selection */}
      <Show when={currentStep() === 'mode'}>
        <div class={styles.stepContainer}>
          <h2>Set Up Your Lightning Wallet</h2>
          <p>Choose how you'd like to set up your wallet</p>

          <div class={styles.modeCards}>
            <button
              class={styles.modeCard}
              onClick={() => handleModeSelect('create')}
            >
              <div class={styles.modeIcon}>🔐</div>
              <h3>Create New Wallet</h3>
              <p>Generate a new wallet with a secure recovery phrase</p>
            </button>

            <button
              class={styles.modeCard}
              onClick={() => handleModeSelect('restore')}
            >
              <div class={styles.modeIcon}>🔄</div>
              <h3>Restore Wallet</h3>
              <p>Restore your wallet using your recovery phrase</p>
            </button>
          </div>
        </div>
      </Show>
      
      {/* Mnemonic Display */}
      <Show when={currentStep() === 'mnemonic'}>
        <div class={styles.stepContainer}>
          <h2>Your Recovery Phrase</h2>
          <p class={styles.warning}>
            ⚠️ Write down these words in order. You'll need them to recover your wallet.
          </p>

          <div class={styles.mnemonicGrid}>
            <For each={mnemonic()}>
              {(word, index) => (
                <div class={styles.mnemonicWord}>
                  <span class={styles.wordNumber}>{index() + 1}</span>
                  <span class={styles.wordText}>{word}</span>
                  <button
                    class={styles.copyBtn}
                    onClick={() => copyWord(word, index())}
                    title="Copy word"
                  >
                    {copiedIndex() === index() ? '✓' : '📋'}
                  </button>
                </div>
              )}
            </For>
          </div>

          <button
            class={styles.primaryBtn}
            onClick={handleMnemonicConfirmed}
          >
            I've Written It Down
          </button>
        </div>
      </Show>

      {/* Verification */}
      <Show when={currentStep() === 'verify'}>
        <div class={styles.stepContainer}>
          <h2>Verify Your Recovery Phrase</h2>
          <p>Enter the following words from your recovery phrase:</p>

          <div class={styles.verificationInputs}>
            <For each={verificationWords()}>
              {({ index, word }) => (
                <div class={styles.verificationField}>
                  <label>Word #{index + 1}</label>
                  <input
                    type="text"
                    value={userInputs()[index.toString()] || ''}
                    onInput={(e) => handleInputChange(index, e.currentTarget.value)}
                    placeholder="Enter word"
                  />
                </div>
              )}
            </For>
          </div>

          <Show when={error()}>
            <div class={styles.errorMessage}>{error()}</div>
          </Show>

          <button
            class={styles.primaryBtn}
            onClick={handleVerification}
          >
            Verify & Continue
          </button>
        </div>
      </Show>

      {/* Success */}
      <Show when={currentStep() === 'success'}>
        <div class={styles.stepContainer}>
          <div class={styles.successIcon}>✅</div>
          <h2>Wallet Created Successfully!</h2>
          <p>Your Lightning wallet is ready to use</p>

          <div class={styles.balanceDisplay}>
            <span class={styles.balanceLabel}>Current Balance</span>
            <span class={styles.balanceAmount}>{balance()} sats</span>
          </div>

          <button
            class={styles.primaryBtn}
            onClick={() => {/* Navigate to wallet */}}
          >
            Go to Wallet
          </button>
        </div>
      </Show>
    </div>
  );
};

export default WalletSetup;
