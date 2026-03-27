/**
 * Sentinel AI Path — Zero-Config VPN Connection
 *
 * One function call: await connect({ mnemonic }) -> connected
 *
 * This module wraps the full Sentinel SDK into the simplest possible
 * interface for AI agents. No config files, no setup — just connect.
 */

import {
  connectAuto,
  connectDirect,
  disconnect as sdkDisconnect,
  isConnected,
  getStatus,
  registerCleanupHandlers,
  verifyConnection,
  verifyDependencies,
  formatP2P,
  events,
} from 'sentinel-dvpn-sdk';

// Use native fetch (Node 20+) for IP check — no axios dependency needed
// The SDK handles axios adapter internally for tunnel traffic

// ─── Constants ───────────────────────────────────────────────────────────────

const IP_CHECK_URL = 'https://api.ipify.org?format=json';
const IP_CHECK_TIMEOUT = 10000;

// ─── State ───────────────────────────────────────────────────────────────────

let _cleanupRegistered = false;
let _lastConnectResult = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Ensure cleanup handlers are registered (idempotent).
 * Handles SIGINT, SIGTERM, uncaught exceptions — tears down tunnels on exit.
 */
function ensureCleanup() {
  if (_cleanupRegistered) return;
  registerCleanupHandlers();
  _cleanupRegistered = true;
}

/**
 * Ensure axios uses Node.js HTTP adapter (not fetch) for Node 20+.
 * Without this, SOCKS proxy and tunnel traffic silently fails.
 * Lazy-imports axios from the SDK's node_modules.
 */
async function ensureAxiosAdapter() {
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
async function checkVpnIp(socksPort) {
  try {
    if (socksPort) {
      // V2Ray: route IP check through SOCKS5 proxy
      // Use SDK's checkVpnIpViaSocks which has proper module resolution
      const { checkVpnIpViaSocks } = await import('sentinel-dvpn-sdk');
      if (typeof checkVpnIpViaSocks === 'function') {
        return await checkVpnIpViaSocks(socksPort, IP_CHECK_TIMEOUT);
      }
      // Fallback: import from SDK's node_modules with absolute path
      const { resolve, dirname } = await import('path');
      const { fileURLToPath, pathToFileURL } = await import('url');
      const __dir = dirname(fileURLToPath(import.meta.url));
      const axios = (await import('axios')).default;
      const { SocksProxyAgent } = await import('socks-proxy-agent');
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
 * Convert SDK errors to human-readable messages.
 * AI agents get clean, actionable error strings instead of stack traces.
 */
function humanError(err) {
  const code = err?.code || 'UNKNOWN';
  const msg = err?.message || String(err);

  // Map common error codes to plain-English messages
  const messages = {
    INVALID_MNEMONIC: 'Invalid mnemonic — must be a 12 or 24 word BIP39 phrase.',
    INSUFFICIENT_BALANCE: 'Wallet has insufficient P2P tokens. Fund your wallet first.',
    ALREADY_CONNECTED: 'Already connected to VPN. Call disconnect() first.',
    NODE_NOT_FOUND: 'Node not found or offline. Try a different node or use connectAuto.',
    NODE_NO_UDVPN: 'Node does not accept P2P token payments.',
    WG_NO_CONNECTIVITY: 'WireGuard tunnel installed but no traffic flows. Try a different node.',
    V2RAY_NOT_FOUND: 'V2Ray binary not found. Run setup first: node setup.js',
    HANDSHAKE_FAILED: 'Handshake with node failed. The node may be overloaded — try another.',
    SESSION_EXTRACT_FAILED: 'Session creation TX succeeded but session ID could not be extracted.',
    ABORTED: 'Connection was cancelled.',
  };

  return messages[code] || `Connection failed: ${msg}`;
}

// ─── connect() ───────────────────────────────────────────────────────────────

/**
 * Connect to Sentinel dVPN. The ONE function an AI agent needs.
 *
 * @param {object} opts
 * @param {string} opts.mnemonic - BIP39 mnemonic (12 or 24 words)
 * @param {string} [opts.country] - Preferred country code (e.g. 'US', 'DE')
 * @param {string} [opts.nodeAddress] - Specific node (sentnode1...). Skips auto-pick.
 * @param {string} [opts.dns] - DNS preset: 'google', 'cloudflare', 'hns'
 * @param {string} [opts.protocol] - Preferred protocol: 'wireguard' or 'v2ray'
 * @param {function} [opts.onProgress] - Progress callback: (stage, message) => void
 * @param {number} [opts.timeout] - Connection timeout in ms (default: 120000 — 2 minutes)
 * @returns {Promise<{sessionId: string, protocol: string, nodeAddress: string, socksPort?: number, ip: string|null}>}
 */
export async function connect(opts = {}) {
  if (!opts || typeof opts !== 'object') {
    throw new Error('connect() requires an options object with at least { mnemonic }');
  }
  if (!opts.mnemonic || typeof opts.mnemonic !== 'string') {
    throw new Error('connect() requires a mnemonic string (12 or 24 word BIP39 phrase)');
  }

  // Auto-setup
  await ensureAxiosAdapter();
  ensureCleanup();

  // Build SDK options — forward ALL documented options to the underlying SDK.
  // Previously only 4 of 14 options were forwarded. Now all are passed through.
  const sdkOpts = {
    mnemonic: opts.mnemonic,
    onProgress: opts.onProgress || undefined,
    log: opts.onProgress ? (msg) => opts.onProgress('log', msg) : undefined,
  };

  // DNS
  if (opts.dns) {
    sdkOpts.dns = opts.dns;
  }

  // Protocol preference
  if (opts.protocol === 'wireguard') {
    sdkOpts.serviceType = 'wireguard';
  } else if (opts.protocol === 'v2ray') {
    sdkOpts.serviceType = 'v2ray';
  }

  // Country filter — SDK expects `countries` (array), not `country` (string)
  if (opts.country) {
    sdkOpts.countries = [opts.country.toUpperCase()];
  }

  // Session pricing
  if (opts.gigabytes && opts.gigabytes > 0) {
    sdkOpts.gigabytes = opts.gigabytes;
  }
  if (opts.hours && opts.hours > 0) {
    sdkOpts.hours = opts.hours;
  }

  // Tunnel options
  if (opts.fullTunnel === false) {
    sdkOpts.fullTunnel = false;
  }
  if (opts.killSwitch === true) {
    sdkOpts.killSwitch = true;
  }
  if (opts.systemProxy !== undefined) {
    sdkOpts.systemProxy = opts.systemProxy;
  }

  // Split tunnel — WireGuard: route only specific IPs through VPN
  if (opts.splitIPs && Array.isArray(opts.splitIPs) && opts.splitIPs.length > 0) {
    sdkOpts.splitIPs = opts.splitIPs;
    sdkOpts.fullTunnel = false; // splitIPs implies not full tunnel
  }

  // V2Ray SOCKS5 auth — opt into password auth (default: noauth for localhost)
  if (opts.socksAuth === true) {
    sdkOpts.socksAuth = true;
  }

  // V2Ray binary path — auto-detect from environment.js if not explicitly set
  if (opts.v2rayExePath) {
    sdkOpts.v2rayExePath = opts.v2rayExePath;
  } else {
    try {
      const { getEnvironment } = await import('./environment.js');
      const env = getEnvironment();
      if (env.v2ray.available && env.v2ray.path) {
        sdkOpts.v2rayExePath = env.v2ray.path;
      }
    } catch { /* environment detection failed — let SDK try its own paths */ }
  }

  // Max connection attempts
  if (opts.maxAttempts && opts.maxAttempts > 0) {
    sdkOpts.maxAttempts = opts.maxAttempts;
  }

  // Dry run — validate everything (wallet, nodes, balance, requirements) without paying
  if (opts.dryRun === true) {
    sdkOpts.dryRun = true;
  }

  // Force new session — skip reuse of existing sessions
  if (opts.forceNewSession === true) {
    sdkOpts.forceNewSession = true;
  }

  // AbortController — honor external signal if provided, else use timeout
  const timeoutMs = (opts.timeout && opts.timeout > 0) ? opts.timeout : 120000;
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs);

  // If caller provided their own signal, abort our controller when theirs fires
  if (opts.signal) {
    if (opts.signal.aborted) { ac.abort(); } else {
      opts.signal.addEventListener('abort', () => ac.abort(), { once: true });
    }
  }
  sdkOpts.signal = ac.signal;

  try {
    let result;

    if (opts.nodeAddress) {
      // Direct connection to a specific node
      sdkOpts.nodeAddress = opts.nodeAddress;
      result = await connectDirect(sdkOpts);
    } else {
      // Auto-pick the best available node
      result = await connectAuto(sdkOpts);
    }

    // Check public IP through the tunnel (V2Ray: via SOCKS5 proxy, WireGuard: native)
    const ip = await checkVpnIp(result.socksPort || null);

    // Build clean return object
    const output = {
      sessionId: String(result.sessionId),
      protocol: result.serviceType || 'unknown',
      nodeAddress: result.nodeAddress || opts.nodeAddress || 'unknown',
      socksPort: result.socksPort || null,
      socksAuth: result.socksAuth || null,
      dryRun: result.dryRun || false,
      ip,
    };

    _lastConnectResult = output;
    return output;
  } catch (err) {
    const wrapped = new Error(humanError(err));
    wrapped.code = err?.code || 'UNKNOWN';
    wrapped.details = err?.details || null;
    throw wrapped;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// ─── disconnect() ────────────────────────────────────────────────────────────

/**
 * Disconnect from VPN. Tears down tunnel, cleans up system state.
 *
 * @returns {Promise<{disconnected: boolean}>}
 */
export async function disconnect() {
  try {
    await sdkDisconnect();
    _lastConnectResult = null;
    return { disconnected: true };
  } catch (err) {
    // Even if disconnect throws, the tunnel is likely down
    _lastConnectResult = null;
    throw new Error(`Disconnect failed: ${err.message}`);
  }
}

// ─── status() ────────────────────────────────────────────────────────────────

/**
 * Get current VPN connection status.
 *
 * @returns {{connected: boolean, sessionId?: string, protocol?: string, nodeAddress?: string, socksPort?: number, uptimeMs?: number, uptimeFormatted?: string, ip?: string|null}}
 */
export function status() {
  const sdkStatus = getStatus();

  if (!sdkStatus) {
    return { connected: false };
  }

  return {
    connected: true,
    sessionId: sdkStatus.sessionId || null,
    protocol: sdkStatus.serviceType || null,
    nodeAddress: sdkStatus.nodeAddress || null,
    socksPort: sdkStatus.socksPort || null,
    uptimeMs: sdkStatus.uptimeMs || 0,
    uptimeFormatted: sdkStatus.uptimeFormatted || '0s',
    ip: _lastConnectResult?.ip || null,
  };
}

// ─── isVpnActive() ──────────────────────────────────────────────────────────

/**
 * Quick boolean check: is the VPN tunnel active right now?
 *
 * @returns {boolean}
 */
export function isVpnActive() {
  return isConnected();
}

// ─── verify() ───────────────────────────────────────────────────────────────

/**
 * Verify the VPN connection is actually working.
 * Checks: tunnel is up, traffic flows, IP has changed.
 *
 * @returns {Promise<{connected: boolean, ip: string|null, verified: boolean}>}
 */
export async function verify() {
  if (!isConnected()) {
    return { connected: false, ip: null, verified: false };
  }

  // Check IP through tunnel — for V2Ray, must use SOCKS5 proxy (fetch ignores it)
  const socksPort = _lastConnectResult?.socksPort || null;
  const ip = await checkVpnIp(socksPort);

  // Try SDK's built-in verification if available
  let sdkVerified = false;
  try {
    if (typeof verifyConnection === 'function') {
      const result = await verifyConnection();
      sdkVerified = !!result;
    }
  } catch {
    // verifyConnection may not exist or may fail — IP check is sufficient
  }

  return {
    connected: true,
    ip,
    verified: ip !== null || sdkVerified,
  };
}

// ─── verifySplitTunnel() ─────────────────────────────────────────────────────

/**
 * Verify split tunneling is working correctly.
 * For V2Ray: confirms SOCKS5 proxy routes traffic through VPN while direct traffic bypasses.
 * For WireGuard: confirms tunnel is active (split tunnel verification requires known static IPs).
 *
 * IMPORTANT: Uses axios + SocksProxyAgent — NOT native fetch (which ignores SOCKS5).
 *
 * @returns {Promise<{splitTunnel: boolean, proxyIp: string|null, directIp: string|null, protocol: string|null}>}
 */
export async function verifySplitTunnel() {
  if (!isConnected()) {
    return { splitTunnel: false, proxyIp: null, directIp: null, protocol: null };
  }

  const socksPort = _lastConnectResult?.socksPort || null;
  const protocol = _lastConnectResult?.protocol || null;

  // Get direct IP (bypasses VPN)
  let directIp = null;
  try {
    if (socksPort) {
      // V2Ray: native fetch goes direct (this is correct — it proves split tunnel)
      const res = await fetch(IP_CHECK_URL, { signal: AbortSignal.timeout(IP_CHECK_TIMEOUT) });
      const data = await res.json();
      directIp = data?.ip || null;
    }
  } catch { /* non-critical */ }

  // Get proxy IP (through VPN)
  const proxyIp = await checkVpnIp(socksPort);

  // Split tunnel works when proxy and direct show different IPs
  const splitTunnel = !!(proxyIp && directIp && proxyIp !== directIp);

  return { splitTunnel, proxyIp, directIp, protocol };
}

// ─── onEvent() ──────────────────────────────────────────────────────────────

/**
 * Subscribe to VPN connection events (progress, errors, reconnect).
 *
 * Event types:
 *   'progress'      — { step, detail } during connection
 *   'connected'     — connection established
 *   'disconnected'  — connection closed
 *   'error'         — { code, message } on failure
 *   'reconnecting'  — auto-reconnect in progress
 *
 * @param {function} callback - (eventType: string, data: object) => void
 * @returns {function} unsubscribe — call to stop listening
 */
export function onEvent(callback) {
  if (!events || typeof events.on !== 'function') {
    // SDK events not available — return no-op unsubscribe
    return () => {};
  }

  // Subscribe to all relevant events — store exact handler refs for clean unsubscribe
  const eventNames = [
    'progress', 'connected', 'disconnected', 'error',
    'reconnecting', 'reconnected', 'sessionEnd', 'sessionEndFailed',
  ];

  const handlers = new Map();
  for (const name of eventNames) {
    const h = (data) => {
      try { callback(name, data); } catch { /* don't crash SDK */ }
    };
    handlers.set(name, h);
    events.on(name, h);
  }

  // Return unsubscribe function — removes exact handler references
  return () => {
    for (const [name, h] of handlers) {
      events.removeListener(name, h);
    }
    handlers.clear();
  };
}
