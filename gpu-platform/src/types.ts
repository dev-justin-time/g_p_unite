/**
 * G P Unite — Shared Type Definitions
 * Interfaces for agents, tasks, governance, and platform types
 */

// ═══════════════════════════════════════════
// AGENT TYPES
// ═══════════════════════════════════════════

export type AgentCategory = 'compute' | 'infrastructure' | 'platform';
export type AgentStatus = 'active' | 'standby';

export interface AgentRule {
  name: string;
  on: boolean;
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

// ═══════════════════════════════════════════
// TIER TYPES
// ═══════════════════════════════════════════

export interface Tier {
  name: string;
  min: string;
  mult: string;
}

// ═══════════════════════════════════════════
// TASK TYPES
// ═══════════════════════════════════════════

export interface Task {
  name: string;
  type: string;
  reward: number;
  deadline: string;
  tier: number;
}

// ═══════════════════════════════════════════
// GOVERNANCE TYPES
// ═══════════════════════════════════════════

export type ProposalRisk = 'Low' | 'Medium' | 'High';

export interface Proposal {
  id: string;
  title: string;
  type: string;
  author: string;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  deadline: string;
  risk: ProposalRisk;
}

export type VoteType = 'for' | 'against' | 'abstain';

// ═══════════════════════════════════════════
// BADGE TYPES
// ═══════════════════════════════════════════

export interface Badge {
  icon: string;
  name: string;
  desc: string;
  earned: boolean;
}

// ═══════════════════════════════════════════
// CHAT TYPES
// ═══════════════════════════════════════════

export interface ChatMessage {
  sender: string;
  text: string;
  isAgent: boolean;
}

// ═══════════════════════════════════════════
// RBAC TYPES
// ═══════════════════════════════════════════

export type UserRole = 'admin' | 'operator' | 'viewer';

export type PermissionAction =
  | 'stake' | 'unstake' | 'claim_task' | 'create_proposal'
  | 'vote' | 'approve_milestone' | 'send_chat' | 'manage_roles'
  | 'pause_contracts' | 'emergency_actions' | 'edit_settings'
  | 'launch_node' | 'configure_multi_sig' | 'use_obscura';

export interface RolePermissions {
  label: string;
  icon: string;
  cssClass: string;
  nav: string[];
  actions: Record<PermissionAction, boolean>;
}

export interface PermissionMatrixRow {
  name: string;
  admin: 'yes' | 'no';
  operator: 'yes' | 'no';
  viewer: 'yes' | 'no';
}

// ═══════════════════════════════════════════
// CHART TYPES
// ═══════════════════════════════════════════

export type ChartType = 'line' | 'area' | 'bar';

export interface ChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartConfig {
  type: ChartType;
  series: ChartSeries[];
  rangeMinutes: number;
  yFormat: (value: number) => string;
  xFormat: (timestamp: number) => string;
  fillOpacity: number;
  lineWidth: number;
  dotRadius: number;
  gridLines: number;
  padding: ChartPadding;
}

export interface HistPoint {
  ts: number;
  values: Record<string, number>;
}

// ═══════════════════════════════════════════
// WEBSOCKET TYPES
// ═══════════════════════════════════════════

export type WsStatus = 'connected' | 'disconnected' | 'connecting';

export interface WsMessage {
  type: string;
  channel?: string;
  data?: any;
  authed?: boolean;
  token?: string;
  code?: string;
  error?: string;
}

// ═══════════════════════════════════════════
// AUTH TYPES
// ═══════════════════════════════════════════

export interface AuthResponse {
  success: boolean;
  token?: string;
  role?: string;
  address?: string;
  error?: string;
}

// ═══════════════════════════════════════════
// OBSCURA TYPES
// ═══════════════════════════════════════════

export interface ObscuraScrapeOptions {
  url: string;
  eval?: string;
  dump?: string;
  screenshot?: string;
  waitUntil?: string;
  timeout?: number;
}

export interface ObscuraScrapeResult {
  success: boolean;
  output?: string;
  error?: string;
  latency?: number;
  url: string;
  code?: number;
}

export interface ObscuraMonitor {
  url: string;
  interval: number;
  changes: number;
  running: boolean;
}

export interface ObscuraStatus {
  id: string;
  name: string;
  icon: string;
  status: string;
  connected: boolean;
  port: number;
  metrics: AgentMetric[];
  history: Array<{ url: string; success: boolean; latency: number; timestamp: number }>;
  monitors: ObscuraMonitor[];
}
