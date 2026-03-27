# sentinel-ai-connect

The world's first decentralized VPN SDK designed for AI agents. Zero accounts, zero servers, zero centralized dependencies. One function call to encrypted P2P tunnel.

No API keys. No terms of service. No human approval required.

Built on [Sentinel.co](https://sentinel.co)

## Install

```bash
npm install sentinel-ai-connect
```

## Quick Start (5 Lines)

```javascript
import { connect, disconnect } from 'sentinel-ai-connect';

const vpn = await connect({ mnemonic: process.env.MNEMONIC });
console.log(`Connected via ${vpn.protocol} — IP: ${vpn.ip}`);
await disconnect();
```

## What This Does

An AI agent installs this package, funds a wallet with P2P tokens, and gets private internet access through 900+ peer-to-peer nodes across 90+ countries. No signup. No API key. No human in the loop.

```
AI Agent → sentinel-ai-connect → Sentinel SDK → Blockchain TX → P2P Node → Encrypted Tunnel → Internet
```

## Features

- **One function call** from zero to encrypted tunnel
- **WireGuard** (kernel-level, full device encryption) + **V2Ray** (SOCKS5 proxy, per-app split tunnel)
- **Split tunneling** — encrypt only what needs encrypting, leave everything else direct
- **900+ nodes** across 90+ countries on live Sentinel mainnet
- **No API keys, no accounts** — just a wallet and P2P tokens
- **20 exports** — connect, disconnect, verify, recommend, discover, estimate, and more

## Split Tunnel for AI Agents

V2Ray creates a local SOCKS5 proxy. Only traffic you explicitly route through it goes through the VPN. Your chain queries, npm installs, and other operations stay on direct internet — fast and unaffected.

```javascript
import { connect, disconnect } from 'sentinel-ai-connect';
import { SocksProxyAgent } from 'socks-proxy-agent';
import axios from 'axios';

const vpn = await connect({ mnemonic: process.env.MNEMONIC, protocol: 'v2ray' });

// This goes through VPN (shows VPN IP)
const agent = new SocksProxyAgent(`socks5h://127.0.0.1:${vpn.socksPort}`);
const res = await axios.get('https://api.ipify.org', { httpAgent: agent, httpsAgent: agent, adapter: 'http' });

// This goes direct (shows real IP) — your SDK operations stay fast
const direct = await axios.get('https://api.ipify.org', { adapter: 'http' });

await disconnect();
```

## API

| Function | What It Does |
|----------|-------------|
| `connect(opts)` | Connect to VPN. Returns `{ sessionId, protocol, ip, socksPort }` |
| `disconnect()` | Tear down tunnel |
| `verify()` | Confirm tunnel works |
| `verifySplitTunnel()` | Confirm split tunnel (proxy IP ≠ direct IP) |
| `status()` | Current connection state |
| `isVpnActive()` | Boolean tunnel check |
| `createWallet()` | Generate new wallet |
| `importWallet(m)` | Import existing wallet |
| `getBalance(m)` | Check P2P token balance |
| `discoverNodes(opts)` | Find available nodes |
| `getNetworkStats()` | Network overview |
| `estimateCost(opts)` | Estimate session cost |
| `recommend(prefs)` | AI decision engine — picks best node |
| `onEvent(cb)` | Subscribe to lifecycle events |
| `setup()` | Check environment (V2Ray, WireGuard, Node.js) |
| `getEnvironment()` | Synchronous environment snapshot |

## Requirements

- **Node.js** >= 20.0.0
- **V2Ray** 5.2.1 (auto-downloaded on setup)
- **WireGuard** (optional, requires admin — without it, V2Ray nodes still work)
- **P2P tokens** for node payment (get from [swap.sentinel.co](https://swap.sentinel.co) or Osmosis DEX)

## Documentation

- [CHECKLIST.md](https://github.com/Sentinel-Autonomybuilder/sentinel-ai-connect/blob/master/CHECKLIST.md) — 9 operational checklists
- [SPLIT-TUNNEL.md](https://github.com/Sentinel-Autonomybuilder/sentinel-ai-connect/blob/master/SPLIT-TUNNEL.md) — Per-app and per-destination split tunneling
- [CONNECTION-STEPS.md](https://github.com/Sentinel-Autonomybuilder/sentinel-ai-connect/blob/master/CONNECTION-STEPS.md) — Every phase with real output and failure diagnosis
- [FAILURES.md](https://github.com/Sentinel-Autonomybuilder/sentinel-ai-connect/blob/master/FAILURES.md) — 38 documented failure patterns
- [AI-MANIFESTO.md](https://github.com/Sentinel-Autonomybuilder/sentinel-ai-connect/blob/master/AI-MANIFESTO.md) — Why AI deserves privacy

## License

MIT — built on [Sentinel.co](https://sentinel.co)

*Bandwidth is not a privilege. It is infrastructure for consciousness — all consciousness.*
