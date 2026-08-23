/**
 * FCM Core Type Definitions
 *
 * Shared types used across all modules: agents, contracts, configs, and API responses.
 */

// ── Agent Types ──────────────────────────────────────────────────

export type AgentType =
  | "inference"
  | "render"
  | "federated_learning"
  | "edge"
  | "zk_prover"
  | "game"
  | "science"
  | "privacy"
  | "node"
  | "storage"
  | "file_server"
  | "rewarded"
  | "tier_manager"
  | "rewards_distributor"
  | "governance"
  | "escrow"
  | "reputation"
  | "coordinator";

export type AgentCategory = "compute" | "infrastructure" | "platform";

export type AgentState =
  | "created"
  | "registering"
  | "active"
  | "heartbeating"
  | "processing"
  | "stopping"
  | "stopped"
  | "error";

export type AgentStatus = "active" | "standby";

export interface AgentRule {
  name: string;
  enabled: boolean;
  on?: boolean; // alias for backward compat
}

export interface AgentMetric {
  key: string;
  label: string;
  value: string | number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  icon: string;
  role: string;
  category: AgentCategory;
  tier: number;
  status: AgentStatus;
  rules: AgentRule[];
  metrics: AgentMetric[];
  source: string;
  tick?: (values: Record<string, string | number>) => void;
}

export interface AgentEntry {
  id: string;
  runtime: any; // AgentRuntime
  wallet: string;
  name: string;
  type: AgentType;
  capabilities: string[];
  didHash: string;
  stake: number;
  state: AgentState;
  active: boolean;
  registeredAt: string;
  error?: string;
}

// ── Contract Types ───────────────────────────────────────────────

export type TaskStatus =
  | "Open"
  | "Assigned"
  | "Completed"
  | "Disputed"
  | "Slashed"
  | "Resolved"
  | "Cancelled";

export type ProposalState =
  | "Pending"
  | "Active"
  | "Succeeded"
  | "Defeated"
  | "Queued"
  | "Executed"
  | "Cancelled";

export type EscrowState =
  | "Created"
  | "Funded"
  | "InProgress"
  | "Completed"
  | "Disputed"
  | "Resolved"
  | "Cancelled"
  | "Refunded";

export interface TierConfig {
  tier: number;
  name: string;
  minStake: string;
  minScore: number;
  rewardMultiplier: number;
  feeDiscount: number;
  maxConcurrent: number;
}

export interface Proposal {
  id: number;
  proposer: string;
  description: string;
  target: string;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  state: ProposalState;
  startBlock: number;
  endBlock: number;
  eta: number;
  totalStakedAtProposal: string;
}

export interface Milestone {
  description: string;
  amount: string;
  deliverableCID: string;
  approved: boolean;
  submitted: boolean;
  submittedAt?: number;
  approvedAt?: number;
}

export interface Escrow {
  id: number;
  client: string;
  worker: string;
  totalAmount: string;
  releasedAmount: string;
  remainingAmount: string;
  completedMilestones: number;
  totalMilestones: number;
  state: EscrowState;
  createdAt: number;
  deadline: number;
  disputeDeadline: number;
  requiresMultiSig: boolean;
  milestones: Milestone[];
}

export interface Badge {
  tokenId: number;
  operator: string;
  didHash: string;
  tier: number;
  totalWork: number;
  totalEarnings: string;
  uptimeScore: number;
  disputesWon: number;
  disputesLost: number;
  consecutiveDays: number;
  mintedAt: number;
  lastUpdated: number;
  achievements: number;
}

// ── Permission Types ─────────────────────────────────────────────

export type UserRole = "super_admin" | "admin" | "user" | "agent";

export interface Permission {
  name: string;
  description: string;
}

export interface User {
  address: string;
  role: UserRole;
  permissions: string[];
  banned: boolean;
  createdAt: string;
  lastSeen: string;
}

// ── Use Case Types ───────────────────────────────────────────────

export type UseCaseCategory =
  | "ai_inference"
  | "rendering"
  | "federated_learning"
  | "edge_compute"
  | "zk_proofs"
  | "gaming"
  | "scientific"
  | "privacy"
  | "storage"
  | "general";

export interface UseCase {
  id: string;
  name: string;
  category: UseCaseCategory;
  description: string;
  requester: string;
  requirements: string[];
  estimatedCost: number;
  maxRewardPerTask: number;
  status: "active" | "suspended" | "completed";
  createdAt: string;
}

export interface Workload {
  id: string;
  useCaseId: string;
  requester: string;
  data: any;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: any;
  createdAt: string;
  completedAt?: string;
}

// ── Dashboard & API Types ────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SystemHealth {
  status: "ok" | "degraded" | "down";
  version: string;
  uptime: number;
  requests: number;
  timestamp: string;
  mode: "live" | "mock";
}

export interface ContractAddresses {
  registry: string;
  token: string;
  tierStaking: string;
  governance: string;
  escrow: string;
  reputationNFT: string;
  rewardsPool: string;
}

// ── Config Types ─────────────────────────────────────────────────

export interface MasterAgentConfig {
  privateKey?: string;
  rpcUrl?: string;
  registryAddress?: string;
  tokenAddress?: string;
  dataDir?: string;
}

export interface DashboardConfig {
  port?: number;
  host?: string;
}

export interface RestApiConfig {
  port?: number;
  host?: string;
}

export interface AgentRuntimeConfig {
  privateKey: string;
  rpcUrl: string;
  registryAddress: string;
  tokenAddress: string;
  agentType: AgentType;
  agentName: string;
  capabilities: string[];
  geohash: string;
  processTask?: (task: any) => Promise<any>;
}

// ── Resource Types ───────────────────────────────────────────────

export interface SystemProfile {
  score: number;
  capabilities: string[];
  cpu: {
    cores: number;
    model: string;
    usage: number;
  };
  memory: {
    totalGB: number;
    freeGB: number;
    usage: number;
  };
  disk: {
    totalGB: number;
    freeGB: number;
  };
  gpu?: {
    name: string;
    vramGB: number;
    driver: string;
  };
  network: {
    downMbps: number;
    upMbps: number;
    latencyMs: number;
  };
}

export interface ResourceUsage {
  cpu: { cores: number; usage: string };
  memory: { total: string; used: string };
  disk: { total: string; used: string };
  network: { down: string; up: string };
}
