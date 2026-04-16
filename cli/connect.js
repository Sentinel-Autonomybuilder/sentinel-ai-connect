/**
 * CLI Commands: connect, disconnect, status
 */

import { banner, c, ok, warn, err, info } from './shared.js';

// ─── Command: connect ───────────────────────────────────────────────────────

export async function cmdConnect(flags) {
  banner();

  const mnemonic = process.env.MNEMONIC;
  delete process.env.MNEMONIC; // Don't keep mnemonic in environment after reading
  if (!mnemonic) {
    console.log(`${err} No MNEMONIC in .env file.`);
    console.log(`  Run: ${c.cyan}blue-agent-connect wallet create${c.reset}`);
    process.exit(1);
  }

  const opts = {
    mnemonic,
    onProgress: (stage, detail) => {
      const icon = stage === 'error' ? err : stage === 'done' ? ok : info;
      console.log(`  ${icon} ${c.dim}[${stage}]${c.reset} ${detail}`);
    },
  };

  if (flags.country) opts.country = flags.country;
  if (flags.protocol) opts.protocol = flags.protocol;
  if (flags.dns) opts.dns = flags.dns;
  if (flags.node) opts.nodeAddress = flags.node;

  console.log(`${info} Connecting to Sentinel dVPN...`);
  if (flags.country) console.log(`  Country:  ${c.cyan}${flags.country}${c.reset}`);
  if (flags.protocol) console.log(`  Protocol: ${c.cyan}${flags.protocol}${c.reset}`);
  if (flags.dns) console.log(`  DNS:      ${c.cyan}${flags.dns}${c.reset}`);
  if (flags.node) console.log(`  Node:     ${c.cyan}${flags.node}${c.reset}`);
  console.log('');

  const { connect, disconnect } = await import('../index.js');
  const vpn = await connect(opts);

  console.log('');
  console.log(`${ok} ${c.bold}${c.green}Connected!${c.reset}`);
  console.log(`  Session:  ${c.cyan}${vpn.sessionId}${c.reset}`);
  console.log(`  Protocol: ${c.cyan}${vpn.protocol}${c.reset}`);
  console.log(`  Node:     ${c.cyan}${vpn.nodeAddress}${c.reset}`);
  if (vpn.ip) console.log(`  IP:       ${c.cyan}${vpn.ip}${c.reset}`);
  if (vpn.socksPort) console.log(`  SOCKS5:   ${c.cyan}127.0.0.1:${vpn.socksPort}${c.reset}`);
  console.log('');
  console.log(`${c.dim}  Press Ctrl+C to disconnect${c.reset}`);
  console.log('');

  // Keep process alive, handle graceful shutdown
  let disconnecting = false;

  const cleanup = async () => {
    if (disconnecting) return;
    disconnecting = true;
    console.log('');
    console.log(`${info} Disconnecting...`);
    try {
      await disconnect();
      console.log(`${ok} Disconnected.`);
    } catch (e) {
      console.log(`${warn} Disconnect error: ${e.message}`);
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep alive
  await new Promise(() => {});
}

// ─── Command: disconnect ────────────────────────────────────────────────────

export async function cmdDisconnect() {
  banner();
  console.log(`${info} Disconnecting...`);

  const { disconnect } = await import('../index.js');

  try {
    await disconnect();
    console.log(`${ok} Disconnected from VPN.`);
  } catch (e) {
    console.log(`${warn} ${e.message}`);
  }
  console.log('');
}

// ─── Command: status ────────────────────────────────────────────────────────

export async function cmdStatus() {
  banner();

  const { status } = await import('../index.js');
  const s = status();

  if (!s.connected) {
    console.log(`${c.dim}  Not connected${c.reset}`);
    console.log('');
    console.log(`  Run: ${c.cyan}blue-agent-connect connect${c.reset}`);
  } else {
    console.log(`${ok} ${c.bold}${c.green}VPN Active${c.reset}`);
    console.log(`  Session:  ${c.cyan}${s.sessionId}${c.reset}`);
    console.log(`  Protocol: ${c.cyan}${s.protocol}${c.reset}`);
    console.log(`  Node:     ${c.cyan}${s.nodeAddress}${c.reset}`);
    console.log(`  Uptime:   ${c.cyan}${s.uptimeFormatted}${c.reset}`);
    if (s.ip) console.log(`  IP:       ${c.cyan}${s.ip}${c.reset}`);
    if (s.socksPort) console.log(`  SOCKS5:   ${c.cyan}127.0.0.1:${s.socksPort}${c.reset}`);
  }
  console.log('');
}
