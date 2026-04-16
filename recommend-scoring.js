/**
 * Agent Connect — Node Scoring Algorithms
 *
 * Weight calculations, protocol preference logic, and node ranking
 * for the autonomous agent recommendation engine.
 */

import { formatP2P } from 'blue-js-sdk';

// ─── Node Scoring ───────────────────────────────────────────────────────────

/**
 * Score a single node based on protocol, country match, pricing, quality, and load.
 *
 * @param {object} node - Node data
 * @param {boolean} isExactCountry - Whether this node is in the exact requested country
 * @param {boolean} isNearby - Whether this node is in a nearby country
 * @param {string} priority - Scoring priority: 'reliability', 'cost', 'speed', or 'location'
 * @returns {object} Node with _score, _price, _isWG fields attached
 */
export function scoreNode(node, isExactCountry, isNearby, priority) {
  let score = 50; // base

  // Protocol bonus
  const isWG = (node.service_type || node.serviceType) === 2;
  if (isWG) score += 15; // WireGuard more reliable

  // Country bonus
  if (isExactCountry) score += 30;
  else if (isNearby) score += 15;

  // Pricing bonus (cheaper = better if priority is cost)
  const gbPrices = node.gigabyte_prices || [];
  const udvpnPrice = gbPrices.find(p => p.denom === 'udvpn');
  const price = parseInt(udvpnPrice?.quote_value || udvpnPrice?.amount || '999999999', 10);
  if (priority === 'cost') {
    score += Math.max(0, 20 - (price / 50000)); // cheaper gets more points
  }

  // Quality score from SDK (if enriched)
  if (node.qualityScore) score += node.qualityScore * 0.2;

  // Peer count: fewer peers = less loaded
  if (node.peers !== undefined) {
    if (node.peers < 5) score += 10;
    else if (node.peers < 20) score += 5;
    else score -= 5;
  }

  return { ...node, _score: Math.round(score), _price: price, _isWG: isWG };
}

// ─── Ranking ────────────────────────────────────────────────────────────────

/**
 * Build a ranked list of nodes from exact-country, nearby, and remaining pools.
 *
 * @param {object[]} exactCountryNodes - Nodes in the exact requested country
 * @param {object[]} nearbyNodes - Nodes in nearby countries
 * @param {object[]} allCandidates - All candidate nodes (superset)
 * @param {string} priority - Scoring priority
 * @param {number} maxNodes - Maximum nodes to return
 * @returns {object[]} Ranked nodes with scoring metadata, sorted by _score descending
 */
export function rankNodes(exactCountryNodes, nearbyNodes, allCandidates, priority, maxNodes) {
  const ranked = [];

  for (const n of exactCountryNodes) {
    ranked.push(scoreNode(n, true, false, priority));
  }
  for (const n of nearbyNodes) {
    ranked.push(scoreNode(n, false, true, priority));
  }
  // Fill rest from any nodes (not already included)
  const included = new Set(ranked.map(n => n.address || n.acc_address));
  for (const n of allCandidates) {
    const addr = n.address || n.acc_address;
    if (!included.has(addr)) {
      ranked.push(scoreNode(n, false, false, priority));
    }
  }

  // Sort by score descending
  ranked.sort((a, b) => b._score - a._score);
  return ranked.slice(0, maxNodes);
}

// ─── Node Formatting ────────────────────────────────────────────────────────

/**
 * Format a node for the recommendation response.
 *
 * @param {object} node - Scored node with _score, _price, _isWG, _fallbackCountry
 * @returns {object} Clean recommendation object for the agent
 */
export function formatNode(node) {
  return {
    address: node.address || node.acc_address,
    country: node.country || node._fallbackCountry || null,
    protocol: node._isWG ? 'wireguard' : 'v2ray',
    score: node._score || 0,
    pricePerGb: node._price ? { udvpn: node._price, p2p: formatP2P(node._price) } : null,
    peers: node.peers ?? null,
    reason: node._fallbackCountry
      ? `Fallback from requested country (nearest: ${node._fallbackCountry})`
      : node._score >= 80 ? 'High reliability score'
      : node._score >= 60 ? 'Good match'
      : 'Available',
  };
}
