/**
 * CLI Commands: wallet create, wallet balance, wallet import
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { banner, c, ok, warn, err, info } from './shared.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const aiPathDir = resolve(__dirname, '..');

// ─── Command: wallet create ─────────────────────────────────────────────────

export async function cmdWalletCreate() {
  banner();
  console.log(`${info} Generating new wallet...`);
  console.log('');

  const { createWallet } = await import('../index.js');
  const wallet = await createWallet();

  // Write mnemonic directly to .env — never print it to stdout
  const envPath = resolve(aiPathDir, '.env');
  const mnemonicLine = `MNEMONIC=${wallet.mnemonic}`;
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    if (content.includes('MNEMONIC=')) {
      // Replace existing MNEMONIC line
      const updated = content.replace(/^MNEMONIC=.*$/m, mnemonicLine);
      writeFileSync(envPath, updated, 'utf-8');
    } else {
      appendFileSync(envPath, `\n${mnemonicLine}\n`, 'utf-8');
    }
  } else {
    writeFileSync(envPath, `${mnemonicLine}\n`, 'utf-8');
  }

  console.log(`${ok} ${c.bold}Wallet created${c.reset}`);
  console.log('');
  console.log(`${c.bold}  Address:${c.reset}   ${c.green}${wallet.address}${c.reset}`);
  console.log(`${ok} Mnemonic saved to .env (24 words). ${c.red}${c.bold}NEVER share this.${c.reset}`);
  console.log('');
  console.log(`${info} Next steps:`);
  console.log(`  1. Fund the wallet with P2P tokens`);
  console.log(`  2. Connect:  ${c.cyan}sentinel-ai connect${c.reset}`);
  console.log('');
}

// ─── Command: wallet balance ────────────────────────────────────────────────

export async function cmdWalletBalance() {
  banner();

  const mnemonic = process.env.MNEMONIC;
  delete process.env.MNEMONIC; // Don't keep mnemonic in environment after reading
  if (!mnemonic) {
    console.log(`${err} No MNEMONIC in .env file.`);
    console.log(`  Run: ${c.cyan}sentinel-ai wallet create${c.reset}`);
    console.log(`  Then add the mnemonic to your .env file.`);
    process.exit(1);
  }

  console.log(`${info} Checking balance...`);

  const { getBalance } = await import('../index.js');
  const bal = await getBalance(mnemonic);

  console.log('');
  console.log(`${ok} ${c.bold}Wallet Balance${c.reset}`);
  console.log(`  Address:  ${c.cyan}${bal.address}${c.reset}`);
  console.log(`  Balance:  ${c.bold}${bal.p2p}${c.reset}  (${bal.udvpn.toLocaleString()} udvpn)`);
  console.log(`  Status:   ${bal.funded ? `${c.green}Funded` : `${c.red}Insufficient`}${c.reset}`);
  console.log('');

  if (!bal.funded) {
    console.log(`${warn} Wallet needs P2P tokens to pay for VPN sessions.`);
    console.log(`  Send P2P tokens to: ${c.cyan}${bal.address}${c.reset}`);
    console.log('');
  }
}

// ─── Command: wallet import ─────────────────────────────────────────────────

export async function cmdWalletImport(words) {
  banner();

  if (!words || words.length === 0) {
    console.log(`${err} Usage: sentinel-ai wallet import <word1 word2 word3 ...>`);
    process.exit(1);
  }

  const mnemonic = words.join(' ');
  console.log(`${info} Validating mnemonic (${words.length} words)...`);

  const { importWallet } = await import('../index.js');
  const result = await importWallet(mnemonic);

  // Write mnemonic directly to .env — never print it to stdout
  const envPath = resolve(aiPathDir, '.env');
  const mnemonicLine = `MNEMONIC=${mnemonic}`;
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    if (content.includes('MNEMONIC=')) {
      const updated = content.replace(/^MNEMONIC=.*$/m, mnemonicLine);
      writeFileSync(envPath, updated, 'utf-8');
    } else {
      appendFileSync(envPath, `\n${mnemonicLine}\n`, 'utf-8');
    }
  } else {
    writeFileSync(envPath, `${mnemonicLine}\n`, 'utf-8');
  }

  console.log('');
  console.log(`${ok} ${c.bold}Wallet imported${c.reset}`);
  console.log(`  Address:  ${c.green}${result.address}${c.reset}`);
  console.log(`${ok} Mnemonic saved to .env (${words.length} words). ${c.red}${c.bold}NEVER share this.${c.reset}`);
  console.log('');
  console.warn(`  ${c.yellow}WARNING: Your mnemonic was passed as command arguments.${c.reset}`);
  console.warn(`  ${c.yellow}Clear your shell history: history -c (bash) or rm ~/.bash_history${c.reset}`);
  console.log('');
}
