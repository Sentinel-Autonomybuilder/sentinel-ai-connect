#!/usr/bin/env node
/**
 * Agent Connect — CLI Entry Point
 *
 * Usage: npx blue-agent-connect <command>
 *
 * Commands:
 *   setup                          Check dependencies
 *   wallet create                  Generate new wallet
 *   wallet balance                 Check P2P balance
 *   wallet import <mnemonic...>    Import existing wallet
 *   connect [options]              Connect to VPN
 *   disconnect                     Disconnect from VPN
 *   status                         Show connection status
 *   nodes [options]                List available nodes
 *   help                           Show this message
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Shared colors/icons (also used for error display) ─────────────────────

import { c, ok, warn, err, info, banner } from './cli/shared.js';

// ─── .env Loader ────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(__dirname, '.env');
  if (!existsSync(envPath)) return;
  try {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env read failed — non-critical
  }
}

// ─── Argument Parser ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

// ─── Help ───────────────────────────────────────────────────────────────────

function showHelp() {
  banner();
  console.log(`${c.bold}USAGE${c.reset}`);
  console.log(`  blue-agent-connect <command> [options]`);
  console.log('');
  console.log(`${c.bold}COMMANDS${c.reset}`);
  console.log(`  ${c.cyan}setup${c.reset}                          Check dependencies and environment`);
  console.log(`  ${c.cyan}wallet create${c.reset}                  Generate a new wallet`);
  console.log(`  ${c.cyan}wallet balance${c.reset}                 Check P2P token balance`);
  console.log(`  ${c.cyan}wallet import${c.reset} <mnemonic...>    Import wallet from mnemonic`);
  console.log(`  ${c.cyan}connect${c.reset} [options]              Connect to VPN`);
  console.log(`  ${c.cyan}disconnect${c.reset}                     Disconnect from VPN`);
  console.log(`  ${c.cyan}status${c.reset}                         Show connection status`);
  console.log(`  ${c.cyan}nodes${c.reset} [options]                List available nodes`);
  console.log(`  ${c.cyan}help${c.reset}                           Show this message`);
  console.log('');
  console.log(`${c.bold}CONNECT OPTIONS${c.reset}`);
  console.log(`  --country <code>    Preferred country (e.g. US, DE, JP)`);
  console.log(`  --protocol <type>   Protocol: wireguard or v2ray`);
  console.log(`  --dns <preset>      DNS: google, cloudflare, or hns (Handshake)`);
  console.log(`  --node <address>    Connect to specific node (sentnode1...)`);
  console.log('');
  console.log(`${c.bold}NODES OPTIONS${c.reset}`);
  console.log(`  --country <code>    Filter by country`);
  console.log(`  --limit <n>         Max nodes to show (default: 20)`);
  console.log('');
  console.log(`${c.bold}ENVIRONMENT${c.reset}`);
  console.log(`  MNEMONIC            BIP39 mnemonic in .env file`);
  console.log('');
  console.log(`${c.bold}EXAMPLES${c.reset}`);
  console.log(`  ${c.dim}# First time setup${c.reset}`);
  console.log(`  blue-agent-connect setup`);
  console.log(`  blue-agent-connect wallet create`);
  console.log('');
  console.log(`  ${c.dim}# Connect to VPN${c.reset}`);
  console.log(`  blue-agent-connect connect`);
  console.log(`  blue-agent-connect connect --country DE --protocol wireguard`);
  console.log(`  blue-agent-connect connect --node sentnode1abc...`);
  console.log('');
  console.log(`  ${c.dim}# List nodes${c.reset}`);
  console.log(`  blue-agent-connect nodes --country US --limit 10`);
  console.log('');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const { positional, flags } = parseArgs(process.argv);
  const cmd = positional[0] || 'help';
  const sub = positional[1] || '';

  try {
    switch (cmd) {
      case 'setup': {
        const { cmdSetup } = await import('./cli/setup.js');
        await cmdSetup();
        break;
      }

      case 'wallet': {
        const { cmdWalletCreate, cmdWalletBalance, cmdWalletImport } = await import('./cli/wallet.js');
        switch (sub) {
          case 'create':
            await cmdWalletCreate();
            break;
          case 'balance':
            await cmdWalletBalance();
            break;
          case 'import':
            await cmdWalletImport(positional.slice(2));
            break;
          default:
            console.log(`${err} Unknown wallet command: ${sub}`);
            console.log(`  Available: create, balance, import`);
            process.exit(1);
        }
        break;
      }

      case 'connect': {
        const { cmdConnect } = await import('./cli/connect.js');
        await cmdConnect(flags);
        break;
      }

      case 'disconnect': {
        const { cmdDisconnect } = await import('./cli/connect.js');
        await cmdDisconnect();
        break;
      }

      case 'status': {
        const { cmdStatus } = await import('./cli/connect.js');
        await cmdStatus();
        break;
      }

      case 'nodes': {
        const { cmdNodes } = await import('./cli/nodes.js');
        await cmdNodes(flags);
        break;
      }

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.log(`${err} Unknown command: ${cmd}`);
        console.log(`  Run: ${c.cyan}blue-agent-connect help${c.reset}`);
        process.exit(1);
    }
  } catch (e) {
    console.log('');
    console.log(`${err} ${c.red}${e.message}${c.reset}`);
    console.log('');

    // Provide contextual recovery hints
    if (e.message.includes('mnemonic') || e.message.includes('MNEMONIC')) {
      console.log(`${info} Generate a wallet: ${c.cyan}blue-agent-connect wallet create${c.reset}`);
      console.log(`${info} Then add MNEMONIC to your .env file`);
    } else if (e.message.includes('balance') || e.message.includes('Insufficient')) {
      console.log(`${info} Check balance: ${c.cyan}blue-agent-connect wallet balance${c.reset}`);
    } else if (e.message.includes('V2Ray') || e.message.includes('WireGuard')) {
      console.log(`${info} Run setup: ${c.cyan}blue-agent-connect setup${c.reset}`);
    }

    console.log('');
    process.exit(1);
  }
}

main();
