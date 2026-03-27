/**
 * Sentinel AI Path — Error Types
 *
 * Typed errors with machine-readable codes for AI agent error handling.
 * Mirrors the pattern in sentinel-dvpn-sdk errors.js but simplified for the ai-path wrapper.
 */

// ─── Error Codes ────────────────────────────────────────────────────────────

export const AiPathErrorCodes = {
  MISSING_MNEMONIC: 'MISSING_MNEMONIC',
  INVALID_MNEMONIC: 'INVALID_MNEMONIC',
  INVALID_OPTIONS: 'INVALID_OPTIONS',
  CONNECT_FAILED: 'CONNECT_FAILED',
  DISCONNECT_FAILED: 'DISCONNECT_FAILED',
  WALLET_FAILED: 'WALLET_FAILED',
  BALANCE_FAILED: 'BALANCE_FAILED',
  DISCOVERY_FAILED: 'DISCOVERY_FAILED',
  SETUP_FAILED: 'SETUP_FAILED',
  VERIFY_FAILED: 'VERIFY_FAILED',
};

// ─── Error Class ────────────────────────────────────────────────────────────

export class AiPathError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AiPathError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
