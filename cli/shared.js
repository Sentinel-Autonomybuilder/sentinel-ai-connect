/**
 * CLI Shared — ANSI colors, icons, and utilities used across all CLI handlers.
 */

// ─── ANSI Colors ────────────────────────────────────────────────────────────

export const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
};

export const ok = `${c.green}+${c.reset}`;
export const warn = `${c.yellow}!${c.reset}`;
export const err = `${c.red}x${c.reset}`;
export const info = `${c.cyan}>${c.reset}`;

// ─── Banner ─────────────────────────────────────────────────────────────────

export function banner() {
  console.log('');
  console.log(`${c.bold}${c.cyan}  Sentinel AI Connect${c.reset}  ${c.dim}v0.1.0${c.reset}`);
  console.log(`${c.dim}  Decentralized VPN for AI agents${c.reset}`);
  console.log('');
}

/** Pad string to fixed width */
export function pad(str, width) {
  if (str.length >= width) return str.slice(0, width);
  return str + ' '.repeat(width - str.length);
}
