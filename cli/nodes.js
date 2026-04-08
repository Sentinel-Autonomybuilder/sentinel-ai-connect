/**
 * CLI Command: nodes
 *
 * Lists available Sentinel nodes with optional country filter.
 */

import { banner, c, ok, warn, info, pad } from './shared.js';

// ─── Command: nodes ─────────────────────────────────────────────────────────

export async function cmdNodes(flags) {
  banner();

  const limit = parseInt(flags.limit, 10) || 20;
  const country = flags.country || null;

  console.log(`${info} Fetching online nodes...`);
  if (country) console.log(`  Filter: country = ${c.cyan}${country}${c.reset}`);
  console.log('');

  const { queryOnlineNodes, filterNodes } = await import('../../js-sdk/index.js');

  let nodes = await queryOnlineNodes({
    maxNodes: 200,
    onNodeProbed: ({ total, probed, online }) => {
      process.stdout.write(`\r  ${c.dim}Probing: ${probed}/${total} checked, ${online} online${c.reset}`);
    },
  });
  process.stdout.write('\r' + ' '.repeat(60) + '\r'); // Clear progress line

  // Filter by country if requested
  if (country) {
    nodes = filterNodes(nodes, { country });
  }

  // Limit output
  const display = nodes.slice(0, limit);

  if (display.length === 0) {
    console.log(`${warn} No nodes found${country ? ` in "${country}"` : ''}.`);
    console.log('');
    return;
  }

  console.log(`${ok} ${c.bold}${nodes.length} nodes found${c.reset}${nodes.length > limit ? ` (showing ${limit})` : ''}`);
  console.log('');

  // Table header
  console.log(
    `  ${c.bold}${pad('#', 4)}${pad('Address', 52)}${pad('Country', 16)}${pad('Type', 12)}${pad('Score', 8)}${pad('Peers', 6)}${c.reset}`,
  );
  console.log(`  ${c.dim}${'─'.repeat(96)}${c.reset}`);

  for (let i = 0; i < display.length; i++) {
    const n = display[i];
    const addr = n.address || '?';
    const short = addr.length > 48 ? addr.slice(0, 20) + '...' + addr.slice(-20) : addr;
    const loc = n.country || n.city || '?';
    const stype = n.serviceType || '?';
    const score = n.qualityScore != null ? n.qualityScore.toFixed(1) : '-';
    const peers = n.peers != null ? String(n.peers) : '-';

    console.log(
      `  ${c.dim}${pad(String(i + 1), 4)}${c.reset}${c.cyan}${pad(short, 52)}${c.reset}${pad(loc, 16)}${pad(stype, 12)}${c.green}${pad(score, 8)}${c.reset}${pad(peers, 6)}`,
    );
  }

  console.log('');
  console.log(`${info} Connect to a node: ${c.cyan}sentinel-ai connect --node <address>${c.reset}`);
  console.log('');
}
