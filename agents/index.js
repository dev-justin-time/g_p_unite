import { inferenceRouter } from './inference-router.js';
import { renderSplitter } from './render-splitter.js';
import { flCoordinator } from './fl-coordinator.js';
import { edgeRunner } from './edge-runner.js';
import { zkProver } from './zk-prover.js';
import { gameHost } from './game-host.js';
import { scienceGrid } from './science-grid.js';
import { privacyMesh } from './privacy-mesh.js';
import { nodeRunner } from './node-runner.js';
import { storageProvider } from './storage-provider.js';
import { fileServer } from './file-server.js';
import { rewardedWorker } from './rewarded-worker.js';
import { tierManager } from './tier-manager.js';
import { rewardsDistributor } from './rewards-distributor.js';
import { governanceAgent } from './governance-agent.js';
import { escrowManager } from './escrow-manager.js';
import { reputationOracle } from './reputation-oracle.js';
import { agentCoordinator } from './agent-coordinator.js';

export const agents = [
  // Core compute agents (types 0-7)
  inferenceRouter,
  renderSplitter,
  flCoordinator,
  edgeRunner,
  zkProver,
  gameHost,
  scienceGrid,
  privacyMesh,
  // Extended agents (types 8-11)
  nodeRunner,
  storageProvider,
  fileServer,
  rewardedWorker,
  // Feature agents (platform services)
  tierManager,
  rewardsDistributor,
  governanceAgent,
  escrowManager,
  reputationOracle,
  agentCoordinator
];

// Agent categories for UI grouping
export const agentCategories = {
  compute: [inferenceRouter, renderSplitter, flCoordinator, edgeRunner, zkProver, gameHost, scienceGrid, privacyMesh],
  infrastructure: [nodeRunner, storageProvider, fileServer, rewardedWorker],
  platform: [tierManager, rewardsDistributor, governanceAgent, escrowManager, reputationOracle, agentCoordinator]
};

// Export individual agents for direct access
export {
  tierManager,
  rewardsDistributor,
  governanceAgent,
  escrowManager,
  reputationOracle,
  agentCoordinator
};
