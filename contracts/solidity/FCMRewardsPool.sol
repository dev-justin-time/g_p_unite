// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITierStaking {
    function getTier(address operator) external view returns (uint8);
    function getEffectiveMultiplier(address operator) external view returns (uint256);
    function getMaxConcurrent(address operator) external view returns (uint256);
}

/**
 * @title FCMRewardsPool
 * @notice Distributes rewards with tier multipliers, epoch-based claims, and fair market value pricing.
 *         Admin funds the pool. Agents claim proportional rewards based on completed work + tier.
 *         Prevents Sybil attacks via minimum work requirements and tier-gated claim amounts.
 */
contract FCMRewardsPool is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // Task completion oracle

    IERC20 public fcmToken;
    ITierStaking public tierStaking;

    // ── Epoch System ────────────────────────────────────────────
    uint256 public constant EPOCH_DURATION = 7 days;
    uint256 public currentEpoch;
    uint256 public epochStartTime;

    struct EpochReward {
        uint256 totalPool;        // Total tokens deposited for this epoch
        uint256 totalDistributed; // Total tokens distributed
        uint256 tasksCompleted;   // Total tasks completed in epoch
        bool    finalized;
    }

    mapping(uint256 => EpochReward) public epochs;

    // ── Per-Agent Claims ────────────────────────────────────────
    struct AgentReward {
        uint256 totalEarned;     // Lifetime earnings
        uint256 epochWork;       // Work units completed in current epoch
        uint256 epochClaimed;    // Tokens claimed in current epoch
        uint256 lastClaimEpoch;  // Last epoch agent claimed
        uint256 consecutiveEpochs; // Streak counter
    }

    mapping(address => AgentReward) public agentRewards;

    // ── Fair Market Value Pricing ───────────────────────────────
    struct TaskPrice {
        uint256 basePrice;       // Base price in FCM tokens
        uint256 marketMultiplier; // Market adjustment (basis points)
        bool    active;
    }

    mapping(uint8 => TaskPrice) public taskPrices; // agentType → price
    uint256 public totalPoolBalance;
    uint256 public minClaimAmount = 1e18; // 1 FCM minimum claim

    event EpochFunded(uint256 indexed epoch, uint256 amount);
    event EpochFinalized(uint256 indexed epoch, uint256 totalDistributed);
    event RewardsClaimed(address indexed agent, uint256 amount, uint256 epoch);
    event TaskPriceUpdated(uint8 indexed agentType, uint256 basePrice, uint256 marketMultiplier);
    event WorkRecorded(address indexed agent, uint8 agentType, uint256 workUnits);

    constructor(address _fcmToken, address _tierStaking) {
        fcmToken = IERC20(_fcmToken);
        tierStaking = ITierStaking(_tierStaking);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        currentEpoch = 0;
        epochStartTime = block.timestamp;

        // Initialize fair market value prices (18 decimal tokens)
        taskPrices[0] = TaskPrice(2_500_000_000_000_000_000,  10000, true);  // Inference: 2.5 FCM
        taskPrices[1] = TaskPrice(1_000_000_000_000_000_000,  10000, true);  // Render: 1.0 FCM
        taskPrices[2] = TaskPrice(20_000_000_000_000_000_000, 10000, true);  // FL: 20 FCM
        taskPrices[3] = TaskPrice(1_000_000_000_000_000_000,  10000, true);  // Edge: 1.0 FCM
        taskPrices[4] = TaskPrice(40_000_000_000_000_000,     10000, true);  // ZK: 0.04 FCM
        taskPrices[5] = TaskPrice(2_000_000_000_000_000_000,  10000, true);  // Game: 2.0 FCM
        taskPrices[6] = TaskPrice(2_000_000_000_000_000_000,  10000, true);  // Science: 2.0 FCM
        taskPrices[7] = TaskPrice(10_000_000_000_000_000,     10000, true);  // Privacy: 0.01 FCM
        taskPrices[8]  = TaskPrice(1_000_000_000_000_000_000, 10000, true);  // Node: 1.0 FCM
        taskPrices[9]  = TaskPrice(50_000_000_000_000_000,    10000, true);  // Storage: 0.05 FCM
        taskPrices[10] = TaskPrice(20_000_000_000_000_000,    10000, true);  // File Server: 0.02 FCM
        taskPrices[11] = TaskPrice(1_000_000_000_000_000_000, 10000, true);  // Rewarded: 1.0 FCM
    }

    // ── Pool Funding ────────────────────────────────────────────

    function fundEpoch(uint256 amount) external onlyRole(ADMIN_ROLE) whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(fcmToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        totalPoolBalance += amount;
        epochs[currentEpoch].totalPool += amount;
        emit EpochFunded(currentEpoch, amount);
    }

    // ── Work Recording (Oracle only) ───────────────────────────

    function recordWork(
        address agent,
        uint8 agentType,
        uint256 workUnits
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        require(workUnits > 0, "Work must be > 0");
        require(taskPrices[agentType].active, "Invalid agent type");

        AgentReward storage reward = agentRewards[agent];
        reward.epochWork += workUnits;
        reward.totalEarned += 0; // Earned on claim, not on record

        emit WorkRecorded(agent, agentType, workUnits);
    }

    // ── Reward Claims ───────────────────────────────────────────

    function claimRewards() external nonReentrant whenNotPaused {
        require(currentEpoch > 0, "No epochs completed");
        uint256 claimEpoch = currentEpoch - 1; // Claim from last finalized epoch

        AgentReward storage reward = agentRewards[msg.sender];
        require(reward.lastClaimEpoch < claimEpoch, "Already claimed");
        require(reward.epochWork > 0, "No work recorded");

        EpochReward storage epoch = epochs[claimEpoch];
        require(epoch.finalized, "Epoch not finalized");

        // Calculate reward: (agentWork / totalWork) * pool * multiplier / 10000
        uint256 multiplier = tierStaking.getEffectiveMultiplier(msg.sender);
        uint256 agentShare = (reward.epochWork * epoch.totalPool * multiplier) / (epoch.tasksCompleted * 10000);

        // Minimum claim threshold (Sybil prevention)
        require(agentShare >= minClaimAmount, "Below minimum claim");

        // Cap at available pool balance
        uint256 actualClaim = agentShare > totalPoolBalance ? totalPoolBalance : agentShare;
        require(actualClaim > 0, "Zero claim");

        // Update state before transfer (CEI pattern)
        reward.lastClaimEpoch = claimEpoch;
        reward.epochClaimed = actualClaim;
        reward.totalEarned += actualClaim;
        reward.consecutiveEpochs++;
        totalPoolBalance -= actualClaim;
        epoch.totalDistributed += actualClaim;

        require(fcmToken.transfer(msg.sender, actualClaim), "Transfer failed");
        emit RewardsClaimed(msg.sender, actualClaim, claimEpoch);
    }

    // ── Epoch Finalization ──────────────────────────────────────

    function finalizeEpoch() external whenNotPaused {
        require(block.timestamp >= epochStartTime + EPOCH_DURATION, "Epoch not ended");

        EpochReward storage epoch = epochs[currentEpoch];
        epoch.finalized = true;

        // Start new epoch
        currentEpoch++;
        epochStartTime = block.timestamp;
        epochs[currentEpoch].totalPool = 0;

        emit EpochFinalized(currentEpoch - 1, epoch.totalDistributed);
    }

    // ── Pricing Updates ─────────────────────────────────────────

    function setTaskPrice(
        uint8 agentType,
        uint256 basePrice,
        uint256 marketMultiplier
    ) external onlyRole(ADMIN_ROLE) {
        require(marketMultiplier >= 5000 && marketMultiplier <= 20000, "Multiplier must be 0.5x-2x");
        taskPrices[agentType] = TaskPrice(basePrice, marketMultiplier, true);
        emit TaskPriceUpdated(agentType, basePrice, marketMultiplier);
    }

    function setMinClaimAmount(uint256 _min) external onlyRole(ADMIN_ROLE) {
        require(_min > 0, "Must be > 0");
        minClaimAmount = _min;
    }

    // ── View Functions ──────────────────────────────────────────

    function getEffectivePrice(uint8 agentType) external view returns (uint256) {
        TaskPrice storage p = taskPrices[agentType];
        if (!p.active) return 0;
        // basePrice is in 18 decimals, marketMultiplier is basis points (10000 = 1x)
        return (p.basePrice * p.marketMultiplier) / 10000;
    }

    function getAgentLifetimeEarnings(address agent) external view returns (uint256) {
        return agentRewards[agent].totalEarned;
    }

    function getAgentPendingRewards(address agent) external view returns (uint256) {
        uint256 claimEpoch = currentEpoch > 0 ? currentEpoch - 1 : 0;
        if (agentRewards[agent].lastClaimEpoch >= claimEpoch) return 0;

        EpochReward storage epoch = epochs[claimEpoch];
        if (!epoch.finalized || epoch.tasksCompleted == 0) return 0;

        uint256 multiplier = tierStaking.getEffectiveMultiplier(agent);
        return (agentRewards[agent].epochWork * epoch.totalPool * multiplier) / (epoch.tasksCompleted * 10000);
    }

    function getEpochInfo(uint256 epochNum) external view returns (
        uint256 totalPool,
        uint256 totalDistributed,
        uint256 tasksCompleted,
        bool finalized
    ) {
        EpochReward storage e = epochs[epochNum];
        return (e.totalPool, e.totalDistributed, e.tasksCompleted, e.finalized);
    }

    // ── Emergency ───────────────────────────────────────────────

    function emergencyWithdraw(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused(), "Not paused");
        require(amount <= totalPoolBalance, "Insufficient balance");
        totalPoolBalance -= amount;
        require(fcmToken.transfer(msg.sender, amount), "Transfer failed");
    }
}
