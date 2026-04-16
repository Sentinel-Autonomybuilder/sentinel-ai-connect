/**
 * Agent Connect — Decision Engine for Autonomous Agents
 *
 * An autonomous agent calls recommend() BEFORE connect().
 * It receives structured recommendations with alternatives,
 * cost estimates, warnings, and fallback strategies.
 *
 * The agent makes the final decision — the SDK never decides for it.
 */

import {
  queryOnlineNodes,
  fetchActiveNodes,
  formatP2P,
  IS_ADMIN,
  WG_AVAILABLE,
} from 'blue-js-sdk';

import { toCountryCode, filterByProtocol, filterByCountry } from './recommend-filters.js';
import { rankNodes, formatNode } from './recommend-scoring.js';

// ─── recommend() ─────────────────────────────────────────────────────────────

/**
 * Generate structured recommendations for an autonomous AI agent.
 *
 * The agent provides its preferences. The SDK returns ranked options
 * with cost estimates, warnings, and fallback strategies.
 * The agent makes the final decision.
 *
 * @param {object} preferences
 * @param {string} [preferences.country] - Preferred country (name or ISO code)
 * @param {number} [preferences.budget] - Available budget in udvpn
 * @param {'reliability'|'cost'|'speed'|'location'} [preferences.priority='reliability'] - What matters most
 * @param {number} [preferences.gigabytes=1] - Planned data usage
 * @param {string} [preferences.protocol] - Force 'wireguard' or 'v2ray'
 * @param {boolean} [preferences.strictCountry=false] - If true, fail if exact country unavailable
 * @param {number} [preferences.maxNodes=50] - Max nodes to evaluate
 *
 * @returns {Promise<{
 *   action: 'connect'|'connect-fallback'|'cannot-connect',
 *   confidence: number,
 *   primary: object|null,
 *   alternatives: object[],
 *   fallbackStrategy: string,
 *   estimatedCost: { udvpn: number, p2p: string },
 *   warnings: string[],
 *   reasoning: string[],
 *   capabilities: { wireguard: boolean, v2ray: boolean, admin: boolean },
 * }>}
 */
export async function recommend(preferences = {}) {
  if (preferences && typeof preferences !== 'object') {
    throw new Error('recommend(): preferences must be an object or undefined');
  }
  const {
    country = null,
    budget = 0,
    priority = 'reliability',
    gigabytes = 1,
    protocol = null,
    strictCountry = false,
    maxNodes = 50,
  } = preferences;

  const warnings = [];
  const reasoning = [];
  const countryCode = toCountryCode(country);

  // ─── Capabilities assessment ───────────────────────────────────────────

  const canWG = WG_AVAILABLE && IS_ADMIN;
  const canV2 = true; // V2Ray always available if binary exists
  const capabilities = { wireguard: canWG, v2ray: canV2, admin: IS_ADMIN };

  if (protocol === 'wireguard' && !canWG) {
    warnings.push('WireGuard requested but not available (need admin + WireGuard installed). Falling back to V2Ray.');
    reasoning.push('Protocol constraint: WireGuard unavailable, using V2Ray');
  }
  if (!IS_ADMIN && WG_AVAILABLE) {
    warnings.push('WireGuard installed but not admin — running as admin unlocks faster WireGuard nodes');
  }

  // ─── Fetch nodes ───────────────────────────────────────────────────────

  reasoning.push('Fetching active nodes from chain...');
  let allNodes;
  try {
    // fetchActiveNodes returns raw chain data (no country/location).
    // If country filter needed, we need enriched data from queryOnlineNodes.
    if (countryCode) {
      reasoning.push('Country filter requested — probing nodes for location data...');
      allNodes = await queryOnlineNodes({ maxNodes: maxNodes * 3 });
    } else {
      allNodes = await fetchActiveNodes();
    }
    reasoning.push(`Found ${allNodes.length} active nodes`);
  } catch (err) {
    return {
      action: 'cannot-connect',
      confidence: 0,
      primary: null,
      alternatives: [],
      fallbackStrategy: 'none',
      estimatedCost: { udvpn: 0, p2p: '0 P2P' },
      warnings: [`Chain query failed: ${err.message}`],
      reasoning: ['Cannot fetch nodes — network may be unreachable'],
      capabilities,
    };
  }

  // ─── Filter by protocol ────────────────────────────────────────────────

  const { filtered: candidates } = filterByProtocol(allNodes, protocol, capabilities, reasoning);

  // ─── Filter by country ─────────────────────────────────────────────────

  const { exactCountryNodes, nearbyNodes } = filterByCountry(
    candidates, countryCode, country, strictCountry, reasoning,
  );

  // ─── Score and rank ────────────────────────────────────────────────────

  const top = rankNodes(exactCountryNodes, nearbyNodes, candidates, priority, maxNodes);

  // ─── Build recommendation ──────────────────────────────────────────────

  if (top.length === 0) {
    return {
      action: 'cannot-connect',
      confidence: 0,
      primary: null,
      alternatives: [],
      fallbackStrategy: strictCountry ? 'fail' : 'none',
      estimatedCost: { udvpn: 0, p2p: '0 P2P' },
      warnings: [`No nodes available${country ? ` for ${country}` : ''}`],
      reasoning,
      capabilities,
    };
  }

  if (countryCode && exactCountryNodes.length === 0 && strictCountry) {
    return {
      action: 'cannot-connect',
      confidence: 0,
      primary: null,
      alternatives: top.slice(0, 5).map(formatNode),
      fallbackStrategy: 'fail — strictCountry is true',
      estimatedCost: { udvpn: 0, p2p: '0 P2P' },
      warnings: [`No nodes in ${country} (${countryCode}). strictCountry=true prevents fallback.`],
      reasoning,
      capabilities,
    };
  }

  const primary = top[0];
  const alternatives = top.slice(1, 6).map(formatNode);
  const gasCost = 40000;
  const sessionCost = (primary._price || 100000) * gigabytes;
  const totalCost = sessionCost + gasCost;

  // Budget check
  if (budget > 0 && budget < totalCost) {
    warnings.push(`Budget (${formatP2P(budget)}) may be insufficient for ${gigabytes} GB (estimated ${formatP2P(totalCost)})`);
  }

  // Determine action
  let action = 'connect';
  let confidence = 0.9;

  if (countryCode && exactCountryNodes.length === 0) {
    action = 'connect-fallback';
    confidence = 0.7;
    const fc = primary._fallbackCountry || 'nearest available';
    warnings.push(`Exact country ${country} not available. Recommending ${fc} as fallback.`);
    reasoning.push(`Fallback: ${country} → ${fc}`);
  }

  // Determine fallback strategy
  let fallbackStrategy = 'auto — SDK tries next node on failure';
  if (countryCode && exactCountryNodes.length > 0) {
    fallbackStrategy = `${exactCountryNodes.length} nodes in ${country}; SDK retries within country`;
  } else if (nearbyNodes.length > 0) {
    fallbackStrategy = `nearest-country — ${nearbyNodes.length} nodes in nearby countries`;
  }

  return {
    action,
    confidence,
    primary: formatNode(primary),
    alternatives,
    fallbackStrategy,
    estimatedCost: { udvpn: totalCost, p2p: formatP2P(totalCost) },
    warnings,
    reasoning,
    capabilities,
  };
}
