// storage.ts - Wallet storage utilities for persisting encrypted wallet data

import type { EncryptedData } from './encryption';

const ENCRYPTED_MNEMONIC_KEY = 'breez_wallet_encrypted';
const WALLET_STATE_KEY = 'breez_wallet_state';

export interface WalletState {
  hasWallet: boolean;
  lastConnected?: number;
}

/**
 * Saves encrypted mnemonic to localStorage
 * @param encrypted - The encrypted wallet data
 * @returns boolean indicating success
 */
export function saveEncryptedMnemonic(encrypted: EncryptedData): boolean {
  try {
    localStorage.setItem(ENCRYPTED_MNEMONIC_KEY, JSON.stringify(encrypted));
    return true;
  } catch (error) {
    console.error('Failed to save encrypted mnemonic:', error);
    return false;
  }
}

/**
 * Retrieves encrypted mnemonic from localStorage
 * @returns The encrypted data or null if not found
 */
export function loadEncryptedMnemonic(): EncryptedData | null {
  try {
    const data = localStorage.getItem(ENCRYPTED_MNEMONIC_KEY);
    if (!data) return null;
    return JSON.parse(data) as EncryptedData;
  } catch (error) {
    console.error('Failed to load encrypted mnemonic:', error);
    return null;
  }
}

/**
 * Removes encrypted mnemonic from localStorage
 * @returns boolean indicating success
 */
export function removeEncryptedMnemonic(): boolean {
  try {
    localStorage.removeItem(ENCRYPTED_MNEMONIC_KEY);
    return true;
  } catch (error) {
    console.error('Failed to remove encrypted mnemonic:', error);
    return false;
  }
}

/**
 * Saves wallet state metadata to localStorage
 * @param state - The wallet state to save
 * @returns boolean indicating success
 */
export function saveWalletState(state: WalletState): boolean {
  try {
    localStorage.setItem(WALLET_STATE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error('Failed to save wallet state:', error);
    return false;
  }
}

/**
 * Loads wallet state metadata from localStorage
 * @returns The wallet state or null if not found
 */
export function loadWalletState(): WalletState | null {
  try {
    const data = localStorage.getItem(WALLET_STATE_KEY);
    if (!data) return null;
    return JSON.parse(data) as WalletState;
  } catch (error) {
    console.error('Failed to load wallet state:', error);
    return null;
  }
}
