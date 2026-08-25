// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITierStaking {
    function getTier(address operator) external view returns (uint8);
    function getStakedAmount(address operator) external view returns (uint256);
}

/**
 * @title FCMGovernance
 * @notice On-chain governance for FCM protocol parameter changes.
 *         Tier-weighted voting: higher tiers have proportionally more voting power.
 *         Quorum = 20% of staked tokens. Majority = 50%+1.
 *         Timelock = 24h between vote end and execution.
 */
contract FCMGovernance is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public fcmToken;
    ITierStaking public tierStaking;

    // ── Governance Parameters ───────────────────────────────────
    uint256 public votingDuration = 3 days;
    uint256 public timelockDuration = 1 days;
    uint256 public quorumThreshold = 2000; // 20% in basis points
    uint256 public proposalCount;

    enum ProposalState { Pending, Active, Succeeded, Defeated, Queued, Executed, Cancelled }

    struct Proposal {
        uint256 id;
        address proposer;
        string  description;
        bytes   callData;        // Encoded function call to execute
        address target;          // Target contract
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 eta;             // Estimated time of arrival (execution after timelock)
        uint256 totalStakedAtProposal;
        ProposalState state;
        mapping(address => bool) hasVoted;
        mapping(address => uint8) votes; // 0=against, 1=for, 2=abstain
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public votingPower; // Snapshot of voting power at proposal creation

    event ProposalCreated(uint256 indexed id, address proposer, string description, address target, uint256 endBlock);
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight);
    event ProposalQueued(uint256 indexed id, uint256 eta);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCancelled(uint256 indexed id);

    constructor(address _fcmToken, address _tierStaking) {
        fcmToken = IERC20(_fcmToken);
        tierStaking = ITierStaking(_tierStaking);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ── Proposal Creation ───────────────────────────────────────

    function propose(
        string calldata description,
        address target,
        bytes calldata callData
    ) external whenNotPaused returns (uint256) {
        require(target != address(0), "Invalid target");
        require(bytes(description).length > 0, "Description required");

        proposalCount++;
        Proposal storage p = proposals[proposalCount];
        p.id = proposalCount;
        p.proposer = msg.sender;
        p.description = description;
        p.target = target;
        p.callData = callData;
        p.startBlock = block.number + 1;
        p.endBlock = p.startBlock + (votingDuration / 12); // ~12s blocks
        p.totalStakedAtProposal = fcmToken.totalSupply();
        p.state = ProposalState.Active;

        emit ProposalCreated(proposalCount, msg.sender, description, target, p.endBlock);
        return proposalCount;
    }

    // ── Voting ──────────────────────────────────────────────────

    function castVote(uint256 proposalId, uint8 support) external nonReentrant whenNotPaused {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Unknown proposal");
        require(p.state == ProposalState.Active, "Not active");
        require(block.number >= p.startBlock, "Voting not started");
        require(block.number <= p.endBlock, "Voting ended");
        require(!p.hasVoted[msg.sender], "Already voted");
        require(support <= 2, "Invalid vote (0=against, 1=for, 2=abstain)");

        // Tier-weighted voting power
        uint256 weight = _getVotingPower(msg.sender);
        require(weight > 0, "No voting power");

        p.hasVoted[msg.sender] = true;
        p.votes[msg.sender] = support;

        if (support == 0) p.againstVotes += weight;
        else if (support == 1) p.forVotes += weight;
        else p.abstainVotes += weight;

        emit VoteCast(msg.sender, proposalId, support, weight);
    }

    // ── Execution ───────────────────────────────────────────────

    function queueProposal(uint256 proposalId) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Unknown proposal");
        require(p.state == ProposalState.Active, "Not active");
        require(block.number > p.endBlock, "Voting not ended");
        require(_quorumReached(proposalId), "Quorum not reached");
        require(_majorityReached(proposalId), "Majority not reached");

        p.state = ProposalState.Queued;
        p.eta = block.timestamp + timelockDuration;
        emit ProposalQueued(proposalId, p.eta);
    }

    function executeProposal(uint256 proposalId) external nonReentrant whenNotPaused {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Unknown proposal");
        require(p.state == ProposalState.Queued, "Not queued");
        require(block.timestamp >= p.eta, "Timelock active");

        p.state = ProposalState.Executed;

        // Execute the proposal's call
        (bool success, ) = p.target.call{value: 0}(p.callData);
        require(success, "Execution failed");

        emit ProposalExecuted(proposalId);
    }

    function cancelProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(
            msg.sender == p.proposer || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(
            p.state == ProposalState.Pending || p.state == ProposalState.Active,
            "Cannot cancel"
        );

        p.state = ProposalState.Cancelled;
        emit ProposalCancelled(proposalId);
    }

    // ── Admin ───────────────────────────────────────────────────

    function setVotingDuration(uint256 _duration) external onlyRole(ADMIN_ROLE) {
        require(_duration >= 1 days && _duration <= 30 days, "Duration must be 1d-30d");
        votingDuration = _duration;
    }

    function setTimelockDuration(uint256 _duration) external onlyRole(ADMIN_ROLE) {
        require(_duration >= 1 hours && _duration <= 7 days, "Duration must be 1h-7d");
        timelockDuration = _duration;
    }

    function setQuorumThreshold(uint256 _threshold) external onlyRole(ADMIN_ROLE) {
        require(_threshold >= 1000 && _threshold <= 5000, "Quorum must be 10%-50%");
        quorumThreshold = _threshold;
    }

    // ── View Functions ──────────────────────────────────────────

    function getProposalState(uint256 proposalId) external view returns (ProposalState) {
        Proposal storage p = proposals[proposalId];
        // Compute terminal states for Active proposals whose voting period ended
        if (p.state == ProposalState.Active && block.number > p.endBlock) {
            if (!_quorumReached(proposalId) || !_majorityReached(proposalId)) {
                return ProposalState.Defeated;
            }
            return ProposalState.Succeeded;
        }
        return p.state;
    }

    function getProposalVotes(uint256 proposalId) external view returns (
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes
    ) {
        Proposal storage p = proposals[proposalId];
        return (p.forVotes, p.againstVotes, p.abstainVotes);
    }

    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }

    // ── Internal ────────────────────────────────────────────────

    // L-7: voting power based on staked amount (not wallet balance)
    function _getVotingPower(address voter) internal view returns (uint256) {
        uint8 tier = tierStaking.getTier(voter);
        uint256 staked = tierStaking.getStakedAmount(voter);
        // Tier 0=1x, 1=2x, 2=3x, 3=5x, 4=10x, 5=20x
        uint256[6] memory tierWeights = [uint256(100), uint256(200), uint256(300), uint256(500), uint256(1000), uint256(2000)];
        if (tier >= tierWeights.length) tier = 0;
        return staked * tierWeights[tier] / 100;
    }

    function _quorumReached(uint256 proposalId) internal view returns (bool) {
        Proposal storage p = proposals[proposalId];
        uint256 totalVotes = p.forVotes + p.againstVotes + p.abstainVotes;
        uint256 quorum = (p.totalStakedAtProposal * quorumThreshold) / 10000;
        return totalVotes >= quorum;
    }

    function _majorityReached(uint256 proposalId) internal view returns (bool) {
        Proposal storage p = proposals[proposalId];
        return p.forVotes > p.againstVotes;
    }
}
