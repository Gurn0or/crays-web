/**
 * WASM Loader for Breez SDK
 * Handles initialization of the Breez WASM module with singleton pattern
 */

let breezWasmInitialized = false;
let breezWasmInstance: any = null;

/**
 * Initialize the Breez WASM module
 * Uses singleton pattern to ensure only one initialization
 * @returns Promise that resolves when WASM is initialized
 * @throws Error if initialization fails
 */
export async function initBreezWasm(): Promise<void> {
  if (breezWasmInitialized && breezWasmInstance) {
    return;
  }

  try {
    // Dynamic import of Breez SDK
    const breezModule = await import('@breeztech/breez-sdk-spark');
    
    // Initialize WASM
    if (breezModule.init) {
      await breezModule.init();
    }
    
    breezWasmInstance = breezModule;
    breezWasmInitialized = true;
    
    console.log('Breez WASM initialized successfully');
  } catch (error) {
    breezWasmInitialized = false;
    breezWasmInstance = null;
    console.error('Failed to initialize Breez WASM:', error);
    throw new Error(`Breez WASM initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if Breez WASM is initialized
 * @returns true if WASM is initialized, false otherwise
 */
export function isBreezWasmInitialized(): boolean {
  return breezWasmInitialized;
}

/**
 * Reset the Breez WASM instance
 * Primarily used for testing purposes
 */
export function resetBreezWasm(): void {
  breezWasmInitialized = false;
  breezWasmInstance = null;
  console.log('Breez WASM reset');
}

/**
 * Get the current Breez WASM instance
 * @returns The Breez WASM instance or null if not initialized
 */
export function getBreezWasmInstance(): any {
  return breezWasmInstance;
}
