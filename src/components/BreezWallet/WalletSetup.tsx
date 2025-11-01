import { Component, createSignal, createMemo, For, Show } from 'solid-js';
import { useBreezWallet } from '../../hooks/useBreezWallet';

type WalletMode = 'select' | 'create' | 'restore';
type Step = 'mode' | 'mnemonic' | 'verify' | 'success';

interface VerificationWord {
  index: number;
  word: string;
}

const WalletSetup: Component = () => {
  const wallet = useBreezWallet();
  
  // State management
  const [mode, setMode] = createSignal<WalletMode>('select');
  const [currentStep, setCurrentStep] = createSignal<Step>('mode');
  const [mnemonic, setMnemonic] = createSignal<string[]>([]);
  const [verificationWords, setVerificationWords] = createSignal<VerificationWord[]>([]);
  const [userInputs, setUserInputs] = createSignal<Record<number, string>>({});
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
    return words.slice(0, 12);
  };

  // Select 3 random words for verification
  const selectVerificationWords = (words: string[]): VerificationWord[] => {
    const indices = new Set<number>();
    while (indices.size < 3) {
      indices.add(Math.floor(Math.random() * words.length));
    }
    return Array.from(indices)
      .sort((a, b) => a - b)
      .map(index => ({ index, word: words[index] }));
  };

  // Handle mode selection
  const handleModeSelect = (selectedMode: 'create' | 'restore') => {
    setMode(selectedMode);
    setError('');
    
    if (selectedMode === 'create') {
      const words = generateMnemonic();
      setMnemonic(words);
      setCurrentStep('mnemonic');
    } else {
      setError('Restore functionality coming soon');
    }
  };

  // Copy word to clipboard
  const copyToClipboard = async (word: string, index: number) => {
    try {
      await navigator.clipboard.writeText(word);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  // Proceed to verification
  const proceedToVerification = () => {
    setError('');
    const verification = selectVerificationWords(mnemonic());
    setVerificationWords(verification);
    setUserInputs({});
    setCurrentStep('verify');
  };

  // Verify user inputs
  const handleVerification = () => {
    setError('');
    const inputs = userInputs();
    const verification = verificationWords();
    
    for (const { index, word } of verification) {
      if (inputs[index]?.toLowerCase().trim() !== word.toLowerCase().trim()) {
        setError(`Word ${index + 1} is incorrect. Please try again.`);
        return;
      }
    }
    
    // Verification successful
    initializeWallet();
  };

  // Initialize wallet (mock implementation)
  const initializeWallet = async () => {
    try {
      setError('');
      // In real implementation, use wallet.initialize(mnemonic().join(' '))
      // For now, simulate success
      setBalance(0);
      setCurrentStep('success');
    } catch (err) {
      setError('Failed to initialize wallet. Please try again.');
    }
  };

  // Update user input for verification
  const updateInput = (index: number, value: string) => {
    setUserInputs(prev => ({ ...prev, [index]: value }));
  };

  // Reset to start
  const reset = () => {
    setMode('select');
    setCurrentStep('mode');
    setMnemonic([]);
    setVerificationWords([]);
    setUserInputs({});
    setError('');
    setCopiedIndex(null);
  };

  return (
    <div class="wallet-setup">
      {/* Progress Indicator */}
      <div class="progress-container">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            style={{ width: `${progress()}%` }}
          />
        </div>
        <div class="progress-steps">
          <For each={steps}>
            {(step, index) => (
              <div 
                class="progress-step"
                classList={{
                  'active': index() <= currentStepIndex(),
                  'current': index() === currentStepIndex()
                }}
              >
                <div class="step-number">{index() + 1}</div>
                <div class="step-label">
                  {step.charAt(0).toUpperCase() + step.slice(1)}
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Error Display */}
      <Show when={error()}>
        <div class="error-message" role="alert">
          <span class="error-icon">⚠️</span>
          {error()}
        </div>
      </Show>

      {/* Mode Selection */}
      <Show when={currentStep() === 'mode'}>
        <div class="mode-selection">
          <h1>Breez Wallet Setup</h1>
          <p class="subtitle">Choose how you want to set up your Lightning wallet</p>
          
          <div class="mode-options">
            <button 
              class="mode-button create"
              onClick={() => handleModeSelect('create')}
            >
              <div class="mode-icon">🆕</div>
              <h3>Create New Wallet</h3>
              <p>Generate a new wallet with a secure recovery phrase</p>
            </button>
            
            <button 
              class="mode-button restore"
              onClick={() => handleModeSelect('restore')}
            >
              <div class="mode-icon">🔄</div>
              <h3>Restore Wallet</h3>
              <p>Recover your existing wallet using your recovery phrase</p>
            </button>
          </div>
        </div>
      </Show>

      {/* Mnemonic Display */}
      <Show when={currentStep() === 'mnemonic'}>
        <div class="mnemonic-display">
          <h2>Your Recovery Phrase</h2>
          <p class="warning">
            ⚠️ Write down these words in order and store them safely. 
            You'll need them to recover your wallet.
          </p>
          
          <div class="mnemonic-grid">
            <For each={mnemonic()}>
              {(word, index) => (
                <div class="mnemonic-word-card">
                  <span class="word-number">{index() + 1}</span>
                  <span class="word-text">{word}</span>
                  <button 
                    class="copy-button"
                    onClick={() => copyToClipboard(word, index())}
                    title="Copy word"
                  >
                    {copiedIndex() === index() ? '✓' : '📋'}
                  </button>
                </div>
              )}
            </For>
          </div>
          
          <div class="mnemonic-actions">
            <button class="secondary-button" onClick={reset}>
              Back
            </button>
            <button class="primary-button" onClick={proceedToVerification}>
              I've Written It Down
            </button>
          </div>
        </div>
      </Show>

      {/* Verification Step */}
      <Show when={currentStep() === 'verify'}>
        <div class="verification-step">
          <h2>Verify Your Recovery Phrase</h2>
          <p>To make sure you wrote it down correctly, please enter these words:</p>
          
          <div class="verification-inputs">
            <For each={verificationWords()}>
              {({ index, word }) => (
                <div class="verification-field">
                  <label for={`word-${index}`}>
                    Word #{index + 1}
                  </label>
                  <input
                    id={`word-${index}`}
                    type="text"
                    placeholder="Enter word"
                    value={userInputs()[index] || ''}
                    onInput={(e) => updateInput(index, e.currentTarget.value)}
                    autocomplete="off"
                  />
                </div>
              )}
            </For>
          </div>
          
          <div class="verification-actions">
            <button 
              class="secondary-button" 
              onClick={() => setCurrentStep('mnemonic')}
            >
              Back to Phrase
            </button>
            <button 
              class="primary-button" 
              onClick={handleVerification}
              disabled={verificationWords().some(({ index }) => !userInputs()[index])}
            >
              Verify & Continue
            </button>
          </div>
        </div>
      </Show>

      {/* Success State */}
      <Show when={currentStep() === 'success'}>
        <div class="success-state">
          <div class="success-icon">✅</div>
          <h2>Wallet Created Successfully!</h2>
          <p>Your Breez Lightning wallet is ready to use</p>
          
          <div class="balance-display">
            <div class="balance-label">Current Balance</div>
            <div class="balance-amount">
              <span class="balance-value">{balance()}</span>
              <span class="balance-unit">sats</span>
            </div>
            <div class="balance-btc">
              ≈ {(balance() / 100000000).toFixed(8)} BTC
            </div>
          </div>
          
          <div class="success-actions">
            <button class="primary-button" onClick={() => window.location.href = '/wallet'}>
              Open Wallet
            </button>
            <button class="secondary-button" onClick={reset}>
              Create Another Wallet
            </button>
          </div>
          
          <div class="security-reminder">
            <h3>🔒 Security Reminder</h3>
            <ul>
              <li>Never share your recovery phrase with anyone</li>
              <li>Store it in a safe, offline location</li>
              <li>Breez will never ask for your recovery phrase</li>
            </ul>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default WalletSetup;
