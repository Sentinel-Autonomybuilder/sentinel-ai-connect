/**
 * Sentinel AI Path — Connect Helpers
 *
 * Shared constants, state management, logging, and utility functions
 * used across the connect-* modules.
 *
 * Split from connect.js (852 lines) for maintainability.
 */

import {
  registerCleanupHandlers,
  formatP2P,
  createWallet as sdkCreateWallet,
  createClient,
  getBalance as sdkGetBalance,
  tryWithFallback,
  RPC_ENDPOINTS,
} from '../js-sdk/index.js';

// ─── Constants ───────────────────────────────────────────────────────────────

export const IP_CHECK_URL = 'https://api.ipify.org?format=json';
export const IP_CHECK_TIMEOUT = 10000;
export const MIN_BALANCE_UDVPN = 500000; // 0.5 P2P — minimum for gas + cheapest session

// ─── State ───────────────────────────────────────────────────────────────────

let _cleanupRegistered = false;
let _lastConnectResult = null;
let _connectedAt = null;
let _connectTimings = {};

export function getLastConnectResult() { return _lastConnectResult; }
export function setLastConnectResult(val) { _lastConnectResult = val; }

export function getConnectedAt() { return _connectedAt; }
export function setConnectedAt(val) { _connectedAt = val; }

export function getConnectTimings() { return _connectTimings; }
export function setConnectTimings(val) { _connectTimings = val; }

/** Clear all connection state (used on disconnect). */
export function clearConnectionState() {
  _lastConnectResult = null;
  _connectedAt = null;
  _connectTimings = {};
}

// ─── Agent Logger ───────────────────────────────────────────────────────────

/**
 * Structured step logger for autonomous agents.
 * Each step prints a numbered phase with timestamp.
 * Agents can parse these lines programmatically.
 */
export function agentLog(step, total, phase, msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [STEP ${step}/${total}] [${phase}] ${msg}`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Ensure cleanup handlers are registered (idempotent).
 * Handles SIGINT, SIGTERM, uncaught exceptions — tears down tunnels on exit.
 */
export function ensureCleanup() {
  if (_cleanupRegistered) return;
  registerCleanupHandlers();
  _cleanupRegistered = true;
}

/**
 * Ensure axios uses Node.js HTTP adapter (not fetch) for Node 20+.
 * Without this, SOCKS proxy and tunnel traffic silently fails.
 * Lazy-imports axios from the SDK's node_modules.
 */
export async function ensureAxiosAdapter() {
  try {
    const axios = (await import('axios')).default;
    if (axios.defaults.adapter !== 'http') {
      axios.defaults.adapter = 'http';
    }
  } catch {
    // axios not available — SDK will handle this during connect
  }
}

/**
 * Check the public IP through the VPN tunnel to confirm it changed.
 * For WireGuard: native fetch routes through the tunnel automatically.
 * For V2Ray: must use SOCKS5 proxy — native fetch ignores SOCKS5.
 * Returns the IP string or null if the check fails.
 */
export async function checkVpnIp(socksPort) {
  try {
    if (socksPort) {
      // V2Ray: route IP check through SOCKS5 proxy
      // Use SDK's checkVpnIpViaSocks which has proper module resolution
      const { checkVpnIpViaSocks } = await import('../js-sdk/index.js');
      if (typeof checkVpnIpViaSocks === 'function') {
        return await checkVpnIpViaSocks(socksPort, IP_CHECK_TIMEOUT);
      }
      // Fallback: import from SDK's node_modules with absolute path
      const { resolve, dirname } = await import('path');
      const { fileURLToPath, pathToFileURL } = await import('url');
      const __dir = dirname(fileURLToPath(import.meta.url));
      const axiosPath = resolve(__dir, '..', 'js-sdk', 'node_modules', 'axios', 'index.js');
      const socksPath = resolve(__dir, '..', 'js-sdk', 'node_modules', 'socks-proxy-agent', 'dist', 'index.js');
      const axios = (await import(pathToFileURL(axiosPath).href)).default;
      const { SocksProxyAgent } = await import(pathToFileURL(socksPath).href);
      const agent = new SocksProxyAgent(`socks5h://127.0.0.1:${socksPort}`);
      const res = await axios.get(IP_CHECK_URL, {
        httpAgent: agent, httpsAgent: agent,
        timeout: IP_CHECK_TIMEOUT, adapter: 'http',
      });
      return res.data?.ip || null;
    }
    // WireGuard: native fetch routes through tunnel
    const res = await fetch(IP_CHECK_URL, {
      signal: AbortSignal.timeout(IP_CHECK_TIMEOUT),
    });
    const data = await res.json();
    return data?.ip || null;
  } catch (err) {
    // IP check is non-critical — tunnel may work but ipify may be blocked
    if (err?.code === 'ERR_MODULE_NOT_FOUND') {
      console.warn('[sentinel-ai] IP check skipped: missing dependency —', err.message?.split("'")[1] || 'unknown');
    }
    return null;
  }
}

/**
 * Convert SDK errors to human-readable messages with machine-readable nextAction.
 * AI agents get clean, actionable error strings instead of stack traces.
 */
export function humanError(err) {
  const code = err?.code || 'UNKNOWN';
  const msg = err?.message || String(err);

  // Map common error codes to plain-English messages + next action for agent
  const messages = {
    INVALID_MNEMONIC: {
      message: 'Invalid mnemonic — must be a 12 or 24 word BIP39 phrase.',
      nextAction: 'create_wallet',
    },
    INSUFFICIENT_BALANCE: {
      message: 'Wallet has insufficient P2P tokens. Fund your wallet first.',
      nextAction: 'fund_wallet',
    },
    ALREADY_CONNECTED: {
      message: 'Already connected to VPN. Call disconnect() first.',
      nextAction: 'disconnect',
    },
    NODE_NOT_FOUND: {
      message: 'Node not found or offline. Try a different node or use connectAuto.',
      nextAction: 'try_different_node',
    },
    NODE_NO_UDVPN: {
      message: 'Node does not accept P2P token payments.',
      nextAction: 'try_different_node',
    },
    WG_NO_CONNECTIVITY: {
      message: 'WireGuard tunnel installed but no traffic flows. Try a different node.',
      nextAction: 'try_different_node',
    },
    V2RAY_NOT_FOUND: {
      message: 'V2Ray binary not found. Run setup first: node setup.js',
      nextAction: 'run_setup',
    },
    HANDSHAKE_FAILED: {
      message: 'Handshake with node failed. The node may be overloaded — try another.',
      nextAction: 'try_different_node',
    },
    SESSION_EXTRACT_FAILED: {
      message: 'Session creation TX succeeded but session ID could not be extracted.',
      nextAction: 'retry',
    },
    ALL_NODES_FAILED: {
      message: 'All candidate nodes failed to connect.',
      nextAction: 'try_different_country',
    },
    ABORTED: {
      message: 'Connection was cancelled.',
      nextAction: 'none',
    },
  };

  const entry = messages[code];
  if (entry) return entry;
  return { message: `Connection failed: ${msg}`, nextAction: 'retry' };
}

/**
 * Pre-validate balance before any connection attempt.
 * Returns { address, udvpn, p2p, sufficient }.
 */
export async function preValidateBalance(mnemonic) {
  try {
    const { wallet, account } = await sdkCreateWallet(mnemonic);
    const { result: client } = await tryWithFallback(
      RPC_ENDPOINTS,
      async (url) => createClient(url, wallet),
      'RPC connect (balance pre-check)',
    );
    const bal = await sdkGetBalance(client, account.address);
    return {
      address: account.address,
      udvpn: bal.udvpn,
      p2p: formatP2P(bal.udvpn),
      sufficient: bal.udvpn >= MIN_BALANCE_UDVPN,
    };
  } catch {
    // Balance check failed — let connect() handle it downstream
    return { address: null, udvpn: 0, p2p: '0 P2P', sufficient: false };
  }
}
