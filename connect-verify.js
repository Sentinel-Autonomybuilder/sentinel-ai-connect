/**
 * Sentinel AI Path — Connection Verification (Stage 7)
 *
 * verify() — full verification (IP check + SDK verify)
 * verifySplitTunnel() — split tunnel verification (proxy vs direct IP)
 * isVpnActive() — quick boolean tunnel check
 *
 * Split from connect.js (852 lines) for maintainability.
 */

import {
  isConnected,
  verifyConnection,
} from 'sentinel-dvpn-sdk';

import {
  checkVpnIp,
  getLastConnectResult,
  IP_CHECK_URL,
  IP_CHECK_TIMEOUT,
} from './connect-helpers.js';

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
 * @returns {Promise<{connected: boolean, ip: string|null, verified: boolean, latency: number|null}>}
 */
export async function verify() {
  if (!isConnected()) {
    return { connected: false, ip: null, verified: false, latency: null };
  }

  // Check IP through tunnel — for V2Ray, must use SOCKS5 proxy (fetch ignores it)
  const lastResult = getLastConnectResult();
  const socksPort = lastResult?.socksPort || null;
  const t0 = Date.now();
  const ip = await checkVpnIp(socksPort);
  const latency = Date.now() - t0;

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
    latency,
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

  const lastResult = getLastConnectResult();
  const socksPort = lastResult?.socksPort || null;
  const protocol = lastResult?.protocol || null;

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
