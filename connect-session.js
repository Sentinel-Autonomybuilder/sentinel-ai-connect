/**
 * Sentinel AI Path — Session & Tunnel (Stages 4-6)
 *
 * Stage 4: Node selection (country-aware discovery or direct)
 * Stage 5: Session creation (broadcast TX)
 * Stage 6: Tunnel setup (WireGuard/V2Ray handshake + install)
 *
 * Split from connect.js (852 lines) for maintainability.
 */

import {
  connectAuto,
  connectDirect,
  formatP2P,
} from '../js-sdk/index.js';

import {
  agentLog,
  checkVpnIp,
  preValidateBalance,
} from './connect-helpers.js';

// ─── Stage 4: Node Selection ────────────────────────────────────────────────

/**
 * Resolve which node to connect to.
 * Handles country-aware discovery, direct node address, or auto-select fallback.
 *
 * @param {object} opts - User connect options
 * @param {object} envInfo - Environment info (os, admin, v2ray, wireguard)
 * @param {function} log - Logger function (agentLog or no-op)
 * @param {number} totalSteps - Total step count for logging
 * @returns {Promise<{ resolvedNodeAddress: string|null, discoveredNode: object|null }>}
 */
export async function resolveNode(opts, envInfo, log, totalSteps) {
  let resolvedNodeAddress = opts.nodeAddress || null;
  let discoveredNode = null;

  if (!resolvedNodeAddress && opts.country) {
    const countryUpper = opts.country.toUpperCase();
    log(4, totalSteps, 'NODE', `Discovering nodes in ${countryUpper} (probing both WireGuard + V2Ray)...`);

    try {
      const { queryOnlineNodes, filterNodes, COUNTRY_MAP } = await import('../js-sdk/index.js');

      // Probe a large sample WITHOUT protocol filter — find ALL country matches
      const probeCount = Math.max(200, (opts.maxAttempts || 3) * 50);
      const allProbed = await queryOnlineNodes({
        maxNodes: probeCount,
        onNodeProbed: ({ total, probed, online }) => {
          if (probed % 50 === 0 || probed === total) {
            log(4, totalSteps, 'NODE', `Probed ${probed}/${total} nodes, ${online} online...`);
          }
        },
      });

      // Resolve country: filterNodes uses includes() on country NAME, not ISO code.
      // If agent passed "SG", we need "Singapore" for filterNodes to match.
      // Build reverse map: ISO code -> country name
      let countryFilter = countryUpper;
      if (COUNTRY_MAP && countryUpper.length === 2) {
        // COUNTRY_MAP is { 'singapore': 'SG', ... } — reverse lookup
        for (const [name, code] of Object.entries(COUNTRY_MAP)) {
          if (code === countryUpper) {
            countryFilter = name; // "singapore" — filterNodes lowercases both sides
            break;
          }
        }
      }

      // Filter by country — use the resolved name (e.g., "singapore" not "SG")
      let countryNodes = filterNodes(allProbed, { country: countryFilter });
      let wgNodes = countryNodes.filter(n => n.serviceType === 'wireguard');
      let v2Nodes = countryNodes.filter(n => n.serviceType === 'v2ray');

      log(4, totalSteps, 'NODE', `Found ${countryNodes.length} nodes in ${countryUpper}: ${wgNodes.length} WireGuard, ${v2Nodes.length} V2Ray`);

      // If initial sample missed the country, do a FULL scan of all nodes.
      // Rare countries (e.g., Singapore = 2 of 1037) need the full network scan.
      if (countryNodes.length === 0) {
        log(4, totalSteps, 'NODE', `${countryUpper} not in initial sample. Scanning ALL nodes (this takes ~2 min)...`);
        const fullProbed = await queryOnlineNodes({
          maxNodes: 5000, // All nodes
          onNodeProbed: ({ total, probed, online }) => {
            if (probed % 100 === 0 || probed === total) {
              log(4, totalSteps, 'NODE', `Full scan: ${probed}/${total} probed, ${online} online...`);
            }
          },
        });
        countryNodes = filterNodes(fullProbed, { country: countryFilter });
        wgNodes = countryNodes.filter(n => n.serviceType === 'wireguard');
        v2Nodes = countryNodes.filter(n => n.serviceType === 'v2ray');
        log(4, totalSteps, 'NODE', `Full scan: ${countryNodes.length} nodes in ${countryUpper}: ${wgNodes.length} WireGuard, ${v2Nodes.length} V2Ray`);
      }

      if (countryNodes.length > 0) {
        // Pick best node: prefer requested protocol, then WireGuard (faster), then V2Ray
        let picked;
        if (opts.protocol === 'wireguard' && wgNodes.length > 0) {
          picked = wgNodes[0]; // Already sorted by quality score
        } else if (opts.protocol === 'v2ray' && v2Nodes.length > 0) {
          picked = v2Nodes[0];
        } else if (wgNodes.length > 0 && envInfo.admin) {
          picked = wgNodes[0]; // WireGuard preferred when admin
        } else if (v2Nodes.length > 0) {
          picked = v2Nodes[0];
        } else {
          picked = countryNodes[0];
        }

        resolvedNodeAddress = picked.address;
        discoveredNode = {
          country: picked.country || null,
          city: picked.city || null,
          moniker: picked.moniker || null,
          serviceType: picked.serviceType || null,
          qualityScore: picked.qualityScore || 0,
        };
        log(4, totalSteps, 'NODE', `Selected: ${picked.address} (${picked.serviceType}) — ${picked.moniker || 'unnamed'}, ${picked.country}, score=${picked.qualityScore}`);
      } else {
        log(4, totalSteps, 'NODE', `No nodes found in ${countryUpper}. Falling back to global auto-select.`);
      }
    } catch (err) {
      log(4, totalSteps, 'NODE', `Country discovery failed: ${err.message}. Falling back to auto-select.`);
    }
  } else if (!resolvedNodeAddress) {
    log(4, totalSteps, 'NODE', 'Auto-selecting best available node (all countries, both protocols)...');
  } else {
    log(4, totalSteps, 'NODE', `Direct node: ${resolvedNodeAddress}`);
  }

  return { resolvedNodeAddress, discoveredNode };
}

// ─── Build SDK Options ──────────────────────────────────────────────────────

/**
 * Build the options object to pass to connectAuto/connectDirect.
 * Translates ai-path options to SDK options.
 *
 * @param {object} opts - User connect options
 * @param {object} envInfo - Environment info
 * @param {boolean} silent - Suppress console output
 * @param {number} totalSteps - Total step count
 * @returns {{ sdkOpts: object, timeoutId: any, ac: AbortController }}
 */
export function buildSdkOptions(opts, envInfo, silent, totalSteps) {
  const sdkOpts = {
    mnemonic: opts.mnemonic,
    onProgress: (stage, msg) => {
      if (opts.onProgress) opts.onProgress(stage, msg);
      const stageMap = {
        'wallet': 2, 'node-check': 4, 'validate': 4,
        'session': 5, 'handshake': 6, 'tunnel': 6,
        'verify': 7, 'dry-run': 7,
      };
      const step = stageMap[stage] || 5;
      const phase = stage.toUpperCase().replace('-', '_');
      if (!silent) agentLog(step, totalSteps, phase, msg);
    },
    log: (msg) => {
      if (opts.onProgress) opts.onProgress('log', msg);
    },
  };

  // DNS
  if (opts.dns) sdkOpts.dns = opts.dns;

  // Protocol preference — search BOTH protocols when not specified
  if (opts.protocol === 'wireguard') sdkOpts.serviceType = 'wireguard';
  else if (opts.protocol === 'v2ray') sdkOpts.serviceType = 'v2ray';
  // When no protocol specified: do NOT set serviceType — let SDK try all node types

  // Session pricing
  if (opts.gigabytes && opts.gigabytes > 0) sdkOpts.gigabytes = opts.gigabytes;
  if (opts.hours && opts.hours > 0) sdkOpts.hours = opts.hours;

  // Tunnel options
  if (opts.fullTunnel === false) sdkOpts.fullTunnel = false;
  if (opts.killSwitch === true) sdkOpts.killSwitch = true;
  if (opts.systemProxy !== undefined) sdkOpts.systemProxy = opts.systemProxy;

  // Split tunnel — WireGuard: route only specific IPs through VPN
  if (opts.splitIPs && Array.isArray(opts.splitIPs) && opts.splitIPs.length > 0) {
    sdkOpts.splitIPs = opts.splitIPs;
    sdkOpts.fullTunnel = false;
  }

  // V2Ray SOCKS5 auth
  if (opts.socksAuth === true) sdkOpts.socksAuth = true;

  // V2Ray binary path
  if (opts.v2rayExePath) {
    sdkOpts.v2rayExePath = opts.v2rayExePath;
  } else if (envInfo.v2rayPath) {
    sdkOpts.v2rayExePath = envInfo.v2rayPath;
  }

  // Max connection attempts
  if (opts.maxAttempts && opts.maxAttempts > 0) sdkOpts.maxAttempts = opts.maxAttempts;

  // Dry run
  if (opts.dryRun === true) sdkOpts.dryRun = true;

  // Force new session
  if (opts.forceNewSession === true) sdkOpts.forceNewSession = true;

  // AbortController
  const timeoutMs = (opts.timeout && opts.timeout > 0) ? opts.timeout : 120000;
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs);
  if (opts.signal) {
    if (opts.signal.aborted) { ac.abort(); } else {
      opts.signal.addEventListener('abort', () => ac.abort(), { once: true });
    }
  }
  sdkOpts.signal = ac.signal;

  return { sdkOpts, timeoutId, ac };
}

// ─── Stages 5-6: Execute Connection ─────────────────────────────────────────

/**
 * Execute the SDK connection (session broadcast + tunnel setup).
 * Calls connectDirect or connectAuto based on whether a node was resolved.
 *
 * @param {object} sdkOpts - SDK options built by buildSdkOptions
 * @param {string|null} resolvedNodeAddress - Target node or null for auto
 * @param {object|null} discoveredNode - Metadata from country discovery
 * @returns {Promise<object>} SDK connection result
 */
export async function executeConnection(sdkOpts, resolvedNodeAddress, discoveredNode) {
  if (discoveredNode) {
    sdkOpts._discoveredNode = discoveredNode;
  }

  if (resolvedNodeAddress) {
    // Direct connection — either user specified nodeAddress or country discovery found one
    sdkOpts.nodeAddress = resolvedNodeAddress;
    return await connectDirect(sdkOpts);
  } else {
    // No country filter or country discovery found nothing — auto-select globally
    if (!sdkOpts.maxAttempts) sdkOpts.maxAttempts = 5;
    return await connectAuto(sdkOpts);
  }
}

// ─── Post-Connect: Build Result ─────────────────────────────────────────────

/**
 * Build the agent-friendly result object after successful connection.
 *
 * @param {object} result - Raw SDK connection result
 * @param {string} resolvedNodeAddress - Node address used
 * @param {object|null} discoveredNode - Metadata from discovery
 * @param {string|null} walletAddress - Wallet address
 * @param {object} balCheck - Pre-connection balance check result
 * @param {string} mnemonic - Wallet mnemonic (for post-balance check)
 * @param {object} timings - Timing object
 * @param {string|null} ip - VPN IP from verification
 * @returns {Promise<object>} Agent-friendly connect result
 */
export async function buildConnectResult(result, resolvedNodeAddress, discoveredNode, walletAddress, balCheck, mnemonic, timings, ip) {
  // Post-connect balance check
  let balanceAfter = null;
  let costUdvpn = 0;
  let costFormatted = 'unknown';
  try {
    const postBal = await preValidateBalance(mnemonic);
    balanceAfter = postBal.p2p;
    costUdvpn = Math.max(0, balCheck.udvpn - postBal.udvpn);
    costFormatted = formatP2P(costUdvpn);
  } catch { /* non-critical */ }

  // Pull country/city/moniker from: discovered node metadata > SDK result > null
  const discovered = discoveredNode || {};

  return {
    sessionId: String(result.sessionId),
    protocol: result.serviceType || discovered.serviceType || 'unknown',
    nodeAddress: result.nodeAddress || resolvedNodeAddress || 'unknown',
    country: result.nodeLocation?.country || discovered.country || null,
    city: result.nodeLocation?.city || discovered.city || null,
    moniker: result.nodeMoniker || discovered.moniker || null,
    socksPort: result.socksPort || null,
    socksAuth: result.socksAuth || null,
    dryRun: result.dryRun || false,
    ip,
    walletAddress: walletAddress || balCheck.address,
    balance: {
      before: balCheck.p2p,
      after: balanceAfter,
    },
    cost: {
      udvpn: costUdvpn,
      p2p: costFormatted,
    },
    timing: {
      totalMs: timings.total,
      totalFormatted: `${(timings.total / 1000).toFixed(1)}s`,
      phases: { ...timings },
    },
  };
}
