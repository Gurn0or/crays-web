import * as bip39 from 'bip39';

/**
 * Generate a 12-word BIP39 mnemonic phrase
 * @returns A 12-word mnemonic string
 */
export function generateMnemonic(): string {
  return bip39.generateMnemonic(128); // 128 bits = 12 words
}

/**
 * Generate a 24-word BIP39 mnemonic phrase
 * @returns A 24-word mnemonic string
 */
export function generateMnemonic24(): string {
  return bip39.generateMnemonic(256); // 256 bits = 24 words
}

/**
 * Validate a BIP39 mnemonic phrase
 * @param mnemonic - The mnemonic phrase to validate
 * @returns True if the mnemonic is valid, false otherwise
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Normalize a mnemonic phrase by trimming and converting to lowercase
 * @param mnemonic - The mnemonic phrase to normalize
 * @returns The normalized mnemonic string
 */
export function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Split a mnemonic phrase into an array of words
 * @param mnemonic - The mnemonic phrase to split
 * @returns An array of mnemonic words
 */
export function mnemonicToWords(mnemonic: string): string[] {
  return normalizeMnemonic(mnemonic).split(' ').filter(word => word.length > 0);
}

/**
 * Get the number of words in a mnemonic phrase
 * @param mnemonic - The mnemonic phrase to count
 * @returns The number of words in the mnemonic
 */
export function getMnemonicWordCount(mnemonic: string): number {
  return mnemonicToWords(mnemonic).length;
}

/**
 * Check if a mnemonic has a valid length (12 or 24 words)
 * @param mnemonic - The mnemonic phrase to check
 * @returns True if the mnemonic has 12 or 24 words, false otherwise
 */
export function isValidMnemonicLength(mnemonic: string): boolean {
  const wordCount = getMnemonicWordCount(mnemonic);
  return wordCount === 12 || wordCount === 24;
}
