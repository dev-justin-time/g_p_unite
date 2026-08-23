export const governanceAgent = {
  id: 'gov',
  name: 'Governance Agent',
  icon: '🏛️',
  role: 'Proposal creation & tier-weighted voting',
  status: 'active',
  rules: [
    { name: 'Proposal Lifecycle', enabled: true },
    { name: 'Tier-Weighted Voting', enabled: true },
    { name: 'Quorum Enforcement', enabled: true },
    { name: 'Timelock Execution', enabled: true },
    { name: 'Risk Assessment', enabled: true }
  ],
  metrics: [
    { key: 'proposals', label: 'Active', value: '3' },
    { key: 'votes', label: 'Votes Cast', value: '847' },
    { key: 'executed', label: 'Executed', value: '12' }
  ],
  source: `// governance-agent.rs — On-chain governance coordinator
use fcm_contracts::{Governance, Proposal, ProposalState};

pub struct GovernanceAgent {
    voting_duration_blocks: u64,
    timelock_duration_secs: u64,
    quorum_threshold_bps: u32,
}

impl GovernanceAgent {
    /// Evaluate proposal risk before voting
    pub fn assess_risk(&self, proposal: &Proposal) -> RiskAssessment {
        let mut risk = 0u8;

        // High-value target contracts are riskier
        if proposal.target_value > 100_000e18 as u128 {
            risk += 2;
        }

        // Proposals that change core parameters
        if proposal.description.contains("admin") ||
           proposal.description.contains("pause") ||
           proposal.description.contains("upgrade") {
            risk += 3;
        }

        // Short voting period = rushed
        if proposal.end_block - proposal.start_block < 1000 {
            risk += 1;
        }

        // Single voter push
        if proposal.for_votes > proposal.against_votes * 5 {
            risk += 2;
        }

        RiskAssessment {
            score: risk.min(10),
            level: if risk >= 7 { Risk::Critical }
                   else if risk >= 4 { Risk::High }
                   else if risk >= 2 { Risk::Medium }
                   else { Risk::Low },
            flags: self.collect_flags(proposal),
        }
    }

    /// Auto-vote based on tier + risk assessment
    pub fn decide_vote(
        &self,
        proposal: &Proposal,
        tier: u8,
        risk: &RiskAssessment,
    ) -> Vote {
        // Higher tiers have stricter standards
        if tier >= 4 && risk.level == Risk::Critical {
            return Vote::Against;
        }

        // Check if proposal aligns with network health
        if risk.score <= 2 {
            Vote::For
        } else if risk.score <= 5 {
            Vote::Abstain // Let others decide
        } else {
            Vote::Against
        }
    }

    /// Monitor quorum and alert if close
    pub fn check_quorum_status(&self, proposal: &Proposal, total_staked: u128) -> QuorumStatus {
        let total_votes = proposal.for_votes + proposal.against_votes + proposal.abstain_votes;
        let quorum_required = total_staked * self.quorum_threshold_bps as u128 / 10000;
        let remaining = quorum_required.saturating_sub(total_votes);
        let blocks_left = proposal.end_block.saturating_sub(current_block());

        QuorumStatus {
            reached: total_votes >= quorum_required,
            votes_for_quorum: total_votes,
            quorum_required,
            remaining_votes: remaining,
            blocks_remaining: blocks_left,
            estimated_reach: self.estimate_quorum_reach(proposal, total_staked),
        }
    }
}

enum Vote { For, Against, Abstain }
enum Risk { Low, Medium, High, Critical }`,
  simulate() {
    const p = document.getElementById('gov-proposals');
    if (p && Math.random() > 0.8) { p.textContent = parseInt(p.textContent) + 1; }
    const v = document.getElementById('gov-votes');
    if (v) { v.textContent = parseInt(v.textContent) + Math.floor(Math.random() * 5); }
  },
  tick() {
    const v = document.getElementById('gov-votes');
    if (v) v.textContent = (847 + Math.floor(Math.random() * 20)).toString();
  }
};
