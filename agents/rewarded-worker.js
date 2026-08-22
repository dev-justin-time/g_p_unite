export const rewardedWorker = {
  id: 'rewarded',
  name: 'Rewarded Worker',
  icon: '💰',
  role: 'Bounty hunting and reward-earning tasks',
  status: 'active',
  rules: [
    { name: 'Auto-Bounty Claim', enabled: true },
    { name: 'Reward Filtering', enabled: true },
    { name: 'Reputation Tracking', enabled: true },
    { name: 'Multi-Task Execution', enabled: true },
    { name: 'Payout Verification', enabled: true }
  ],
  metrics: [
    { key: 'bounties', label: 'Bounties', value: '0' },
    { key: 'earned', label: 'Earned', value: '0 FCM' },
    { key: 'rate', label: 'Success', value: '100%' }
  ],
  source: `// rewarded-worker.rs — Bounty hunting and reward tasks
use fcm_runtime::{Bounty, TaskResult, RewardPool};

pub struct RewardedWorker {
    min_reward: f64,
    max_concurrent: usize,
    active_bounties: Vec<Bounty>,
}

impl RewardedWorker {
    pub fn scan_bounties(&self, pool: &RewardPool) -> Vec<Bounty> {
        pool.available_bounties()
            .iter()
            .filter(|b| b.reward_amount >= self.min_reward)
            .filter(|b| self.can_complete(b))
            .filter(|b| !self.active_bounties.contains(b))
            .cloned()
            .collect()
    }

    pub fn claim_bounty(&mut self, bounty: Bounty) -> Result<(), BountyError> {
        if self.active_bounties.len() >= self.max_concurrent {
            return Err(BountyError::CapacityFull);
        }

        // Verify bounty is still available
        if !bounty.is_available() {
            return Err(BountyError::AlreadyClaimed);
        }

        // Stake verification
        if bounty.required_stake > self.current_stake {
            return Err(BountyError::InsufficientStake);
        }

        self.active_bounties.push(bounty);
        Ok(())
    }

    pub fn complete_bounty(&mut self, bounty_id: &str, result: TaskResult) -> Result<f64, BountyError> {
        let idx = self.active_bounties.iter()
            .position(|b| b.id == bounty_id)
            .ok_or(BountyError::NotFound)?;

        let bounty = self.active_bounties.remove(idx);

        // Verify result meets bounty requirements
        if !bounty.verify_result(&result) {
            return Err(BountyError::VerificationFailed);
        }

        let reward = bounty.reward_amount;
        Ok(reward)
    }

    pub fn calculate_earnings(&self) -> f64 {
        self.completed_bounties.iter()
            .map(|b| b.reward_amount)
            .sum()
    }
}`,
  simulate() {
    const b = document.getElementById('rewarded-bounties');
    if (b) b.textContent = parseInt(b.textContent) + 1;
    const e = document.getElementById('rewarded-earned');
    if (e) {
      const val = parseFloat(e.textContent) || 0;
      e.textContent = (val + Math.random() * 2).toFixed(1) + ' FCM';
    }
  },
  tick() {}
};
