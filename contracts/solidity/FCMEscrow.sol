// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title FCMEscrow
 * @notice Milestone-based payment escrow for complex jobs.
 *         Client deposits tokens, worker completes milestones, client approves each milestone.
 *         Dispute resolution by designated arbitrators. Multi-sig release for high-value jobs.
 */
contract FCMEscrow is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    IERC20 public fcmToken;

    enum EscrowState { Created, Funded, InProgress, Completed, Disputed, Resolved, Cancelled, Refunded }

    struct Milestone {
        string  description;
        uint256 amount;
        bytes32 deliverableCID;  // CID of the deliverable
        bool    approved;
        bool    submitted;
        uint256 submittedAt;
        uint256 approvedAt;
    }

    struct Escrow {
        uint256 id;
        address client;
        address worker;
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 remainingAmount;
        uint256 createdAt;
        uint256 deadline;
        uint256 disputeDeadline; // After this, client cannot dispute
        EscrowState state;
        Milestone[] milestones;
        uint256 completedMilestones;
        bool    requiresMultiSig; // High-value jobs need 2 approvals
        uint256 approvalCount;    // Current approvals for multi-sig
        mapping(address => bool) hasApproved; // Prevent double-approval
        mapping(address => bool) arbitrators; // Designated arbitrators
    }

    uint256 public escrowCount;
    uint256 public multisigThreshold = 10000e18; // Jobs > 10K FCM require multi-sig
    uint256 public maxMilestones = 20;
    uint256 public disputeWindow = 14 days;

    mapping(uint256 => Escrow) public escrows;
    mapping(address => uint256[]) public clientEscrows;
    mapping(address => uint256[]) public workerEscrows;

    event EscrowCreated(uint256 indexed id, address client, address worker, uint256 totalAmount, uint256 milestoneCount);
    event EscrowFunded(uint256 indexed id, uint256 amount);
    event MilestoneSubmitted(uint256 indexed id, uint256 milestoneIndex, bytes32 deliverableCID);
    event MilestoneApproved(uint256 indexed id, uint256 milestoneIndex, uint256 amount);
    event MilestoneDisputed(uint256 indexed id, uint256 milestoneIndex, string reason);
    event FundsReleased(uint256 indexed id, uint256 amount, address to);
    event EscrowCancelled(uint256 indexed id, uint256 refund);
    event DisputeResolved(uint256 indexed id, bool clientWins, uint256 amount, string resolution);

    constructor(address _fcmToken) {
        fcmToken = IERC20(_fcmToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ── Escrow Creation ─────────────────────────────────────────

    function createEscrow(
        address worker,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestoneAmounts
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(worker != address(0) && worker != msg.sender, "Invalid worker");
        require(milestoneDescriptions.length == milestoneAmounts.length, "Length mismatch");
        require(milestoneDescriptions.length > 0 && milestoneDescriptions.length <= maxMilestones, "Invalid milestone count");

        uint256 totalAmount;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            require(milestoneAmounts[i] > 0, "Milestone amount must be > 0");
            totalAmount += milestoneAmounts[i];
        }

        escrowCount++;
        Escrow storage e = escrows[escrowCount];
        e.id = escrowCount;
        e.client = msg.sender;
        e.worker = worker;
        e.totalAmount = totalAmount;
        e.remainingAmount = totalAmount;
        e.createdAt = block.timestamp;
        e.deadline = block.timestamp + 90 days;
        e.disputeDeadline = block.timestamp + 120 days;
        e.requiresMultiSig = totalAmount >= multisigThreshold;

        for (uint256 i = 0; i < milestoneDescriptions.length; i++) {
            e.milestones.push(Milestone({
                description: milestoneDescriptions[i],
                amount: milestoneAmounts[i],
                deliverableCID: bytes32(0),
                approved: false,
                submitted: false,
                submittedAt: 0,
                approvedAt: 0
            }));
        }

        clientEscrows[msg.sender].push(escrowCount);
        workerEscrows[worker].push(escrowCount);

        emit EscrowCreated(escrowCount, msg.sender, worker, totalAmount, milestoneDescriptions.length);
        return escrowCount;
    }

    // ── Funding ─────────────────────────────────────────────────

    function fundEscrow(uint256 escrowId) external nonReentrant whenNotPaused {
        Escrow storage e = escrows[escrowId];
        require(e.client == msg.sender, "Not client");
        require(e.state == EscrowState.Created, "Invalid state");

        require(fcmToken.transferFrom(msg.sender, address(this), e.totalAmount), "Transfer failed");
        e.state = EscrowState.Funded;
        e.approvalCount = 0;
        e.hasApproved[msg.sender] = false;

        emit EscrowFunded(escrowId, e.totalAmount);
    }

    // ── Milestone Workflow ──────────────────────────────────────

    function submitMilestone(uint256 escrowId, uint256 milestoneIndex, bytes32 deliverableCID)
        external nonReentrant
    {
        Escrow storage e = escrows[escrowId];
        require(e.worker == msg.sender, "Not worker");
        require(e.state == EscrowState.Funded || e.state == EscrowState.InProgress, "Invalid state");
        require(milestoneIndex < e.milestones.length, "Invalid milestone");
        require(!e.milestones[milestoneIndex].submitted, "Already submitted");

        e.milestones[milestoneIndex].submitted = true;
        e.milestones[milestoneIndex].deliverableCID = deliverableCID;
        e.milestones[milestoneIndex].submittedAt = block.timestamp;
        e.state = EscrowState.InProgress;

        emit MilestoneSubmitted(escrowId, milestoneIndex, deliverableCID);
    }

    function approveMilestone(uint256 escrowId, uint256 milestoneIndex)
        external nonReentrant
    {
        Escrow storage e = escrows[escrowId];
        require(e.client == msg.sender, "Not client");
        require(e.state == EscrowState.InProgress, "Invalid state");
        require(milestoneIndex < e.milestones.length, "Invalid milestone");
        require(e.milestones[milestoneIndex].submitted, "Not submitted");
        require(!e.milestones[milestoneIndex].approved, "Already approved");
        require(!e.hasApproved[msg.sender], "Already approved");

        // Multi-sig check
        if (e.requiresMultiSig) {
            e.hasApproved[msg.sender] = true;
            e.approvalCount++;
            if (e.approvalCount < 2) return; // Need 2nd approval
        }

        uint256 milestoneAmount = e.milestones[milestoneIndex].amount;
        e.milestones[milestoneIndex].approved = true;
        e.milestones[milestoneIndex].approvedAt = block.timestamp;
        e.completedMilestones++;
        e.releasedAmount += milestoneAmount;
        e.remainingAmount -= milestoneAmount;
        // Reset multi-sig state for the next milestone
        if (e.requiresMultiSig) {
            e.hasApproved[msg.sender] = false;
            e.approvalCount = 0;
        }

        // Release funds to worker
        require(
            fcmToken.transfer(e.worker, milestoneAmount),
            "Transfer failed"
        );

        emit MilestoneApproved(escrowId, milestoneIndex, e.milestones[milestoneIndex].amount);
        emit FundsReleased(escrowId, e.milestones[milestoneIndex].amount, e.worker);

        // Check if all milestones complete
        if (e.completedMilestones == e.milestones.length) {
            e.state = EscrowState.Completed;
        }
    }

    // ── Disputes ────────────────────────────────────────────────

    function disputeMilestone(uint256 escrowId, uint256 milestoneIndex, string calldata reason)
        external nonReentrant
    {
        require(bytes(reason).length > 0, "Reason required");
        Escrow storage e = escrows[escrowId];
        require(
            msg.sender == e.client || msg.sender == e.worker,
            "Not a party"
        );
        require(e.state == EscrowState.InProgress, "Invalid state");
        require(block.timestamp <= e.disputeDeadline, "Dispute deadline passed");
        require(milestoneIndex < e.milestones.length, "Invalid milestone");
        require(e.milestones[milestoneIndex].submitted, "Not submitted");

        e.state = EscrowState.Disputed;
        emit MilestoneDisputed(escrowId, milestoneIndex, reason);
    }

    function resolveDispute(
        uint256 escrowId,
        bool clientWins,
        string calldata resolution
    ) external nonReentrant onlyRole(ARBITRATOR_ROLE) {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.Disputed, "Not disputed");

        // Find the disputed milestone (last submitted, not approved)
        for (uint256 i = 0; i < e.milestones.length; i++) {
            if (e.milestones[i].submitted && !e.milestones[i].approved) {
                uint256 milestoneAmount = e.milestones[i].amount;
                if (clientWins) {
                    e.remainingAmount += milestoneAmount;
                    e.state = EscrowState.Refunded;
                    emit DisputeResolved(escrowId, clientWins, milestoneAmount, resolution);
                    require(fcmToken.transfer(e.client, milestoneAmount), "Refund failed");
                } else {
                    e.releasedAmount += milestoneAmount;
                    e.remainingAmount -= milestoneAmount;
                    e.completedMilestones++;
                    e.milestones[i].approved = true;
                    e.milestones[i].approvedAt = block.timestamp;
                    emit DisputeResolved(escrowId, clientWins, milestoneAmount, resolution);
                    require(fcmToken.transfer(e.worker, milestoneAmount), "Transfer failed");
                }
                break;
            }
        }

        if (e.state == EscrowState.Disputed) {
            e.state = EscrowState.Resolved;
        }
    }

    // ── Cancellation ────────────────────────────────────────────

    function cancelEscrow(uint256 escrowId) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(msg.sender == e.client, "Not client");
        require(
            e.state == EscrowState.Created || e.state == EscrowState.Funded,
            "Cannot cancel"
        );

        if (e.state == EscrowState.Funded) {
            require(fcmToken.transfer(e.client, e.totalAmount), "Refund failed");
        }

        e.state = EscrowState.Cancelled;
        emit EscrowCancelled(escrowId, e.totalAmount);
    }

    // ── View Functions ──────────────────────────────────────────

    function getEscrowMilestones(uint256 escrowId) external view returns (
        string[] memory descriptions,
        uint256[] memory amounts,
        bool[] memory approved,
        bool[] memory submitted
    ) {
        Escrow storage e = escrows[escrowId];
        uint256 len = e.milestones.length;
        descriptions = new string[](len);
        amounts = new uint256[](len);
        approved = new bool[](len);
        submitted = new bool[](len);

        for (uint256 i = 0; i < len; i++) {
            descriptions[i] = e.milestones[i].description;
            amounts[i] = e.milestones[i].amount;
            approved[i] = e.milestones[i].approved;
            submitted[i] = e.milestones[i].submitted;
        }
    }

    function getEscrowSummary(uint256 escrowId) external view returns (
        address client,
        address worker,
        uint256 totalAmount,
        uint256 releasedAmount,
        uint256 completedMilestones,
        uint256 totalMilestones,
        EscrowState state
    ) {
        Escrow storage e = escrows[escrowId];
        return (
            e.client,
            e.worker,
            e.totalAmount,
            e.releasedAmount,
            e.completedMilestones,
            e.milestones.length,
            e.state
        );
    }

    function setMultisigThreshold(uint256 _threshold) external onlyRole(ADMIN_ROLE) {
        multisigThreshold = _threshold;
    }
}
