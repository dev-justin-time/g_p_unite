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

export const agents = [
  inferenceRouter,
  renderSplitter,
  flCoordinator,
  edgeRunner,
  zkProver,
  gameHost,
  scienceGrid,
  privacyMesh,
  nodeRunner,
  storageProvider,
  fileServer,
  rewardedWorker
];
