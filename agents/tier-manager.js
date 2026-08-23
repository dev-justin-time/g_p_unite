export const tierManager = {
  id: 'tier',
  name: 'Tier Manager',
  icon: '📊',
  role: 'Staking tiers & hardware verification',
  status: 'active',
  rules: [
    { name: 'Auto-Tier Upgrade', enabled: true },
    { name: 'Grace Period Enforcement', enabled: true },
    { name: 'Hardware Score Validation', enabled: true },
    { name: 'Anti-Gaming Detection', enabled: true },
    { name: 'Stake Threshold Monitoring', enabled: true }
  ],
  metrics: [
    { key: 'tiers', label: 'Active Tiers', value: '6' },
    { key: 'upgrades', label: 'Upgrades/hr', value: '12' },
    { key: 'downgrades', label: 'Downgrades/hr', value: '3' }
  ],
  source: `// tier-manager.rs — Deterministic tier computation
use fcm_contracts::{TierStaking, StakeInfo, TierConfig};

pub struct TierManager {
    grace_period_secs: u64,
    hw_check_interval_secs: u64,
    tier_configs: [TierConfig; 6],
}

impl TierManager {
    /// Compute tier from stake + combined HW/uptime score
    pub fn compute_tier(&self, stake: u128, combined_score: u32) -> u8 {
        for tier in (1..=5).rev() {
            let cfg = &self.tier_configs[tier];
            if stake >= cfg.min_stake && combined_score >= cfg.min_score {
                return tier as u8;
            }
        }
        0 // Free tier
    }

    /// Process hardware score update with grace period check
    pub fn process_hw_update(
        &self,
        info: &mut StakeInfo,
        hw_score: u32,
        uptime_score: u32,
        now: u64,
    ) -> TierUpdate {
        assert!(hw_score <= 10000 && uptime_score <= 10000);
        assert!(now - info.last_hw_check >= self.hw_check_interval_secs);

        let old_tier = info.current_tier;
        let new_tier = self.compute_tier(info.stake, hw_score + uptime_score);

        info.hw_score = hw_score;
        info.uptime_score = uptime_score;
        info.last_hw_check = now;

        if new_tier < old_tier {
            // Downgrade: check grace period
            if now - info.tier_changed_at >= self.grace_period_secs {
                info.current_tier = new_tier;
                info.tier_changed_at = now;
                TierUpdate::Downgraded(old_tier, new_tier)
            } else {
                info.target_tier = Some(new_tier);
                TierUpdate::Deferred(old_tier, new_tier)
            }
        } else if new_tier > old_tier {
            info.current_tier = new_tier;
            info.tier_changed_at = now;
            TierUpdate::Upgraded(old_tier, new_tier)
        } else {
            TierUpdate::Unchanged
        }
    }

    /// Anti-gaming: detect suspicious hardware score patterns
    pub fn detect_gaming(&self, history: &[u32]) -> bool {
        if history.len() < 3 { return false; }

        // Detect rapid oscillation (gaming the grace period)
        let mut changes = 0;
        for window in history.windows(2) {
            let diff = (window[1] as i64 - window[0] as i64).abs();
            if diff > 2000 { changes += 1; }
        }
        changes >= 3
    }
}

enum TierUpdate {
    Upgraded(u8, u8),
    Downgraded(u8, u8),
    Deferred(u8, u8),
    Unchanged,
}`,
  simulate() {
    const t = document.getElementById('tier-upgrades');
    if (t) { t.textContent = parseInt(t.textContent) + 1; }
    const d = document.getElementById('tier-downgrades');
    if (d && Math.random() > 0.7) { d.textContent = parseInt(d.textContent) + 1; }
  },
  tick() {
    const el = document.getElementById('tier-upgrades');
    if (el) el.textContent = (12 + Math.floor(Math.random() * 6)).toString();
  }
};
