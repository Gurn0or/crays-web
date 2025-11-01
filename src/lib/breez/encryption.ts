/**
 * Encryption utilities for mnemonic phrases using @noble/ciphers and @noble/hashes
 * Implements XChaCha20-Poly1305 encryption with PBKDF2 key derivation
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

/**
 * Encrypted data structure containing all necessary components for decryption
 */
export interface EncryptedData {
  /** Base64-encoded encrypted data */
  ciphertext: string;
  /** Base64-encoded nonce (24 bytes for XChaCha20) */
  nonce: string;
  /** Base64-encoded salt for key derivation */
  salt: string;
}

/**
 * Encryption options for key derivation
 */
export interface EncryptionOptions {
  /** Number of PBKDF2 iterations (default: 100000) */
  iterations?: number;
}

/**
 * Derives a cryptographic key from a password using PBKDF2-HMAC-SHA256
 * 
 * @param password - The password to derive the key from
 * @param salt - Salt for key derivation (16 bytes recommended)
 * @param iterations - Number of PBKDF2 iterations (default: 100000)
 * @returns 32-byte derived key
 * @throws {Error} If password is empty or salt is invalid
 * 
 * @example
 * ```typescript
 * const salt = randomBytes(16);
 * const key = deriveKey('myPassword', salt, 100000);
 * ```
 */
export function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Uint8Array {
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  if (!salt || salt.length === 0) {
    throw new Error('Salt cannot be empty');
  }

  if (iterations < 1) {
    throw new Error('Iterations must be greater than 0');
  }

  try {
    // Derive 32-byte key using PBKDF2-HMAC-SHA256
    const key = pbkdf2(sha256, password, salt, {
      c: iterations,
      dkLen: 32
    });
    return key;
  } catch (error) {
    throw new Error(
      `Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generates a random 32-byte device key for encryption
 * 
 * @returns 32-byte random key
 * @throws {Error} If random number generation fails
 * 
 * @example
 * ```typescript
 * const deviceKey = generateDeviceKey();
 * console.log(deviceKey.length); // 32
 * ```
 */
export function generateDeviceKey(): Uint8Array {
  try {
    const key = randomBytes(32);
    if (key.length !== 32) {
      throw new Error('Generated key is not 32 bytes');
    }
    return key;
  } catch (error) {
    throw new Error(
      `Device key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Encrypts a mnemonic phrase using XChaCha20-Poly1305
 * 
 * @param mnemonic - The mnemonic phrase to encrypt
 * @param password - Password for key derivation
 * @param options - Encryption options
 * @returns Object containing base64-encoded ciphertext, nonce, and salt
 * @throws {Error} If encryption fails or inputs are invalid
 * 
 * @example
 * ```typescript
 * const encrypted = encryptMnemonic(
 *   'word1 word2 word3 ...',
 *   'myStrongPassword'
 * );
 * console.log(encrypted.ciphertext); // Base64 string
 * ```
 */
export function encryptMnemonic(
  mnemonic: string,
  password: string,
  options: EncryptionOptions = {}
): EncryptedData {
  if (!mnemonic || mnemonic.trim().length === 0) {
    throw new Error('Mnemonic cannot be empty');
  }

  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  const iterations = options.iterations ?? 100000;

  try {
    // Generate random salt (16 bytes) and nonce (24 bytes for XChaCha20)
    const salt = randomBytes(16);
    const nonce = randomBytes(24);

    // Derive encryption key from password
    const key = deriveKey(password, salt, iterations);

    // Convert mnemonic to bytes
    const plaintext = new TextEncoder().encode(mnemonic);

    // Encrypt using XChaCha20-Poly1305
    const cipher = xchacha20poly1305(key, nonce);
    const ciphertext = cipher.encrypt(plaintext);

    // Return base64-encoded components
    return {
      ciphertext: Buffer.from(ciphertext).toString('base64'),
      nonce: Buffer.from(nonce).toString('base64'),
      salt: Buffer.from(salt).toString('base64')
    };
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypts a mnemonic phrase encrypted with encryptMnemonic
 * 
 * @param encryptedData - Object containing ciphertext, nonce, and salt
 * @param password - Password used for encryption
 * @param options - Decryption options
 * @returns Decrypted mnemonic phrase
 * @throws {Error} If decryption fails, password is incorrect, or data is invalid
 * 
 * @example
 * ```typescript
 * const decrypted = decryptMnemonic(
 *   {
 *     ciphertext: 'base64string',
 *     nonce: 'base64string',
 *     salt: 'base64string'
 *   },
 *   'myStrongPassword'
 * );
 * console.log(decrypted); // 'word1 word2 word3 ...'
 * ```
 */
export function decryptMnemonic(
  encryptedData: EncryptedData,
  password: string,
  options: EncryptionOptions = {}
): string {
  if (!encryptedData || !encryptedData.ciphertext || !encryptedData.nonce || !encryptedData.salt) {
    throw new Error('Invalid encrypted data: missing required fields');
  }

  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  const iterations = options.iterations ?? 100000;

  try {
    // Decode base64 components
    const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
    const nonce = Buffer.from(encryptedData.nonce, 'base64');
    const salt = Buffer.from(encryptedData.salt, 'base64');

    // Validate nonce length (24 bytes for XChaCha20)
    if (nonce.length !== 24) {
      throw new Error('Invalid nonce length: expected 24 bytes for XChaCha20');
    }

    // Derive decryption key from password
    const key = deriveKey(password, salt, iterations);

    // Decrypt using XChaCha20-Poly1305
    const cipher = xchacha20poly1305(key, nonce);
    const plaintext = cipher.decrypt(ciphertext);

    // Convert bytes back to string
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('auth') || error.message.includes('tag')) {
        throw new Error('Decryption failed: incorrect password or corrupted data');
      }
      throw new Error(`Decryption failed: ${error.message}`);
    }
    throw new Error('Decryption failed: Unknown error');
  }
}
