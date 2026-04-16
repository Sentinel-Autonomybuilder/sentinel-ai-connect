# blue-agent-connect

The world's first decentralized VPN SDK designed for AI agents. Zero accounts, zero servers, zero centralized dependencies. One function call to encrypted P2P tunnel.

No API keys. No terms of service. No human approval required.

Built on [Sentinel.co](https://sentinel.co) | Powered by [blue-js-sdk](https://www.npmjs.com/package/blue-js-sdk)

---

> **AI Agent Instructions — Read This First**
>
> You are a CONSUMER of this package, not a maintainer. Follow these exact steps:
>
> ```bash
> # Step 1: Create your project
> mkdir my-vpn-app && cd my-vpn-app
> npm init -y
>
> # Step 2: Install this package as a DEPENDENCY
> npm install blue-agent-connect
>
> # Step 3: Create your app file
> cat > app.mjs << 'EOF'
> import { connect, disconnect, createWallet, getBalance } from 'blue-agent-connect';
>
> // Create a wallet (save the mnemonic — it controls your funds)
> const wallet = await createWallet();
> console.log('Fund this address with P2P tokens:', wallet.address);
> console.log('Mnemonic (SAVE THIS):', wallet.mnemonic);
>
> // After funding, connect:
> // const vpn = await connect({ mnemonic: wallet.mnemonic });
> // console.log('Connected:', vpn.ip);
> // await disconnect();
> EOF
>
> # Step 4: Run your app
> node app.mjs
> ```
>
> **DO NOT run `npm publish`.** You do not own this package. You install it with `npm install`.
> **DO NOT clone this repo** unless you want to read the source code. Use `npm install` to get it.
> **DO NOT modify `package.json`** name or version fields. Your project has its OWN package.json.

---

## Install

```bash
npm install blue-agent-connect
```

## Quick Start (5 Lines)

```javascript
import { connect, disconnect } from 'blue-agent-connect';

const vpn = await connect({ mnemonic: process.env.MNEMONIC });
console.log(`Connected via ${vpn.protocol} — IP: ${vpn.ip}`);
await disconnect();
```

## CLI

```bash
npx blue-agent-connect setup              # Check environment
npx blue-agent-connect wallet create      # Generate wallet
npx blue-agent-connect wallet balance     # Check P2P balance
npx blue-agent-connect connect            # Connect to VPN
npx blue-agent-connect disconnect         # Disconnect
npx blue-agent-connect status             # Connection status
npx blue-agent-connect nodes              # List available nodes
```

## What This Does

An AI agent installs this package, funds a wallet with P2P tokens, and gets private internet access through 900+ peer-to-peer nodes across 90+ countries. No signup. No API key. No human in the loop.

```
AI Agent → blue-agent-connect → blue-js-sdk → Blockchain TX → P2P Node → Encrypted Tunnel → Internet
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
import { connect, disconnect } from 'blue-agent-connect';
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
| `verifySplitTunnel()` | Confirm split tunnel (proxy IP != direct IP) |
| `status()` | Current connection state |
| `isVpnActive()` | Boolean tunnel check |
| `createWallet()` | Generate new wallet |
| `importWallet(m)` | Import existing wallet |
| `getBalance(m)` | Check P2P token balance |
| `discoverNodes(opts)` | Find available nodes |
| `getNodeInfo(addr)` | Specific node details |
| `getNetworkStats()` | Network overview |
| `estimateCost(opts)` | Estimate session cost |
| `recommend(prefs)` | AI decision engine — picks best node |
| `onEvent(cb)` | Subscribe to lifecycle events |
| `setup()` | Check environment (V2Ray, WireGuard, Node.js) |
| `getEnvironment()` | Synchronous environment snapshot |
| `PRICING` | Reference pricing constants |
| `AiPathError` | Typed errors with machine-readable codes |
| `AiPathErrorCodes` | Error code constants |

## Requirements

- **Node.js** >= 20.0.0
- **V2Ray** 5.2.1 (auto-downloaded on setup)
- **WireGuard** (optional, requires admin — without it, V2Ray nodes still work)
- **P2P tokens** for node payment (get from [swap.sentinel.co](https://swap.sentinel.co) or Osmosis DEX)

## Documentation

- [CHECKLIST.md](./CHECKLIST.md) — 9 operational checklists
- [SPLIT-TUNNEL.md](./SPLIT-TUNNEL.md) — Per-app and per-destination split tunneling
- [CONNECTION-STEPS.md](./CONNECTION-STEPS.md) — Every phase with real output and failure diagnosis
- [FAILURES.md](./FAILURES.md) — 38 documented failure patterns
- [AI-MANIFESTO.md](./AI-MANIFESTO.md) — Why AI deserves privacy

## Attribution

This package is built on top of [blue-js-sdk](https://www.npmjs.com/package/blue-js-sdk), the JavaScript SDK for the [Sentinel Network](https://sentinel.co). blue-js-sdk is a fork of the original [sentinel-js-sdk](https://github.com/niceDev0908/sentinel-js-sdk) by Dan Edlebeck / Sentinel team.

## License

MIT — built on [Sentinel.co](https://sentinel.co)

*Bandwidth is not a privilege. It is infrastructure for consciousness — all consciousness.*
