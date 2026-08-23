export const rewardsDistributor = {
  id: 'reward',
  name: 'Rewards Distributor',
  icon: '💰',
  role: 'Epoch funding & reward distribution',
  status: 'active',
  rules: [
    { name: 'Epoch Lifecycle', enabled: true },
    { name: 'Fair Market Value Pricing', enabled: true },
    { name: 'Tier Multiplier Application', enabled: true },
    { name: 'Sybil Prevention', enabled: true },
    { name: 'Pool Balance Monitoring', enabled: true }
  ],
  metrics: [
    { key: 'epoch', label: 'Epoch', value: '47' },
    { key: 'pool', label: 'Pool FCM', value: '1.2M' },
    { key: 'distributed', label: 'Distributed', value: '847K' }
  ],
  source: `// rewards-distributor.rs — Epoch-based reward pool management
use fcm_contracts::{RewardsPool, EpochReward, AgentReward, TierStaking};

pub struct RewardsDistributor {
    epoch_duration_secs: u64,
    min_claim_amount: u128,
    sybil_window: u64,
}

impl RewardsDistributor {
    /// Finalize epoch and compute per-agent rewards
    pub fn finalize_epoch(&self, pool: &mut RewardsPool) {
        let epoch = &mut pool.epochs[pool.current_epoch as usize];
        epoch.finalized = true;
        pool.current_epoch += 1;
        pool.epochs[pool.current_epoch as usize] = EpochReward::default();
    }

    /// Compute agent's reward for a finalized epoch
    pub fn compute_reward(
        &self,
        agent: &AgentReward,
        epoch: &EpochReward,
        tier_multiplier: u32,
    ) -> u128 {
        if epoch.tasks_completed == 0 || agent.epoch_work == 0 {
            return 0;
        }

        // (agentWork / totalWork) * pool * multiplier / 10000
        let raw = (agent.epoch_work as u128)
            .checked_mul(epoch.total_pool)
            .unwrap()
            .checked_mul(tier_multiplier as u128)
            .unwrap()
            / (epoch.tasks_completed as u128 * 10000);

        raw.max(self.min_claim_amount)
    }

    /// Sybil detection: flag accounts claiming from multiple agents
    pub fn detect_sybil(
        &self,
        claims: &[(address, u64, u128)], // (agent, epoch, amount)
        window: u64,
    ) -> Vec<address> {
        let mut flagged = vec![];
        let now = current_timestamp();

        // Group by IP/hardware fingerprint
        for group in cluster_by_fingerprint(claims) {
            if group.len() > 3 {
                let total: u128 = group.iter().map(|c| c.2).sum();
                let avg = total / group.len() as u128;
                let variance: u128 = group.iter()
                    .map(|c| (c.2 as i128 - avg as i128).pow(2) as u128)
                    .sum::<u128>() / group.len() as u128;

                // Low variance + high total = likely Sybil
                if variance < avg / 10 && total > avg * 5 {
                    flagged.extend(group.iter().map(|c| c.0));
                }
            }
        }
        flagged
    }

    /// Fair market value: adjust prices based on supply/demand
    pub fn compute_dynamic_price(
        &self,
        base_price: u128,
        active_agents: u32,
        pending_tasks: u32,
    ) -> u128 {
        let supply_ratio = active_agents as f64 / pending_tasks.max(1) as f64;
        let multiplier = if supply_ratio > 2.0 {
            8000 // 0.8x (oversupply)
        } else if supply_ratio < 0.5 {
            15000 // 1.5x (high demand)
        } else {
            10000 // 1x (balanced)
        };
        base_price * multiplier / 10000
    }
}`,
  simulate() {
    const e = document.getElementById('reward-epoch');
    if (e) { e.textContent = parseInt(e.textContent) + 1; }
    const p = document.getElementById('reward-pool');
    if (p) { p.textContent = (1.2 + Math.random() * 0.1).toFixed(1) + 'M'; }
  },
  tick() {
    const p = document.getElementById('reward-pool');
    if (p) p.textContent = (1.2 + Math.random() * 0.1).toFixed(1) + 'M';
  }
};
