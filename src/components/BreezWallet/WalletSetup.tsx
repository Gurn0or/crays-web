import { Component, createSignal, createMemo, For, Show } from 'solid-js';
import { useBreezWallet } from '../../contexts/BreezWalletContext';

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
  
  // Select random words for verification
  const selectVerificationWords = (words: string[]): VerificationWord[] => {
    const indices = new Set<number>();
    while (indices.size < 3) {
      indices.add(Math.floor(Math.random() * words.length));
    }
    return Array.from(indices)
      .sort((a, b) => a - b)
      .map(index => ({ index, word: '' }));
  };
  
  const handleModeSelect = (selectedMode: WalletMode) => {
    setMode(selectedMode);
    if (selectedMode === 'create') {
      const newMnemonic = generateMnemonic();
      setMnemonic(newMnemonic);
      setVerificationWords(selectVerificationWords(newMnemonic));
    }
    setCurrentStep('mnemonic');
  };
  
  const handleCopyWord = (index: number) => {
    const word = mnemonic()[index];
    navigator.clipboard.writeText(word);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  
  const handleCopyAll = () => {
    navigator.clipboard.writeText(mnemonic().join(' '));
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  
  const handleMnemonicConfirm = () => {
    setCurrentStep('verify');
  };
  
  const handleVerificationInput = (index: number, value: string) => {
    setUserInputs(prev => ({ ...prev, [index]: value }));
  };
  
  const handleVerificationSubmit = () => {
    const verification = verificationWords();
    const inputs = userInputs();
    const mnemonicArray = mnemonic();
    
    const isValid = verification.every(
      word => inputs[word.index]?.toLowerCase().trim() === mnemonicArray[word.index].toLowerCase()
    );
    
    if (isValid) {
      setError('');
      setCurrentStep('success');
    } else {
      setError('Incorrect words. Please try again.');
    }
  };
  
  const handleFinish = () => {
    // In a real implementation, save the wallet and navigate
    console.log('Wallet setup complete');
  };
  
  return (
    <div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div class="max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div class="mb-8">
          <div class="h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              class="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progress()}%` }}
            />
          </div>
          <p class="text-white/60 text-sm mt-2 text-center">
            Step {currentStepIndex() + 1} of {steps.length}
          </p>
        </div>
        
        {/* Mode Selection */}
        <Show when={currentStep() === 'mode'}>
          <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
            <h2 class="text-3xl font-bold text-white mb-6 text-center">
              Wallet Setup
            </h2>
            <p class="text-white/80 mb-8 text-center">
              Choose how you'd like to set up your Lightning wallet
            </p>
            
            <div class="space-y-4">
              <button
                onClick={() => handleModeSelect('create')}
                class="w-full p-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl text-white font-semibold text-lg transition-all duration-200 transform hover:scale-105"
              >
                <div class="flex items-center justify-center gap-3">
                  <span>🌟</span>
                  <span>Create New Wallet</span>
                </div>
                <p class="text-sm text-white/80 mt-2">
                  Generate a new wallet with a recovery phrase
                </p>
              </button>
              
              <button
                onClick={() => handleModeSelect('restore')}
                class="w-full p-6 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold text-lg transition-all duration-200 transform hover:scale-105"
              >
                <div class="flex items-center justify-center gap-3">
                  <span>🔄</span>
                  <span>Restore Existing Wallet</span>
                </div>
                <p class="text-sm text-white/80 mt-2">
                  Import your wallet using a recovery phrase
                </p>
              </button>
            </div>
          </div>
        </Show>
        
        {/* Mnemonic Display */}
        <Show when={currentStep() === 'mnemonic' && mode() === 'create'}>
          <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
            <h2 class="text-3xl font-bold text-white mb-6 text-center">
              Your Recovery Phrase
            </h2>
            <p class="text-white/80 mb-6 text-center">
              Write down these 12 words in order. You'll need them to recover your wallet.
            </p>
            
            <div class="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <p class="text-red-200 text-sm">
                ⚠️ <strong>Important:</strong> Never share your recovery phrase with anyone. Store it securely offline.
              </p>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <For each={mnemonic()}>
                {(word, index) => (
                  <div class="bg-white/5 rounded-lg p-3 flex items-center justify-between group">
                    <span class="text-white/60 text-sm mr-2">{index() + 1}.</span>
                    <span class="text-white font-mono flex-1">{word}</span>
                    <button
                      onClick={() => handleCopyWord(index())}
                      class="opacity-0 group-hover:opacity-100 transition-opacity text-white/60 hover:text-white"
                    >
                      {copiedIndex() === index() ? '✓' : '📋'}
                    </button>
                  </div>
                )}
              </For>
            </div>
            
            <div class="flex gap-4">
              <button
                onClick={handleCopyAll}
                class="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-semibold transition-colors"
              >
                {copiedIndex() === -1 ? '✓ Copied' : '📋 Copy All'}
              </button>
              <button
                onClick={handleMnemonicConfirm}
                class="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg text-white font-semibold transition-colors"
              >
                I've Written It Down
              </button>
            </div>
          </div>
        </Show>
        
        {/* Verification */}
        <Show when={currentStep() === 'verify'}>
          <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
            <h2 class="text-3xl font-bold text-white mb-6 text-center">
              Verify Your Phrase
            </h2>
            <p class="text-white/80 mb-6 text-center">
              Enter the following words from your recovery phrase to confirm you've saved it correctly.
            </p>
            
            <Show when={error()}>
              <div class="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
                <p class="text-red-200">{error()}</p>
              </div>
            </Show>
            
            <div class="space-y-4 mb-6">
              <For each={verificationWords()}>
                {(word) => (
                  <div>
                    <label class="text-white/80 mb-2 block">
                      Word #{word.index + 1}
                    </label>
                    <input
                      type="text"
                      value={userInputs()[word.index] || ''}
                      onInput={(e) => handleVerificationInput(word.index, e.currentTarget.value)}
                      class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Enter word"
                    />
                  </div>
                )}
              </For>
            </div>
            
            <button
              onClick={handleVerificationSubmit}
              class="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg text-white font-semibold transition-colors"
            >
              Verify
            </button>
          </div>
        </Show>
        
        {/* Success */}
        <Show when={currentStep() === 'success'}>
          <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl text-center">
            <div class="text-6xl mb-6">🎉</div>
            <h2 class="text-3xl font-bold text-white mb-4">
              Wallet Created Successfully!
            </h2>
            <p class="text-white/80 mb-8">
              Your Lightning wallet is ready to use. You can now send and receive Bitcoin payments.
            </p>
            
            <div class="bg-white/5 rounded-lg p-6 mb-8">
              <p class="text-white/60 text-sm mb-2">Current Balance</p>
              <p class="text-4xl font-bold text-white">
                {balance().toLocaleString()} sats
              </p>
            </div>
            
            <button
              onClick={handleFinish}
              class="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg text-white font-semibold transition-colors"
            >
              Get Started
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default WalletSetup;
