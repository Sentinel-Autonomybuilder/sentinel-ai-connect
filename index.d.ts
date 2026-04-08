/**
 * Sentinel AI Connect — TypeScript Declarations
 *
 * Zero-config decentralized VPN for AI agents.
 * One function call to private internet access through Sentinel's P2P network.
 *
 * Agent flow:
 *   1. setup()           -> environment detection
 *   2. createWallet()    -> { mnemonic, address }
 *   3. getBalance(m)     -> { p2p, udvpn, funded }
 *   4. discoverNodes()   -> [{ address, country, protocol, score }]
 *   5. estimateCost()    -> { perGb, total, gas, grandTotal }
 *   6. recommend()       -> { action, primary, alternatives }
 *   7. connect(opts)     -> { sessionId, protocol, ip, socksPort }
 *   8. verify()          -> { connected, ip, verified, latency }
 *   9. onEvent(cb)       -> unsubscribe function
 *  10. disconnect()      -> { disconnected: true }
 */

// ─── Price Amount ──────────────────────────────────────────────────────────

/** A token amount expressed in both raw (udvpn) and formatted (P2P) units. */
export interface TokenAmount {
  udvpn: number;
  p2p: string;
}

// ─── Connect Options ───────────────────────────────────────────────────────

/** Options for connect(). Only `mnemonic` is required. */
export interface ConnectOptions {
  /** BIP39 mnemonic (12 or 24 words). Required. */
  mnemonic: string;

  /** Preferred country code (e.g. 'US', 'DE') or full name. */
  country?: string;

  /** Specific node address (sentnode1...). Skips auto-pick when provided. */
  nodeAddress?: string;

  /** DNS preset: 'google', 'cloudflare', or 'hns' (Handshake). */
  dns?: string;

  /** Preferred tunnel protocol. */
  protocol?: 'wireguard' | 'v2ray';

  /** Progress callback invoked at each connection stage. */
  onProgress?: (stage: string, message: string) => void;

  /** Connection timeout in milliseconds. Default: 120000 (2 minutes). */
  timeout?: number;

  /** If true, suppress step-by-step console output. */
  silent?: boolean;

  /** Data allowance in GB for the session subscription. */
  gigabytes?: number;

  /** Session duration in hours (alternative to gigabytes). */
  hours?: number;

  /** If false, use split tunnel (only VPN-destined traffic through tunnel). Default: true. */
  fullTunnel?: boolean;

  /** Enable kill switch — block all traffic if VPN drops. */
  killSwitch?: boolean;

  /** Configure system-wide proxy settings for V2Ray SOCKS5. */
  systemProxy?: boolean;

  /** IPs to route through VPN in split-tunnel mode (WireGuard). Sets fullTunnel=false. */
  splitIPs?: string[];

  /** Enable SOCKS5 authentication for V2Ray proxy. */
  socksAuth?: boolean;

  /** Absolute path to V2Ray binary. Auto-detected if omitted. */
  v2rayExePath?: string;

  /** Maximum number of node connection attempts before giving up. */
  maxAttempts?: number;

  /** Simulate connection without broadcasting a TX or spending tokens. */
  dryRun?: boolean;

  /** Force creating a new session even if one already exists. */
  forceNewSession?: boolean;

  /** AbortSignal for external cancellation. */
  signal?: AbortSignal;
}

// ─── Connect Result ────────────────────────────────────────────────────────

/** Returned by connect() on success. */
export interface ConnectResult {
  /** On-chain session ID. */
  sessionId: string;

  /** Tunnel protocol used: 'wireguard' or 'v2ray'. */
  protocol: string;

  /** Node address (sentnode1...) that was connected to. */
  nodeAddress: string;

  /** Country of the connected node, or null if unknown. */
  country: string | null;

  /** City of the connected node, or null if unknown. */
  city: string | null;

  /** Node moniker (operator-chosen name), or null. */
  moniker: string | null;

  /** SOCKS5 proxy port for V2Ray connections, or null for WireGuard. */
  socksPort: number | null;

  /** SOCKS5 authentication credentials, or null. */
  socksAuth: { username: string; password: string } | null;

  /** True if this was a dry-run (no real session created). */
  dryRun: boolean;

  /** Public IP address through the VPN tunnel, or null if check failed. */
  ip: string | null;

  /** Wallet address (sent1...) used for the connection. */
  walletAddress: string;

  /** Balance before and after the connection. */
  balance: {
    before: string;
    after: string | null;
  };

  /** Session cost information. */
  cost: {
    udvpn: number;
    p2p: string;
  };

  /** Timing breakdown for each connection phase. */
  timing: {
    totalMs: number;
    totalFormatted: string;
    phases: {
      environment?: number;
      wallet?: number;
      balance?: number;
      nodeSelection?: number;
      sessionAndTunnel?: number;
      verify?: number;
      total?: number;
    };
  };
}

// ─── Disconnect Result ─────────────────────────────────────────────────────

/** Returned by disconnect(). */
export interface DisconnectResult {
  /** Always true on success. */
  disconnected: boolean;

  /** Session ID that was ended, or null. */
  sessionId: string | null;

  /** Remaining balance after disconnect, or null. */
  balance: string | null;

  /** Timing information. */
  timing: {
    /** Milliseconds the VPN was connected, or null. */
    connectedMs: number | null;
    /** Milliseconds the initial connect() took, or null. */
    setupMs: number | null;
  };
}

// ─── Status Result ─────────────────────────────────────────────────────────

/** Returned by status(). */
export interface StatusResult {
  /** Whether the VPN is currently connected. */
  connected: boolean;

  /** On-chain session ID, or null if not connected. */
  sessionId?: string | null;

  /** Tunnel protocol in use, or null. */
  protocol?: string | null;

  /** Connected node address, or null. */
  nodeAddress?: string | null;

  /** Country of the connected node, or null. */
  country?: string | null;

  /** City of the connected node, or null. */
  city?: string | null;

  /** SOCKS5 proxy port (V2Ray), or null. */
  socksPort?: number | null;

  /** Milliseconds since connection was established. */
  uptimeMs?: number;

  /** Human-readable uptime string (e.g. '5m 30s'). */
  uptimeFormatted?: string;

  /** Public IP through VPN, or null. */
  ip?: string | null;

  /** Balance snapshot from the connect() call. */
  balance?: {
    before: string;
    after: string | null;
  } | null;
}

// ─── Verify Result ─────────────────────────────────────────────────────────

/** Returned by verify(). */
export interface VerifyResult {
  /** Whether the VPN tunnel is up. */
  connected: boolean;

  /** Public IP through the tunnel, or null if check failed. */
  ip: string | null;

  /** True if IP check or SDK verification succeeded. */
  verified: boolean;

  /** Round-trip latency of the IP check in milliseconds, or null. */
  latency: number | null;
}

// ─── Verify Split Tunnel Result ────────────────────────────────────────────

/** Returned by verifySplitTunnel(). */
export interface VerifySplitTunnelResult {
  /** True if proxy and direct IPs differ (split tunnel working). */
  splitTunnel: boolean;

  /** IP seen through the VPN proxy, or null. */
  proxyIp: string | null;

  /** IP seen via direct connection (bypassing VPN), or null. */
  directIp: string | null;

  /** Tunnel protocol in use, or null. */
  protocol: string | null;
}

// ─── Wallet Types ──────────────────────────────────────────────────────────

/** Returned by createWallet(). */
export interface WalletResult {
  /** BIP39 mnemonic phrase (12 words). Store securely. */
  mnemonic: string;

  /** Derived Sentinel address (sent1...). */
  address: string;
}

/** Returned by importWallet(). */
export interface ImportWalletResult {
  /** Derived Sentinel address (sent1...). */
  address: string;
}

/** Returned by getBalance(). */
export interface BalanceResult {
  /** Wallet address (sent1...). */
  address: string;

  /** Formatted balance string (e.g. '42.50 P2P'). */
  p2p: string;

  /** Raw balance in micro-denomination (1 P2P = 1,000,000 udvpn). */
  udvpn: number;

  /** True if balance is sufficient for at least one VPN session. */
  funded: boolean;
}

// ─── Setup / Environment Types ─────────────────────────────────────────────

/** V2Ray binary detection result. */
export interface V2RayInfo {
  available: boolean;
  version: string | null;
  path: string | null;
}

/** WireGuard detection result. */
export interface WireGuardInfo {
  available: boolean;
  path: string | null;
  requiresAdmin: true;
}

/** Returned by getEnvironment(). Synchronous snapshot of the runtime. */
export interface EnvironmentResult {
  /** Normalized OS: 'windows', 'macos', 'linux', or raw platform string. */
  os: string;

  /** CPU architecture (e.g. 'x64', 'arm64'). */
  arch: string;

  /** Combined platform string (e.g. 'windows-x64'). */
  platform: string;

  /** Node.js version (e.g. '20.11.0'). */
  nodeVersion: string;

  /** Whether the process has admin/root privileges. */
  admin: boolean;

  /** V2Ray binary detection details. */
  v2ray: V2RayInfo;

  /** WireGuard detection details. */
  wireguard: WireGuardInfo;

  /** Available tunnel capabilities (e.g. ['v2ray', 'wireguard']). */
  capabilities: string[];

  /** Recommended actions to improve the environment. */
  recommended: string[];
}

/** Returned by setup(). Flat structure for easy agent access. */
export interface SetupResult {
  /** True if the environment is ready for VPN connections. */
  ready: boolean;

  /** Normalized OS: 'windows', 'macos', 'linux'. */
  os: string;

  /** CPU architecture. */
  arch: string;

  /** Combined platform string. */
  platform: string;

  /** Node.js version. */
  nodeVersion: string;

  /** Whether the process has admin/root privileges. */
  admin: boolean;

  /** Whether V2Ray binary is available. */
  v2ray: boolean;

  /** V2Ray version string, or null. */
  v2rayVersion: string | null;

  /** Absolute path to V2Ray binary, or null. */
  v2rayPath: string | null;

  /** Whether WireGuard is available. */
  wireguard: boolean;

  /** Absolute path to WireGuard binary, or null. */
  wireguardPath: string | null;

  /** Available tunnel capabilities. */
  capabilities: string[];

  /** Recommended setup actions. */
  recommended: string[];

  /** Preflight check results, or null if preflight failed. */
  preflight: Record<string, unknown> | null;

  /** List of issues preventing readiness. Empty if ready. */
  issues: string[];

  /** Full nested environment object (backward compat). */
  environment: EnvironmentResult;
}

// ─── Discovery Types ───────────────────────────────────────────────────────

/** Options for discoverNodes(). */
export interface DiscoverOptions {
  /** Filter by country name or ISO code (e.g. 'Germany', 'DE'). */
  country?: string;

  /** Filter by tunnel protocol. */
  protocol?: 'wireguard' | 'v2ray';

  /** Max price in udvpn per GB. Filters out expensive nodes. */
  maxPrice?: number;

  /** Max number of nodes to return. Default: 50. */
  limit?: number;

  /** If true, use chain-only data (fast, no probing). Default: false. */
  quick?: boolean;

  /** Progress callback during node probing. */
  onProgress?: (progress: { total: number; probed: number; online: number }) => void;
}

/** A discovered node from discoverNodes(). */
export interface DiscoveredNode {
  /** Node address (sentnode1...). */
  address: string;

  /** Country where the node is located, or null. */
  country: string | null;

  /** Tunnel protocol: 'wireguard' or 'v2ray'. */
  protocol: string;

  /** Price per gigabyte, or null if not priced in udvpn. */
  pricePerGb: TokenAmount | null;

  /** Price per hour, or null if not available. */
  pricePerHour: TokenAmount | null;

  /** Quality score (higher is better). */
  score: number;

  /** Number of currently connected peers. */
  peers: number;

  /** Node's remote URL/address. */
  remoteUrl: string;
}

/** Extended array returned by discoverNodes() with metadata. */
export interface DiscoverResult extends Array<DiscoveredNode> {
  /** Total number of nodes matching filters (before limit). */
  total?: number;

  /** Number of nodes in this result set. */
  showing?: number;
}

/** Returned by getNodeInfo(). */
export interface NodeInfo {
  /** Node address (sentnode1...). */
  address: string;

  /** Pricing information from the node. */
  prices: Record<string, unknown>;

  /** True if the node responded (always true if no error thrown). */
  online: boolean;
}

/** Returned by getNetworkStats(). */
export interface NetworkStats {
  /** Total number of active nodes on the network. */
  totalNodes: number;

  /** Node count by country code. */
  byCountry: Record<string, number>;

  /** Node count by protocol. */
  byProtocol: {
    wireguard: number;
    v2ray: number;
  };

  /** Transport type reliability percentages. */
  transportReliability: Record<string, number>;
}

// ─── Pricing Types ─────────────────────────────────────────────────────────

/** Options for estimateCost(). */
export interface EstimateCostOptions {
  /** Planned data usage in GB. Default: 1. */
  gigabytes?: number;

  /** Planned session duration in hours (alternative to GB). */
  hours?: number;

  /** Available budget in udvpn — calculates how much you can get. */
  budget?: number;

  /** Specific node address for exact on-chain pricing. */
  nodeAddress?: string;
}

/** Returned by estimateCost(). */
export interface CostEstimate {
  /** Cost per gigabyte. */
  perGb: TokenAmount;

  /** Total data/time cost (before gas). */
  total: TokenAmount;

  /** Gas (transaction fee) cost. */
  gas: TokenAmount;

  /** Grand total: data cost + gas. */
  grandTotal: TokenAmount;

  /** Budget analysis (only present if `budget` was provided). */
  forBudget?: {
    /** How many GB the budget covers. */
    gigabytes: number;
    /** How many hours the budget covers, or null. */
    hours: number | null;
  };

  /** Pricing mode: 'per-gb' (exact node GB), 'hourly' (exact node hourly), or 'estimate' (network average). */
  mode: 'per-gb' | 'hourly' | 'estimate';
}

/** Reference pricing constants. Approximate network-wide observations. */
export interface PricingReference {
  /** Median price per GB across the network. */
  medianPerGb: TokenAmount;

  /** Cheapest price per GB observed. */
  cheapestPerGb: TokenAmount;

  /** Typical (median) price per GB. Same as medianPerGb. */
  typicalPerGb: TokenAmount;

  /** Minimum recommended balance for one session. */
  minBalance: TokenAmount;

  /** Approximate gas cost per transaction. */
  gasCost: TokenAmount;

  /** Chain denomination string ('udvpn'). */
  denom: string;
}

// ─── Recommendation Types ──────────────────────────────────────────────────

/** Preferences for the recommend() decision engine. */
export interface RecommendPreferences {
  /** Preferred country (name or ISO code). */
  country?: string;

  /** Available budget in udvpn. */
  budget?: number;

  /** What matters most to the agent. Default: 'reliability'. */
  priority?: 'reliability' | 'cost' | 'speed' | 'location';

  /** Planned data usage in GB. Default: 1. */
  gigabytes?: number;

  /** Force a specific tunnel protocol. */
  protocol?: 'wireguard' | 'v2ray';

  /** If true, fail if exact country is unavailable. Default: false. */
  strictCountry?: boolean;

  /** Max nodes to evaluate. Default: 50. */
  maxNodes?: number;
}

/** A recommended node from the decision engine. */
export interface RecommendedNode {
  /** Node address (sentnode1...). */
  address: string;

  /** Country of the node, or null. */
  country: string | null;

  /** Tunnel protocol: 'wireguard' or 'v2ray'. */
  protocol: string;

  /** Composite score (higher is better). */
  score: number;

  /** Price per GB, or null. */
  pricePerGb: TokenAmount | null;

  /** Current peer count, or null. */
  peers: number | null;

  /** Human-readable reason this node was chosen. */
  reason: string;
}

/** Returned by recommend(). */
export interface RecommendResult {
  /** Recommended action: 'connect' (exact match), 'connect-fallback' (nearby country), or 'cannot-connect'. */
  action: 'connect' | 'connect-fallback' | 'cannot-connect';

  /** Confidence score 0-1 in the recommendation. */
  confidence: number;

  /** Top recommended node, or null if cannot-connect. */
  primary: RecommendedNode | null;

  /** Alternative nodes ranked by score. */
  alternatives: RecommendedNode[];

  /** Description of the fallback strategy. */
  fallbackStrategy: string;

  /** Estimated total cost for the session. */
  estimatedCost: TokenAmount;

  /** Warnings about the recommendation (budget, protocol, etc.). */
  warnings: string[];

  /** Step-by-step reasoning trace for agent transparency. */
  reasoning: string[];

  /** What this environment supports. */
  capabilities: {
    wireguard: boolean;
    v2ray: boolean;
    admin: boolean;
  };
}

// ─── Error Types ───────────────────────────────────────────────────────────

/** Machine-readable error codes for AI agent error handling. */
export declare const AiPathErrorCodes: {
  // Wallet
  readonly MISSING_MNEMONIC: 'MISSING_MNEMONIC';
  readonly INVALID_MNEMONIC: 'INVALID_MNEMONIC';
  readonly INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE';

  // Environment
  readonly SETUP_FAILED: 'SETUP_FAILED';
  readonly ENVIRONMENT_NOT_READY: 'ENVIRONMENT_NOT_READY';
  readonly V2RAY_NOT_FOUND: 'V2RAY_NOT_FOUND';
  readonly WIREGUARD_NOT_FOUND: 'WIREGUARD_NOT_FOUND';
  readonly ADMIN_REQUIRED: 'ADMIN_REQUIRED';

  // Connection
  readonly CONNECT_FAILED: 'CONNECT_FAILED';
  readonly DISCONNECT_FAILED: 'DISCONNECT_FAILED';
  readonly ALREADY_CONNECTED: 'ALREADY_CONNECTED';
  readonly ALL_NODES_FAILED: 'ALL_NODES_FAILED';
  readonly NO_NODES_IN_COUNTRY: 'NO_NODES_IN_COUNTRY';
  readonly NODE_OFFLINE: 'NODE_OFFLINE';
  readonly HANDSHAKE_FAILED: 'HANDSHAKE_FAILED';
  readonly TUNNEL_FAILED: 'TUNNEL_FAILED';
  readonly TIMEOUT: 'TIMEOUT';

  // Validation
  readonly INVALID_OPTIONS: 'INVALID_OPTIONS';

  // Discovery
  readonly DISCOVERY_FAILED: 'DISCOVERY_FAILED';
  readonly WALLET_FAILED: 'WALLET_FAILED';
  readonly BALANCE_FAILED: 'BALANCE_FAILED';
  readonly VERIFY_FAILED: 'VERIFY_FAILED';
};

/** Union type of all error code string values. */
export type AiPathErrorCode = typeof AiPathErrorCodes[keyof typeof AiPathErrorCodes];

/** Machine-readable next-action hints for AI agents. */
export declare const NextActions: {
  readonly CREATE_WALLET: 'create_wallet';
  readonly FUND_WALLET: 'fund_wallet';
  readonly RUN_SETUP: 'run_setup';
  readonly RUN_AS_ADMIN: 'run_as_admin';
  readonly TRY_DIFFERENT_NODE: 'try_different_node';
  readonly TRY_DIFFERENT_COUNTRY: 'try_different_country';
  readonly TRY_V2RAY: 'try_v2ray';
  readonly TRY_WIREGUARD: 'try_wireguard';
  readonly DISCONNECT_FIRST: 'disconnect';
  readonly RETRY: 'retry';
  readonly NONE: 'none';
};

/** Union type of all next-action string values. */
export type NextAction = typeof NextActions[keyof typeof NextActions];

/** Typed error with machine-readable code and agent-actionable nextAction. */
export declare class AiPathError extends Error {
  /** Machine-readable error code from AiPathErrorCodes. */
  readonly code: AiPathErrorCode;

  /** Extra context for the agent (e.g. { address, balance, minimum }). */
  readonly details: Record<string, unknown> | null;

  /** What the agent should do next (from NextActions). */
  readonly nextAction: NextAction;

  readonly name: 'AiPathError';

  constructor(
    code: AiPathErrorCode,
    message: string,
    details?: Record<string, unknown> | null,
    nextAction?: NextAction,
  );

  /** Serialize to a plain object for structured logging. */
  toJSON(): {
    name: 'AiPathError';
    code: AiPathErrorCode;
    message: string;
    details: Record<string, unknown> | null;
    nextAction: NextAction;
  };
}

// ─── Event Types ───────────────────────────────────────────────────────────

/** Event names emitted by the VPN connection. */
export type VpnEventType =
  | 'progress'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'reconnecting'
  | 'reconnected'
  | 'sessionEnd'
  | 'sessionEndFailed';

/** Callback signature for onEvent(). */
export type VpnEventCallback = (eventType: VpnEventType, data: Record<string, unknown>) => void;

/** Function that removes the event listener when called. */
export type Unsubscribe = () => void;

// ─── Exported Constants ────────────────────────────────────────────────────

/** Reference pricing sampled from chain data. Approximate -- use estimateCost() for live pricing. */
export declare const PRICING: PricingReference;

// ─── Phase 1: Setup & Environment ──────────────────────────────────────────

/**
 * Full environment setup: check dependencies, install missing, report status.
 * Call this first to understand what the environment supports.
 */
export declare function setup(): Promise<SetupResult>;

/**
 * Synchronous environment detection. Returns current state without modifying anything.
 */
export declare function getEnvironment(): EnvironmentResult;

// ─── Phase 2-3: Wallet & Funding ───────────────────────────────────────────

/**
 * Generate a brand new Sentinel wallet.
 * Returns a mnemonic (store securely!) and the derived sent1... address.
 */
export declare function createWallet(): Promise<WalletResult>;

/**
 * Import an existing wallet from a BIP39 mnemonic.
 * Validates the mnemonic and derives the sent1... address.
 *
 * @param mnemonic - 12 or 24 word BIP39 phrase
 */
export declare function importWallet(mnemonic: string): Promise<ImportWalletResult>;

/**
 * Check the P2P token balance of a wallet.
 *
 * @param mnemonic - 12 or 24 word BIP39 phrase
 */
export declare function getBalance(mnemonic: string): Promise<BalanceResult>;

// ─── Phase 4: Node Discovery ───────────────────────────────────────────────

/**
 * Discover available nodes with optional filters.
 * Returns enriched node list sorted by quality score.
 *
 * @param opts - Discovery filters and options
 */
export declare function discoverNodes(opts?: DiscoverOptions): Promise<DiscoverResult>;

/**
 * Get detailed info for a specific node including pricing.
 *
 * @param nodeAddress - sentnode1... address
 */
export declare function getNodeInfo(nodeAddress: string): Promise<NodeInfo>;

/**
 * Get network-wide statistics: total nodes, distribution by country and protocol.
 */
export declare function getNetworkStats(): Promise<NetworkStats>;

// ─── Phase 5: Cost Estimation ──────────────────────────────────────────────

/**
 * Estimate connection cost before committing tokens.
 * Provide a nodeAddress for exact pricing, or omit for network-average estimates.
 *
 * @param opts - Cost estimation parameters
 */
export declare function estimateCost(opts?: EstimateCostOptions): Promise<CostEstimate>;

// ─── Phase 5.5: Decision Engine ────────────────────────────────────────────

/**
 * Generate structured recommendations for an autonomous AI agent.
 * The agent provides preferences; the SDK returns ranked options
 * with cost estimates, warnings, and fallback strategies.
 *
 * @param preferences - Agent preferences for node selection
 */
export declare function recommend(preferences?: RecommendPreferences): Promise<RecommendResult>;

// ─── Phase 6-7: Connect, Verify, Monitor ───────────────────────────────────

/**
 * Connect to Sentinel dVPN. The ONE function an AI agent needs.
 * Every step is logged with numbered phases for agent observability.
 *
 * @param opts - Connection options (mnemonic is required)
 */
export declare function connect(opts: ConnectOptions): Promise<ConnectResult>;

/**
 * Disconnect from VPN. Tears down tunnel, cleans up system state.
 * Returns session cost and remaining balance for agent accounting.
 */
export declare function disconnect(): Promise<DisconnectResult>;

/**
 * Get current VPN connection status.
 * Returns everything an agent needs to assess the connection.
 */
export declare function status(): StatusResult;

/**
 * Quick boolean check: is the VPN tunnel active right now?
 */
export declare function isVpnActive(): boolean;

/**
 * Verify the VPN connection is actually working.
 * Checks: tunnel is up, traffic flows, IP has changed.
 */
export declare function verify(): Promise<VerifyResult>;

/**
 * Verify split tunneling is working correctly.
 * For V2Ray: confirms SOCKS5 proxy routes traffic through VPN while direct traffic bypasses.
 * For WireGuard: confirms tunnel is active.
 */
export declare function verifySplitTunnel(): Promise<VerifySplitTunnelResult>;

/**
 * Subscribe to VPN connection events (progress, errors, reconnect).
 * Returns an unsubscribe function -- call it to stop listening.
 *
 * @param callback - Receives (eventType, data) on each event
 * @returns Unsubscribe function
 */
export declare function onEvent(callback: VpnEventCallback): Unsubscribe;
