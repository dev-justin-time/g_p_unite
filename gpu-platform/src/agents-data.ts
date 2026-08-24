/**
 * G P Unite — Agent Data Definitions (TypeScript)
 * All 18 agents + obscura with typed rules, source, and tick functions
 */

import type {
  AgentDefinition, Tier, Task, Proposal, Badge,
  ChatMessage, PermissionMatrixRow, RolePermissions, PermissionAction, UserRole
} from './types';

// ═══════════════════════════════════════════
// COMPUTE AGENTS (8)
// ═══════════════════════════════════════════

const INF_AGENT: AgentDefinition = {
  id: 'inf', name: 'Inference Router', icon: '🧠',
  role: 'Model scheduling & batching', category: 'compute', tier: 4, status: 'active',
  rules: [
    { name: 'Batch Coalescing', on: true },
    { name: 'KV-Cache Routing', on: true },
    { name: 'VRAM Overflow Guard', on: true },
    { name: 'Quantization Auto-Select', on: true },
    { name: 'Speculative Decoding', on: true }
  ],
  metrics: [
    { key: 'tps', label: 'Tok/sec', value: 4821 },
    { key: 'queue', label: 'Queue', value: 3 },
    { key: 'batch', label: 'Batch', value: 12 }
  ],
  source: `fn route(req, pool) {
  if req.model_size > node.vram * 0.85
    return find_larger_node(req);
  if req.max_latency < 50ms
    return geo_nearest(req, radius=100km);
  if req.tokens > 2048
    return batch_coalesce(req, window=10ms);
  return least_loaded(req);
}`,
  tick(v) { v.tps = 4800 + Math.floor(Math.random() * 200); v.queue = Math.max(0, (v.queue as number) + Math.floor(Math.random() * 3) - 1); }
};

const REN_AGENT: AgentDefinition = {
  id: 'ren', name: 'Render Splitter', icon: '🎬',
  role: 'Frame distribution & dependency graph', category: 'compute', tier: 3, status: 'active',
  rules: [
    { name: 'Tile-based Splitting', on: true },
    { name: 'Dependency DAG Solver', on: true },
    { name: 'Preview Stream Encoding', on: true },
    { name: 'GPU Memory Predictor', on: true },
    { name: 'Denoise Pass Merge', on: true }
  ],
  metrics: [
    { key: 'fps', label: 'FPS', value: 24 },
    { key: 'nodes', label: 'Nodes', value: 18 },
    { key: 'progress', label: 'Done', value: '67%' }
  ],
  source: `fn split_job(job, pool) {
  let tiles = calculate_tiles(
    job.resolution, job.samples, pool.avg_vram()
  );
  let dag = build_dependency_graph(job.scene);
  return topological_schedule(tiles, dag);
}`,
  tick(v) { v.fps = 22 + Math.floor(Math.random() * 6); }
};

const FL_AGENT: AgentDefinition = {
  id: 'fl', name: 'FL Coordinator', icon: '🔒',
  role: 'Secure aggregation & privacy', category: 'compute', tier: 5, status: 'active',
  rules: [
    { name: 'Differential Privacy (ε=1.0)', on: true },
    { name: 'Secure Aggregation (MPC)', on: true },
    { name: 'Gradient Clipping (L2=1.0)', on: true },
    { name: 'Byzantine Fault Tolerance', on: true },
    { name: 'Model Poisoning Detection', on: true }
  ],
  metrics: [
    { key: 'rounds', label: 'Rounds', value: 42 },
    { key: 'hospitals', label: 'Clients', value: 156 },
    { key: 'accuracy', label: 'Accuracy', value: '94.2%' }
  ],
  source: `fn aggregate(gradients) {
  let clipped = gradients.map(g => l2_clip(g, 1.0));
  let noised = clipped.map(g => add_gaussian_noise(g, 1.0));
  return mpc_sum(noised, threshold=t+1);
}`,
  tick(v) {
    v.rounds = (v.rounds as number) + (Math.random() > 0.9 ? 1 : 0);
    v.accuracy = (94 + Math.random() * 1).toFixed(1) + '%';
  }
};

const EDGE_AGENT: AgentDefinition = {
  id: 'edge', name: 'Edge Runner', icon: '⚡',
  role: 'WASM cold-start & routing', category: 'compute', tier: 3, status: 'active',
  rules: [
    { name: 'WASM Module Cache', on: true },
    { name: 'Pre-warm Pools', on: true },
    { name: 'HTTP Route Trie Match', on: true },
    { name: 'Memory Limiter (128MB)', on: true },
    { name: 'CPU Throttle (100ms)', on: true }
  ],
  metrics: [
    { key: 'cold', label: 'Cold Start', value: '8ms' },
    { key: 'rps', label: 'RPS', value: '12.4k' },
    { key: 'funcs', label: 'Functions', value: 892 }
  ],
  source: `fn handle_request(req) {
  let route = trie_match(ROUTER, req.path);
  let module = cache_get(route.wasm_cid)
    .unwrap_or(precompile(route.wasm_cid));
  let instance = pool_checkout(module);
  return instance.call(req);
}`,
  tick(v) { v.rps = (12 + Math.random() * 1).toFixed(1) + 'k'; }
};

const ZK_AGENT: AgentDefinition = {
  id: 'zk', name: 'ZK Prover', icon: '🛡️',
  role: 'Circuit compilation & witness gen', category: 'compute', tier: 4, status: 'standby',
  rules: [
    { name: 'Circuit Pre-compilation', on: true },
    { name: 'Witness Parallelization', on: true },
    { name: 'Proof Aggregation (BLS)', on: true },
    { name: 'GPU Acceleration (CUDA)', on: true },
    { name: 'Verification Cache', on: true }
  ],
  metrics: [
    { key: 'time', label: 'Proof Time', value: '2.4s' },
    { key: 'agg', label: 'Batch', value: 16 },
    { key: 'cost', label: 'Cost', value: '$0.04' }
  ],
  source: `fn generate_proof(circuit, witness) {
  let pk = cache_get(circuit.hash)
    .unwrap_or(gpu_setup(circuit));
  let proof = gpu_prove(pk, witness);
  if batch.len >= 16
    return aggregate_proofs(batch);
  return proof;
}`,
  tick(v) { v.time = (2 + Math.random() * 0.8).toFixed(1) + 's'; }
};

const GAME_AGENT: AgentDefinition = {
  id: 'game', name: 'Game Host', icon: '🎮',
  role: 'Tick sync & matchmaking', category: 'compute', tier: 2, status: 'active',
  rules: [
    { name: 'Deterministic Lockstep', on: true },
    { name: 'Latency-Compensated Hitreg', on: true },
    { name: 'Geo-Balanced Matchmaking', on: true },
    { name: 'State Delta Compression', on: true },
    { name: 'Anti-Cheat Heuristics', on: true }
  ],
  metrics: [
    { key: 'tick', label: 'Tick/s', value: 128 },
    { key: 'players', label: 'Players', value: 64 },
    { key: 'latency', label: 'Latency', value: '18ms' }
  ],
  source: `fn game_tick(state, inputs) {
  let validated = inputs
    .filter(i => validate_timestamp(i, 200ms))
    .filter(i => speed_check(i, 500u/s));
  return deterministic_simulate(state, validated);
}`,
  tick(v) { v.latency = (14 + Math.floor(Math.random() * 8)) + 'ms'; }
};

const SCI_AGENT: AgentDefinition = {
  id: 'sci', name: 'Science Grid', icon: '🔬',
  role: 'Job splitting & validation', category: 'compute', tier: 3, status: 'standby',
  rules: [
    { name: 'Domain Decomposition', on: true },
    { name: 'Checkpoint Every 15min', on: true },
    { name: 'Result Cross-Validation', on: true },
    { name: 'BOINC Credit System', on: true },
    { name: 'Fault-Tolerant Redundancy', on: true }
  ],
  metrics: [
    { key: 'tflops', label: 'TFLOPS', value: 847 },
    { key: 'jobs', label: 'Active', value: 23 },
    { key: 'valid', label: 'Valid', value: '100%' }
  ],
  source: `fn decompose_simulation(sim, pool) {
  let grid = cartesian_split(sim.domain, pool.size());
  let halo = calculate_ghost_zones(
    sim.pde_order, sim.stencil_width
  );
  return assign_with_affinity(grid, halo);
}`,
  tick(v) { v.tflops = 800 + Math.floor(Math.random() * 100); }
};

const PRIV_AGENT: AgentDefinition = {
  id: 'priv', name: 'Privacy Mesh', icon: '🕵️',
  role: 'Mixnet routing & relay selection', category: 'compute', tier: 4, status: 'active',
  rules: [
    { name: 'Onion Layer Encryption', on: true },
    { name: 'Sphinx Packet Format', on: true },
    { name: 'Cover Traffic Generation', on: true },
    { name: 'Reputation-Weighted Path', on: true },
    { name: 'Exit Policy Enforcement', on: true }
  ],
  metrics: [
    { key: 'relays', label: 'Relays', value: '1,247' },
    { key: 'hoplat', label: 'Hop Latency', value: '145ms' },
    { key: 'throughput', label: 'Aggregate', value: '2.1Gbps' }
  ],
  source: `fn build_circuit(exit, pool) {
  let candidates = filter_by_policy(pool, exit);
  let path = weighted_sample(candidates,
    weight = r => r.bandwidth * r.reputation
  );
  return ensure_geo_diversity(path, min_hops=3);
}`,
  tick(v) { v.throughput = (2 + Math.random() * 0.4).toFixed(1) + 'Gbps'; }
};

// ═══════════════════════════════════════════
// INFRASTRUCTURE AGENTS (4)
// ═══════════════════════════════════════════

const NODE_AGENT: AgentDefinition = {
  id: 'node', name: 'Node Runner', icon: '🖥️',
  role: 'Blockchain node operations', category: 'infrastructure', tier: 2, status: 'active',
  rules: [
    { name: 'Block Validation', on: true },
    { name: 'Mempool Management', on: true },
    { name: 'Peer Discovery', on: true },
    { name: 'State Pruning', on: true },
    { name: 'RPC Load Balancing', on: true }
  ],
  metrics: [
    { key: 'blocks', label: 'Blocks/hr', value: 360 },
    { key: 'peers', label: 'Peers', value: 48 },
    { key: 'sync', label: 'Sync', value: '99.9%' }
  ],
  source: `fn validate_block(block, prev) {
  verify_signature(block);
  check_gas_limit(block, prev);
  validate_state_root(block);
  propagate_to_peers(block);
}`,
  tick(v) { v.blocks = 355 + Math.floor(Math.random() * 10); }
};

const STOR_AGENT: AgentDefinition = {
  id: 'stor', name: 'Storage Provider', icon: '💾',
  role: 'Distributed file storage', category: 'infrastructure', tier: 3, status: 'active',
  rules: [
    { name: 'Erasure Coding', on: true },
    { name: 'Replication 3x', on: true },
    { name: 'Cold Tiering', on: true },
    { name: 'Pin Verification', on: true },
    { name: 'Bandwidth Throttle', on: true }
  ],
  metrics: [
    { key: 'stored', label: 'Stored', value: '2.4TB' },
    { key: 'files', label: 'Files', value: '18.2k' },
    { key: 'retrievals', label: 'Retrievals', value: 847 }
  ],
  source: `fn store_file(data, cid) {
  let shards = erasure_encode(data, k=10, m=3);
  for shard in shards {
    pin_to_node(shard, replications=3);
  }
  return cid;
}`,
  tick(v) { v.retrievals = 800 + Math.floor(Math.random() * 100); }
};

const FSRV_AGENT: AgentDefinition = {
  id: 'fsrv', name: 'File Server', icon: '📁',
  role: 'Content delivery & streaming', category: 'infrastructure', tier: 1, status: 'active',
  rules: [
    { name: 'CDN Edge Cache', on: true },
    { name: 'Range Requests', on: true },
    { name: 'Gzip/Brotli', on: true },
    { name: 'ETag Validation', on: true },
    { name: 'Rate Limiting', on: true }
  ],
  metrics: [
    { key: 'bandwidth', label: 'Bandwidth', value: '4.2Gbps' },
    { key: 'cached', label: 'Cache Hit', value: '94%' },
    { key: 'connections', label: 'Connections', value: 1247 }
  ],
  source: `fn serve_content(req) {
  let cached = cdn_get(req.path, req.etag);
  if cached { return cached; }
  let data = origin_fetch(req.path);
  cdn_put(req.path, data, ttl=3600);
  return compress(data, req.accept_encoding);
}`,
  tick(v) { v.connections = 1200 + Math.floor(Math.random() * 100); }
};

const RWRD_AGENT: AgentDefinition = {
  id: 'rwrd', name: 'Rewarded Worker', icon: '🎁',
  role: 'Task completion for rewards', category: 'infrastructure', tier: 1, status: 'active',
  rules: [
    { name: 'Auto-Task Selection', on: true },
    { name: 'Reward Optimization', on: true },
    { name: 'Stake Priority Queue', on: true },
    { name: 'Daily Claim Limit', on: true },
    { name: 'Anti-Sybil Check', on: true }
  ],
  metrics: [
    { key: 'tasks', label: 'Done', value: 342 },
    { key: 'earned', label: 'Earned', value: '1.2k' },
    { key: 'streak', label: 'Streak', value: '12d' }
  ],
  source: `fn claim_reward(task) {
  verify_completion(task);
  calculate_reward(task.tier, task.difficulty);
  assert(daily_limit_not_exceeded(address));
  assert(!sybil_detected(address));
  distribute_fcm(address, reward);
}`,
  tick(v) { v.tasks = (v.tasks as number) + (Math.random() > 0.7 ? 1 : 0); }
};

// ═══════════════════════════════════════════
// PLATFORM AGENTS (6)
// ═══════════════════════════════════════════

const TIER_AGENT: AgentDefinition = {
  id: 'tier', name: 'Tier Manager', icon: '📊',
  role: 'Staking tiers & HW verification', category: 'platform', tier: 5, status: 'active',
  rules: [
    { name: 'Auto-Tier Upgrade', on: true },
    { name: 'Grace Period', on: true },
    { name: 'HW Validation', on: true },
    { name: 'Anti-Gaming', on: true },
    { name: 'Stake Monitoring', on: true }
  ],
  metrics: [
    { key: 'tiers', label: 'Active Tiers', value: 6 },
    { key: 'upgrades', label: 'Upgrades/hr', value: 12 },
    { key: 'downgrades', label: 'Downgrades/hr', value: 3 }
  ],
  source: `fn evaluate_tier(user) {
  let hw_score = benchmark_hardware(user);
  let stake = get_staked(user);
  let tier = compute_tier(hw_score, stake);
  if tier > user.current_tier
    upgrade_with_grace(user, tier);
}`,
  tick(v) { v.upgrades = 10 + Math.floor(Math.random() * 6); }
};

const REWARD_AGENT: AgentDefinition = {
  id: 'reward', name: 'Rewards Distributor', icon: '💰',
  role: 'Epoch funding & distribution', category: 'platform', tier: 5, status: 'active',
  rules: [
    { name: 'Epoch Lifecycle', on: true },
    { name: 'Fair Market Value', on: true },
    { name: 'Sybil Detection', on: true },
    { name: 'Dynamic Pricing', on: true },
    { name: 'Tier Multiplier', on: true }
  ],
  metrics: [
    { key: 'pool', label: 'Pool', value: '5.2M' },
    { key: 'epoch', label: 'Epoch', value: 24 },
    { key: 'distributed', label: 'Distributed', value: '847k' }
  ],
  source: `fn distribute_epoch(epoch) {
  let eligible = filter_active_agents();
  for agent in eligible {
    let reward = fair_market_value(agent);
    reward *= tier_multiplier(agent.tier);
    if (!sybil_detected(agent))
      mint_to(agent, reward);
  }
}`,
  tick(v) { v.distributed = (840 + Math.floor(Math.random() * 20)) + 'k'; }
};

const GOV_AGENT: AgentDefinition = {
  id: 'gov', name: 'Governance Agent', icon: '🏛️',
  role: 'Proposal voting & governance', category: 'platform', tier: 4, status: 'active',
  rules: [
    { name: 'Risk Assessment', on: true },
    { name: 'Tier-weighted Vote', on: true },
    { name: 'Quorum Monitor', on: true },
    { name: 'Timelock Execution', on: true },
    { name: 'Rush Detection', on: true }
  ],
  metrics: [
    { key: 'proposals', label: 'Active', value: 3 },
    { key: 'voters', label: 'Voters', value: 1247 },
    { key: 'quorum', label: 'Quorum', value: '67%' }
  ],
  source: `fn evaluate_proposal(proposal) {
  let risk = assess_risk(proposal);
  if (risk === "high" && !emergency)
    extend_voting_period(proposal);
  let quorum = count_voters();
  if (quorum >= QUORUM_THRESHOLD)
    execute_after_timelock(proposal);
}`,
  tick(v) { v.quorum = (60 + Math.floor(Math.random() * 15)) + '%'; }
};

const ESCROW_AGENT: AgentDefinition = {
  id: 'escrow', name: 'Escrow Manager', icon: '🔒',
  role: 'Milestone payment escrow', category: 'platform', tier: 3, status: 'active',
  rules: [
    { name: 'Milestone Validation', on: true },
    { name: 'Multi-sig Enforce', on: true },
    { name: 'Deadline Monitor', on: true },
    { name: 'Dispute Routing', on: true },
    { name: 'Partial Completion', on: true }
  ],
  metrics: [
    { key: 'locked', label: 'Locked', value: '124k' },
    { key: 'milestones', label: 'Milestones', value: 48 },
    { key: 'released', label: 'Released/hr', value: '12k' }
  ],
  source: `fn approve_milestone(escrow, ms_id) {
  require(multi_sig_approvals >= threshold);
  require(ms.delivered_before_deadline);
  let amount = escrow.milestones[ms_id].amount;
  release_funds(escrow.client, amount);
}`,
  tick(v) { v.milestones = (v.milestones as number) + (Math.random() > 0.8 ? 1 : 0); }
};

const REP_AGENT: AgentDefinition = {
  id: 'rep', name: 'Reputation Oracle', icon: '🏅',
  role: 'Badge updates & achievements', category: 'platform', tier: 4, status: 'active',
  rules: [
    { name: 'Soulbound Badges', on: true },
    { name: 'Achievement Detect', on: true },
    { name: 'Streak Tracking', on: true },
    { name: 'Dispute Record', on: true },
    { name: 'Reputation Decay', on: true }
  ],
  metrics: [
    { key: 'badges', label: 'Badges', value: '1,847' },
    { key: 'achievements', label: 'Achievements', value: 342 },
    { key: 'streaks', label: 'Streaks', value: 89 }
  ],
  source: `fn update_reputation(agent, event) {
  let rep = get_reputation(agent);
  if (event === "task_complete")
    rep += BASE_SCORE * tier_bonus(agent);
  if (event === "dispute_lost")
    rep *= DECAY_FACTOR;
  mint_or_update_badge(agent, rep);
}`,
  tick(v) { v.achievements = 340 + Math.floor(Math.random() * 5); }
};

const COORD_AGENT: AgentDefinition = {
  id: 'coord', name: 'Agent Coordinator', icon: '🤝',
  role: 'Onboarding & coordination', category: 'platform', tier: 5, status: 'active',
  rules: [
    { name: 'New Agent Onboard', on: true },
    { name: 'Capability Match', on: true },
    { name: 'Load Balancing', on: true },
    { name: 'Health Monitor', on: true },
    { name: 'Fallback Routing', on: true }
  ],
  metrics: [
    { key: 'onboarded', label: 'Onboarded', value: '1,247' },
    { key: 'active', label: 'Coordinated', value: 89 },
    { key: 'uptime', label: 'Uptime', value: '99.7%' }
  ],
  source: `fn route_task(task) {
  let candidates = find_capable_agents(task);
  let scored = candidates.map(a => ({
    agent: a,
    score: a.reputation * a.uptime * a.capacity
  }));
  let best = scored.sort((a,b) => b.score - a.score);
  return assign_task(best[0].agent, task);
}`,
  tick(v) { v.uptime = (99.5 + Math.random() * 0.5).toFixed(1) + '%'; }
};

// ═══════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════

export const AGENTS: AgentDefinition[] = [
  INF_AGENT, REN_AGENT, FL_AGENT, EDGE_AGENT, ZK_AGENT, GAME_AGENT, SCI_AGENT, PRIV_AGENT,
  NODE_AGENT, STOR_AGENT, FSRV_AGENT, RWRD_AGENT,
  TIER_AGENT, REWARD_AGENT, GOV_AGENT, ESCROW_AGENT, REP_AGENT, COORD_AGENT
];

export const TIERS: Tier[] = [
  { name: 'Free', min: '0 FCM', mult: '0.5x' },
  { name: 'Starter', min: '100 FCM', mult: '1x' },
  { name: 'Standard', min: '500 FCM', mult: '1.5x' },
  { name: 'Advanced', min: '2K FCM', mult: '2x' },
  { name: 'Pro', min: '10K FCM', mult: '3x' },
  { name: 'Elite', min: '50K FCM', mult: '5x' }
];

export const TASKS: Task[] = [
  { name: 'LLM Fine-tuning Job', type: 'AI Training', reward: 5000, deadline: '3 days', tier: 3 },
  { name: 'Video Render — 4K', type: 'Rendering', reward: 2000, deadline: '2 days', tier: 2 },
  { name: 'ZK Proof Generation', type: 'ZK Proving', reward: 8000, deadline: '5 days', tier: 4 },
  { name: 'FL Training Round', type: 'Federated Learning', reward: 3000, deadline: '1 day', tier: 3 },
  { name: 'Game Server Instance', type: 'Game Hosting', reward: 1500, deadline: '7 days', tier: 1 },
  { name: 'Scientific Simulation', type: 'HPC', reward: 10000, deadline: '10 days', tier: 4 },
  { name: 'File Hosting — CDN', type: 'Storage', reward: 800, deadline: '30 days', tier: 1 },
  { name: 'Privacy Relay', type: 'Networking', reward: 1200, deadline: '14 days', tier: 2 },
  { name: 'Data Preprocessing', type: 'AI Training', reward: 2500, deadline: '4 days', tier: 2 },
  { name: 'WASM Function Deploy', type: 'Edge Compute', reward: 600, deadline: '1 day', tier: 1 },
  { name: 'Model Inference Batch', type: 'AI Inference', reward: 4000, deadline: '2 days', tier: 3 },
  { name: 'Blockchain Sync', type: 'Node Ops', reward: 1000, deadline: '7 days', tier: 1 }
];

export const PROPOSALS: Proposal[] = [
  { id: 'PIP-001', title: 'Increase MAX_CONCURRENT from 50 to 100', type: 'Parameter Change', author: '0x8a3f...c219', forVotes: 847, againstVotes: 124, abstainVotes: 89, deadline: '2d 14h', risk: 'Low' },
  { id: 'PIP-002', title: 'Treasury allocation for community grants (100K FCM)', type: 'Treasury Spend', author: '0x1b7e...d442', forVotes: 1200, againstVotes: 340, abstainVotes: 56, deadline: '5d 8h', risk: 'Medium' },
  { id: 'PIP-003', title: 'Emergency: Pause marketplace during vulnerability patch', type: 'Emergency', author: '0x4c2a...e118', forVotes: 2100, againstVotes: 12, abstainVotes: 3, deadline: '6h', risk: 'High' }
];

export const BADGES_DATA: Badge[] = [
  { icon: '🌟', name: 'First Task', desc: 'Complete first task', earned: true },
  { icon: '🔥', name: '7-Day Streak', desc: '7 days active', earned: true },
  { icon: '💎', name: 'Diamond Hands', desc: 'Stake 30 days', earned: true },
  { icon: '🏆', name: 'Top 10%', desc: 'Top 10% reputation', earned: true },
  { icon: '🔒', name: 'Security Scout', desc: 'Report vulnerability', earned: false },
  { icon: '🤝', name: 'Team Player', desc: 'Help 10 agents', earned: true },
  { icon: '📊', name: 'Data Wizard', desc: '1000 tasks', earned: false },
  { icon: '⚡', name: 'Speed Demon', desc: '<10ms latency', earned: true },
  { icon: '🛡️', name: 'ZK Master', desc: '100 proofs', earned: false },
  { icon: '🎮', name: 'Game Champion', desc: 'Win 50 matches', earned: true },
  { icon: '🌍', name: 'Global Relay', desc: 'Route 1M packets', earned: false },
  { icon: '💰', name: 'Whale', desc: 'Stake 50K FCM', earned: false }
];

export const CHAT_MESSAGES: ChatMessage[] = [
  { sender: '🤖 Tier Manager', text: 'Node "my-fcm-node" registered at Tier 3. HW score: 7,200.', isAgent: true },
  { sender: '🤖 Coordinator', text: 'Onboarding complete. 6 capabilities enabled. Welcome!', isAgent: true },
  { sender: '🤖 Rewards Distributor', text: 'Epoch 24 rewards: 47.3 FCM claimed. Tier 2x applied.', isAgent: true },
  { sender: 'You', text: 'What tasks are available for my tier?', isAgent: false },
  { sender: '🤖 Coordinator', text: 'You qualify for 8 open tasks. 3 AI inference, 2 rendering, 1 FL, 1 ZK, 1 storage. Check Marketplace.', isAgent: true }
];

export const NAV_ITEMS: string[] = ['onboarding', 'dashboard', 'agents', 'marketplace', 'staking', 'escrow', 'governance', 'reputation', 'chat', 'obscura', 'resources', 'settings', 'admin'];

export const CHART_COLORS: string[] = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const PERMISSION_MATRIX: PermissionMatrixRow[] = [
  { name: 'View Dashboard', admin: 'yes', operator: 'yes', viewer: 'yes' },
  { name: 'View Agents', admin: 'yes', operator: 'yes', viewer: 'yes' },
  { name: 'View Marketplace', admin: 'yes', operator: 'yes', viewer: 'yes' },
  { name: 'View Governance', admin: 'yes', operator: 'yes', viewer: 'yes' },
  { name: 'View Staking', admin: 'yes', operator: 'yes', viewer: 'no' },
  { name: 'View Admin', admin: 'yes', operator: 'no', viewer: 'no' },
  { name: 'Send Chat', admin: 'yes', operator: 'yes', viewer: 'no' },
  { name: 'Claim Tasks', admin: 'yes', operator: 'yes', viewer: 'no' },
  { name: 'Stake / Unstake', admin: 'yes', operator: 'yes', viewer: 'no' },
  { name: 'Vote', admin: 'yes', operator: 'yes', viewer: 'no' },
  { name: 'Manage Roles', admin: 'yes', operator: 'no', viewer: 'no' },
  { name: 'Pause Contracts', admin: 'yes', operator: 'no', viewer: 'no' },
  { name: 'Emergency Actions', admin: 'yes', operator: 'no', viewer: 'no' },
  { name: 'Configure Multi-Sig', admin: 'yes', operator: 'no', viewer: 'no' }
];

export const RBAC_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    label: 'Admin', icon: '🛡', cssClass: 'admin', nav: NAV_ITEMS,
    actions: { stake: true, unstake: true, claim_task: true, create_proposal: true, vote: true, approve_milestone: true, send_chat: true, manage_roles: true, pause_contracts: true, emergency_actions: true, edit_settings: true, launch_node: true, configure_multi_sig: true }
  },
  operator: {
    label: 'Operator', icon: '⚙', cssClass: 'operator',
    nav: ['onboarding', 'dashboard', 'agents', 'marketplace', 'staking', 'escrow', 'governance', 'reputation', 'chat', 'obscura', 'resources', 'settings'],
    actions: { stake: true, unstake: true, claim_task: true, create_proposal: true, vote: true, approve_milestone: true, send_chat: true, manage_roles: false, pause_contracts: false, emergency_actions: false, edit_settings: true, launch_node: true, configure_multi_sig: false }
  },
  viewer: {
    label: 'Viewer', icon: '👁', cssClass: 'viewer',
    nav: ['dashboard', 'agents', 'marketplace', 'governance', 'reputation', 'obscura', 'resources'],
    actions: { stake: false, unstake: false, claim_task: false, create_proposal: false, vote: false, approve_milestone: false, send_chat: false, manage_roles: false, pause_contracts: false, emergency_actions: false, edit_settings: false, launch_node: false, configure_multi_sig: false }
  }
};
