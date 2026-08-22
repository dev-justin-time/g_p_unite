import { inferenceRouter } from './inference-router.js';
import { renderSplitter } from './render-splitter.js';
import { flCoordinator } from './fl-coordinator.js';
import { edgeRunner } from './edge-runner.js';
import { zkProver } from './zk-prover.js';
import { gameHost } from './game-host.js';
import { scienceGrid } from './science-grid.js';
import { privacyMesh } from './privacy-mesh.js';

export const agents = [
  inferenceRouter,
  renderSplitter,
  flCoordinator,
  edgeRunner,
  zkProver,
  gameHost,
  scienceGrid,
  privacyMesh
];
