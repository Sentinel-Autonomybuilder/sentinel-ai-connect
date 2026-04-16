/**
 * Sentinel AI Path — Status, Disconnect & Events
 *
 * status() — current connection state for agents
 * disconnect() — tear down tunnel, return accounting info
 * onEvent() — subscribe to connection lifecycle events
 *
 * Split from connect.js (852 lines) for maintainability.
 */

import {
  disconnect as sdkDisconnect,
  getStatus,
  events,
} from 'sentinel-dvpn-sdk';

import {
  agentLog,
  getLastConnectResult,
  getConnectedAt,
  clearConnectionState,
} from './connect-helpers.js';

// ─── disconnect() ────────────────────────────────────────────────────────────

/**
 * Disconnect from VPN. Tears down tunnel, cleans up system state.
 * Returns session cost and remaining balance for agent accounting.
 *
 * @returns {Promise<{
 *   disconnected: boolean,
 *   sessionId: string|null,
 *   balance: string|null,
 *   timing: { connectedMs: number|null, setupMs: number|null },
 * }>}
 */
export async function disconnect() {
  const prevResult = getLastConnectResult();
  const sessionId = prevResult?.sessionId || null;

  agentLog(1, 1, 'DISCONNECT', `Ending session${sessionId ? ` ${sessionId}` : ''}...`);

  try {
    await sdkDisconnect();

    // Check remaining balance after disconnect
    let balance = null;
    if (prevResult?.walletAddress) {
      try {
        // Re-derive from stored result isn't possible without mnemonic.
        // Listen for the session-end event from SDK instead.
        balance = prevResult.balance?.after || null;
      } catch { /* non-critical */ }
    }

    const connectedAt = getConnectedAt();

    const output = {
      disconnected: true,
      sessionId,
      balance,
      timing: {
        connectedMs: connectedAt
          ? Date.now() - connectedAt
          : null,
        setupMs: prevResult?.timing?.totalMs || null,
      },
    };

    agentLog(1, 1, 'DISCONNECT', `Done. Session ${sessionId || 'unknown'} ended.`);

    clearConnectionState();
    return output;
  } catch (err) {
    clearConnectionState();
    throw new Error(`Disconnect failed: ${err.message}`);
  }
}

// ─── status() ────────────────────────────────────────────────────────────────

/**
 * Get current VPN connection status.
 * Returns everything an agent needs to assess the connection.
 *
 * @returns {{
 *   connected: boolean,
 *   sessionId?: string,
 *   protocol?: string,
 *   nodeAddress?: string,
 *   country?: string,
 *   city?: string,
 *   socksPort?: number,
 *   uptimeMs?: number,
 *   uptimeFormatted?: string,
 *   ip?: string|null,
 *   balance?: { before: string, after: string|null },
 * }}
 */
export function status() {
  const sdkStatus = getStatus();

  if (!sdkStatus) {
    return { connected: false };
  }

  const lastResult = getLastConnectResult();

  return {
    connected: true,
    sessionId: sdkStatus.sessionId || null,
    protocol: sdkStatus.serviceType || null,
    nodeAddress: sdkStatus.nodeAddress || null,
    country: lastResult?.country || null,
    city: lastResult?.city || null,
    socksPort: sdkStatus.socksPort || null,
    uptimeMs: sdkStatus.uptimeMs || 0,
    uptimeFormatted: sdkStatus.uptimeFormatted || '0s',
    ip: lastResult?.ip || null,
    balance: lastResult?.balance || null,
  };
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
