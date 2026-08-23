export const reputationOracle = {
  id: 'rep',
  name: 'Reputation Oracle',
  icon: '🏅',
  role: 'Badge updates & achievement tracking',
  status: 'active',
  rules: [
    { name: 'Soulbound Badge Updates', enabled: true },
    { name: 'Achievement Detection', enabled: true },
    { name: 'Streak Tracking', enabled: true },
    { name: 'Dispute Recording', enabled: true },
    { name: 'Reputation Decay', enabled: true }
  ],
  metrics: [
    { key: 'badges', label: 'Total Badges', value: '1,847' },
    { key: 'achievements', label: 'Achievements', value: '342' },
    { key: 'streaks', label: 'Active Streaks', value: '89' }
  ],
  source: `// reputation-oracle.rs — Soulbound reputation badge management
use fcm_contracts::{ReputationNFT, Badge, Achievement};

pub struct ReputationOracle {
    achievement_thresholds: AchievementThresholds,
    streak_reward_bps: u32,
}

impl ReputationOracle {
    /// Update badge after task completion
    pub fn update_badge(
        &self,
        badge: &mut Badge,
        add_work: u64,
        add_earnings: u128,
        uptime: u32,
        dispute_won: bool,
        dispute_lost: bool,
    ) -> BadgeUpdate {
        badge.total_work += add_work;
        badge.total_earnings += add_earnings;
        badge.uptime_score = uptime;
        if dispute_won { badge.disputes_won += 1; }
        if dispute_lost { badge.disputes_lost += 1; }
        badge.last_updated = current_timestamp();

        // Check achievements
        let new_achievements = self.check_achievements(badge);
        if !new_achievements.is_empty() {
            for ach in &new_achievements {
                badge.achievements |= ach.bitflag();
            }
            BadgeUpdate::AchievementsUnlocked(new_achievements)
        } else {
            BadgeUpdate::Updated
        }
    }

    /// Check which achievements to unlock
    pub fn check_achievements(&self, badge: &Badge) -> Vec<Achievement> {
        let mut unlocked = vec![];

        if badge.total_work >= 1 { unlocked.push(Achievement::FirstTask); }
        if badge.total_work >= 100 { unlocked.push(Achievement::HundredTasks); }
        if badge.total_work >= 1000 { unlocked.push(Achievement::ThousandTasks); }
        if badge.uptime_score >= 9900 { unlocked.push(Achievement::PerfectUptime); }
        if badge.tier >= 5 { unlocked.push(Achievement::EliteTier); }
        if badge.disputes_won >= 10 && badge.disputes_lost == 0 {
            unlocked.push(Achievement::DisputeChampion);
        }
        if badge.total_earnings >= 1_000_000e18 as u128 {
            unlocked.push(Achievement::MillionEarned);
        }

        // Filter out already-unlocked
        unlocked.into_iter()
            .filter(|a| badge.achievements & a.bitflag() == 0)
            .collect()
    }

    /// Track consecutive active days for streak
    pub fn update_streak(&self, badge: &mut Badge) {
        let now = current_day();
        let last_active = badge.last_active_day;

        if now == last_active + 1 {
            badge.consecutive_days += 1;
        } else if now > last_active + 1 {
            badge.consecutive_days = 1; // Streak broken
        }
        badge.last_active_day = now;
    }

    /// Reputation decay for inactive agents
    pub fn apply_decay(&self, badge: &mut Badge) {
        let inactive_days = current_day() - badge.last_active_day;
        if inactive_days > 30 {
            let decay = (inactive_days - 30) * 10; // 10 rep per day after 30 days
            badge.reputation = badge.reputation.saturating_sub(decay);
        }
    }
}`,
  simulate() {
    const b = document.getElementById('rep-badges');
    if (b && Math.random() > 0.7) { b.textContent = (1847 + Math.floor(Math.random() * 3)).toLocaleString(); }
    const a = document.getElementById('rep-achievements');
    if (a && Math.random() > 0.85) { a.textContent = (342 + Math.floor(Math.random() * 2)).toString(); }
  },
  tick() {
    const b = document.getElementById('rep-badges');
    if (b) b.textContent = (1847 + Math.floor(Math.random() * 5)).toLocaleString();
  }
};
