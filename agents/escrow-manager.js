export const escrowManager = {
  id: 'escrow',
  name: 'Escrow Manager',
  icon: '🔒',
  role: 'Milestone escrow lifecycle & dispute resolution',
  status: 'active',
  rules: [
    { name: 'Milestone Validation', enabled: true },
    { name: 'Multi-Sig Enforcement', enabled: true },
    { name: 'Deadline Monitoring', enabled: true },
    { name: 'Auto-Release on Approval', enabled: true },
    { name: 'Dispute Routing', enabled: true }
  ],
  metrics: [
    { key: 'active', label: 'Active Escrows', value: '24' },
    { key: 'volume', label: 'Total FCM', value: '89K' },
    { key: 'disputes', label: 'Disputes', value: '2' }
  ],
  source: `// escrow-manager.rs — Milestone-based escrow automation
use fcm_contracts::{Escrow, EscrowState, Milestone};

pub struct EscrowManager {
    multisig_threshold: u128,
    max_milestones: usize,
    dispute_window_secs: u64,
}

impl EscrowManager {
    /// Validate milestone submission
    pub fn validate_submission(
        &self,
        escrow: &Escrow,
        milestone_idx: usize,
        deliverable_cid: &[u8; 32],
        now: u64,
    ) -> Result<(), EscrowError> {
        if escrow.state != EscrowState::InProgress {
            return Err(EscrowError::InvalidState);
        }
        if milestone_idx >= escrow.milestones.len() {
            return Err(EscrowError::InvalidMilestone);
        }
        if escrow.worker != msg_sender() {
            return Err(EscrowError::NotWorker);
        }

        let milestone = &escrow.milestones[milestone_idx];
        if milestone.submitted {
            return Err(EscrowError::AlreadySubmitted);
        }
        if deliverable_cid == &[0u8; 32] {
            return Err(EscrowError::EmptyDeliverable);
        }

        Ok(())
    }

    /// Process milestone approval with optional multi-sig
    pub fn process_approval(
        &self,
        escrow: &mut Escrow,
        milestone_idx: usize,
        approver: address,
        now: u64,
    ) -> ApprovalResult {
        let milestone = &mut escrow.milestones[milestone_idx];

        if escrow.requires_multisig && !escrow.has_approved[approver] {
            escrow.has_approved[approver] = true;
            escrow.approval_count += 1;

            if escrow.approval_count < 2 {
                return ApprovalResult::PartialMultiSig(escrow.approval_count);
            }
        }

        milestone.approved = true;
        milestone.approved_at = now;
        escrow.completed_milestones += 1;
        escrow.released_amount += milestone.amount;
        escrow.remaining_amount -= milestone.amount;

        // Check completion
        if escrow.completed_milestones == escrow.milestones.len() {
            escrow.state = EscrowState::Completed;
        }

        ApprovalResult::Released(milestone.amount, escrow.worker)
    }

    /// Monitor deadlines and flag at-risk escrows
    pub fn check_deadlines(&self, escrows: &[Escrow], now: u64) -> Vec<DeadlineAlert> {
        escrows.iter()
            .filter(|e| e.state == EscrowState::InProgress)
            .filter(|e| e.deadline < now + 86400) // Due within 24h
            .map(|e| DeadlineAlert {
                escrow_id: e.id,
                deadline: e.deadline,
                hours_remaining: (e.deadline - now) / 3600,
                severity: if e.deadline < now { Alert::Overdue }
                          else if e.deadline < now + 43200 { Alert::Critical }
                          else { Alert::Warning },
            })
            .collect()
    }
}`,
  simulate() {
    const a = document.getElementById('escrow-active');
    if (a) { a.textContent = (24 + Math.floor(Math.random() * 5)).toString(); }
    const d = document.getElementById('escrow-disputes');
    if (d && Math.random() > 0.9) { d.textContent = parseInt(d.textContent) + 1; }
  },
  tick() {
    const a = document.getElementById('escrow-active');
    if (a) a.textContent = (24 + Math.floor(Math.random() * 5)).toString();
  }
};
