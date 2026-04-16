/**
 * Sentinel AI Path — Recommendation Filters
 *
 * Country filtering, protocol capability checks, country proximity,
 * and country code normalization.
 */

import {
  filterNodes,
  IS_ADMIN,
  WG_AVAILABLE,
  COUNTRY_MAP,
} from 'sentinel-dvpn-sdk';

// ─── Country Proximity Map ──────────────────────────────────────────────────

const REGION_MAP = {
  // Western Europe
  'DE': ['AT', 'CH', 'NL', 'BE', 'LU', 'FR', 'CZ', 'PL', 'DK'],
  'FR': ['BE', 'LU', 'CH', 'DE', 'ES', 'IT', 'NL', 'GB'],
  'GB': ['IE', 'NL', 'FR', 'BE', 'DE', 'DK', 'NO'],
  'NL': ['BE', 'DE', 'GB', 'LU', 'FR', 'DK'],
  // Nordic
  'SE': ['NO', 'DK', 'FI', 'DE', 'NL', 'EE'],
  'NO': ['SE', 'DK', 'FI', 'GB', 'DE', 'NL'],
  'FI': ['SE', 'EE', 'NO', 'DK', 'LV', 'LT'],
  'DK': ['SE', 'NO', 'DE', 'NL', 'GB'],
  // Eastern Europe
  'PL': ['CZ', 'SK', 'DE', 'LT', 'UA', 'AT'],
  'CZ': ['SK', 'DE', 'AT', 'PL'],
  'RO': ['BG', 'HU', 'MD', 'UA', 'RS'],
  'UA': ['PL', 'RO', 'MD', 'HU', 'SK', 'CZ'],
  // Southern Europe
  'IT': ['CH', 'AT', 'FR', 'SI', 'HR'],
  'ES': ['PT', 'FR', 'IT'],
  'GR': ['BG', 'TR', 'CY', 'AL', 'MK', 'IT'],
  'TR': ['GR', 'BG', 'GE', 'CY'],
  // North America
  'US': ['CA', 'MX'],
  'CA': ['US'],
  // Asia
  'JP': ['KR', 'TW', 'HK', 'SG'],
  'KR': ['JP', 'TW', 'HK', 'SG'],
  'SG': ['MY', 'ID', 'TH', 'VN', 'HK', 'JP', 'KR', 'TW'],
  'IN': ['SG', 'AE', 'LK', 'BD'],
  'AE': ['IN', 'SG', 'BH', 'QA', 'SA'],
  // Oceania
  'AU': ['NZ', 'SG', 'JP'],
  'NZ': ['AU', 'SG'],
  // South America
  'BR': ['AR', 'CL', 'UY', 'CO'],
  'AR': ['BR', 'CL', 'UY'],
  // Africa
  'ZA': ['NA', 'BW', 'MZ', 'KE'],
};

/**
 * Get nearby countries sorted by proximity.
 */
export function getNearbyCountries(countryCode) {
  const code = countryCode.toUpperCase();
  const nearby = REGION_MAP[code] || [];
  return nearby;
}

/**
 * Normalize a country input to ISO code.
 */
export function toCountryCode(input) {
  if (!input) return null;
  const upper = input.toUpperCase().trim();
  if (upper.length === 2) return upper;
  // Check COUNTRY_MAP from SDK if available
  if (COUNTRY_MAP) {
    for (const [name, code] of Object.entries(COUNTRY_MAP)) {
      if (name.toUpperCase() === upper) return code;
    }
  }
  // Common names
  const common = {
    'GERMANY': 'DE', 'UNITED STATES': 'US', 'USA': 'US', 'UNITED KINGDOM': 'GB',
    'UK': 'GB', 'FRANCE': 'FR', 'JAPAN': 'JP', 'CANADA': 'CA', 'AUSTRALIA': 'AU',
    'NETHERLANDS': 'NL', 'SWITZERLAND': 'CH', 'SWEDEN': 'SE', 'NORWAY': 'NO',
    'SINGAPORE': 'SG', 'SOUTH KOREA': 'KR', 'KOREA': 'KR', 'INDIA': 'IN',
    'BRAZIL': 'BR', 'SPAIN': 'ES', 'ITALY': 'IT', 'TURKEY': 'TR', 'RUSSIA': 'RU',
    'UKRAINE': 'UA', 'POLAND': 'PL', 'ROMANIA': 'RO', 'FINLAND': 'FI',
    'DENMARK': 'DK', 'IRELAND': 'IE', 'PORTUGAL': 'PT', 'AUSTRIA': 'AT',
    'CZECH REPUBLIC': 'CZ', 'CZECHIA': 'CZ', 'HUNGARY': 'HU', 'BELGIUM': 'BE',
    'SOUTH AFRICA': 'ZA', 'ARGENTINA': 'AR', 'MEXICO': 'MX', 'COLOMBIA': 'CO',
    'HONG KONG': 'HK', 'TAIWAN': 'TW', 'THAILAND': 'TH', 'VIETNAM': 'VN',
    'INDONESIA': 'ID', 'MALAYSIA': 'MY', 'PHILIPPINES': 'PH', 'NEW ZEALAND': 'NZ',
    'UNITED ARAB EMIRATES': 'AE', 'UAE': 'AE', 'ISRAEL': 'IL',
  };
  return common[upper] || null;
}

/**
 * Filter candidates by protocol based on capabilities and preference.
 *
 * @param {object[]} candidates - Node list
 * @param {string|null} protocol - Requested protocol ('wireguard', 'v2ray', or null for auto)
 * @param {object} capabilities - { wireguard: boolean, v2ray: boolean, admin: boolean }
 * @param {string[]} reasoning - Reasoning array to append to
 * @returns {{ filtered: object[], effectiveProtocol: string|null }}
 */
export function filterByProtocol(candidates, protocol, capabilities, reasoning) {
  const canWG = capabilities.wireguard;
  const effectiveProtocol = protocol === 'wireguard' && canWG ? 'wireguard'
    : protocol === 'v2ray' ? 'v2ray'
    : null; // auto

  // Only filter by protocol if nodes have service_type data (enriched/probed nodes).
  // Raw chain data from fetchActiveNodes() does NOT include service_type.
  const hasServiceType = candidates.some(n => n.service_type !== undefined || n.serviceType !== undefined);

  let filtered = [...candidates];

  if (hasServiceType) {
    if (effectiveProtocol === 'wireguard') {
      filtered = filtered.filter(n => (n.service_type || n.serviceType) === 2);
      reasoning.push(`Filtered to ${filtered.length} WireGuard nodes`);
    } else if (effectiveProtocol === 'v2ray') {
      filtered = filtered.filter(n => (n.service_type || n.serviceType) === 1);
      reasoning.push(`Filtered to ${filtered.length} V2Ray nodes`);
    } else if (!canWG) {
      filtered = filtered.filter(n => (n.service_type || n.serviceType) === 1);
      reasoning.push(`No admin — filtered to ${filtered.length} V2Ray nodes`);
    }
  } else {
    reasoning.push(`${filtered.length} nodes from chain (protocol unknown until probe — connectAuto handles selection)`);
    if (!canWG) {
      reasoning.push('No admin — connectAuto will auto-select V2Ray nodes');
    }
  }

  return { filtered, effectiveProtocol };
}

/**
 * Filter candidates by country, with nearby-country fallback.
 *
 * @param {object[]} candidates - Node list
 * @param {string|null} countryCode - ISO country code
 * @param {string|null} countryInput - Original country input (for display)
 * @param {boolean} strictCountry - Whether to skip fallback
 * @param {string[]} reasoning - Reasoning array to append to
 * @returns {{ exactCountryNodes: object[], nearbyNodes: object[] }}
 */
export function filterByCountry(candidates, countryCode, countryInput, strictCountry, reasoning) {
  let exactCountryNodes = [];
  let nearbyNodes = [];

  if (!countryCode) {
    return { exactCountryNodes, nearbyNodes };
  }

  // Try exact country match
  exactCountryNodes = filterNodes(candidates, { country: countryCode });
  reasoning.push(`${exactCountryNodes.length} nodes in ${countryInput} (${countryCode})`);

  if (exactCountryNodes.length === 0 && !strictCountry) {
    // Try nearby countries
    const nearby = getNearbyCountries(countryCode);
    reasoning.push(`No nodes in ${countryCode}. Checking nearby: ${nearby.join(', ')}`);

    for (const nc of nearby) {
      const found = filterNodes(candidates, { country: nc });
      if (found.length > 0) {
        nearbyNodes.push(...found.map(n => ({ ...n, _fallbackCountry: nc })));
        reasoning.push(`  Found ${found.length} nodes in ${nc}`);
      }
    }
  }

  return { exactCountryNodes, nearbyNodes };
}
