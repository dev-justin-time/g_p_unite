# FCM Expert Agent Swarm

**Federated Compute Mesh — Built-in Logic Agents**

A self-contained dashboard + 8 expert agents that operate with **zero LLM calls** on hot paths. All routing, scheduling, privacy, and game logic is handled by deterministic algorithms, cryptographic protocols, and mathematical decomposition.

## Quick Start

```bash
# Serve locally
python3 -m http.server 8080
# Open http://localhost:8080
```

Or simply open `index.html` in any modern browser.

## Architecture

```
index.html          — Main dashboard UI
app.js              — App orchestrator + live metrics
agents/
  index.js          — Agent registry
  inference-router.js   — AI model scheduling (batching, KV-cache, VRAM guard)
  render-splitter.js    — Frame decomposition (tile splitting, DAG solver)
  fl-coordinator.js     — Federated learning (DP + MPC + BFT)
  edge-runner.js        — WASM serverless (trie routing, pool checkout)
  zk-prover.js          — Zero-knowledge proofs (GPU Groth16, BLS aggregation)
  game-host.js          — Game server (lockstep, hitreg, anti-cheat)
  science-grid.js       — Scientific computing (domain decomposition, validation)
  privacy-mesh.js       — Mixnet routing (Sphinx, reputation-weighted paths)
```

## Agent Logic Summary

| Agent | Core Algorithm | LLM Replacement |
|-------|---------------|-----------------|
| Inference Router | Hard-coded decision tree (VRAM → latency → batch → least-loaded) | Model selection LLM |
| Render Splitter | Cartesian tile grid + Kahn topological sort | Scene analysis LLM |
| FL Coordinator | Gaussian mechanism + Shamir MPC + trimmed mean | Trust arbiter LLM |
| Edge Runner | Trie path match + LRU module cache + instance pool | API gateway LLM |
| ZK Prover | Circuit hash → cached PK → GPU MSM/FFT | Proof strategy LLM |
| Game Host | Fixed-timestep lockstep + speed limit heuristics | Game state prediction LLM |
| Science Grid | PDE-order stencil splitting + statistical consensus | Workload characterization LLM |
| Privacy Mesh | Weighted random sample + Sphinx layer encryption | Routing optimization LLM |

## Performance Targets

- **Logic cache hit rate:** 99.7%
- **Average latency:** 12ms (vs 200-800ms for LLM-based orchestration)
- **LLM calls saved:** 2.4M/hr at scale

## License

MIT — FCM Architecture Working Group
