// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title FCMTierStaking
 * @notice Tiered staking system with hardware-quality-based tiers.
 *         Tier 0 (Free) → Tier 5 (Elite). Higher tiers get lower fees, priority tasks, and governance weight.
 *         Tier upgrades are automatic based on stake + hardware score + uptime.
 *         Tier downgrades have a grace period to prevent gaming.
 */
contract FCMTierStaking is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // Hardware verification oracle

    IERC20 public fcmToken;

    // ── Tier Definitions ────────────────────────────────────────
    struct TierConfig {
        uint256 minStake;        // Minimum stake to qualify
        uint256 minScore;        // Minimum hardware+uptime score (0-10000)
        uint256 rewardMultiplier; // Basis points (100 = 1x, 500 = 5x)
        uint256 feeDiscount;     // Basis points discount on platform fees
        uint256 maxConcurrent;   // Max concurrent tasks for this tier
        string  name;            // Tier name
    }

    // Tier 0-5, indexed by tier number
    mapping(uint8 => TierConfig) public tiers;

    struct StakeInfo {
        address operator;
        uint256 amount;
        uint256 stakedAt;
        uint256 lastHardwareCheck;
        uint256 hardwareScore;     // 0-10000 (hardware quality)
        uint256 uptimeScore;       // 0-10000 (uptime percentage * 100)
        uint8   currentTier;
        uint8   targetTier;        // Pending upgrade tier
        uint256 tierChangedAt;     // Timestamp of last tier change
        bool    exists;
    }

    uint256 public constant TIER_CHANGE_GRACE_PERIOD = 3 days; // Anti-gaming grace period
    uint256 public constant HARDWARE_CHECK_INTERVAL = 24 hours;
    uint256 public constant MAX_TIERS = 6;

    mapping(address => StakeInfo) public stakes;
    mapping(uint8 => uint256) public tierStakeCount; // How many operators at each tier
    address[] public stakers;

    event Staked(address indexed operator, uint256 amount, uint8 tier);
    event Unstaked(address indexed operator, uint256 amount);
    event TierUpgraded(address indexed operator, uint8 oldTier, uint8 newTier);
    event TierDowngraded(address indexed operator, uint8 oldTier, uint8 newTier);
    event HardwareScoreUpdated(address indexed operator, uint256 hardwareScore, uint256 uptimeScore);
    event TierConfigUpdated(uint8 tier, string name, uint256 minStake, uint256 minScore);

    constructor(address _fcmToken) {
        fcmToken = IERC20(_fcmToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        // Initialize 6 tiers (0-5)
        tiers[0] = TierConfig(0,           0,     50,  0,   1,  "Free");
        tiers[1] = TierConfig(100e18,      2000,  100, 500, 3,  "Starter");
        tiers[2] = TierConfig(500e18,      4000,  150, 1000, 5,  "Standard");
        tiers[3] = TierConfig(2000e18,     6000,  200, 1500, 10, "Advanced");
        tiers[4] = TierConfig(10000e18,    8000,  300, 2000, 20, "Pro");
        tiers[5] = TierConfig(50000e18,    9000,  500, 2500, 50, "Elite");
    }

    // ── Staking ─────────────────────────────────────────────────

    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(fcmToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        StakeInfo storage info = stakes[msg.sender];
        if (!info.exists) {
            info.operator = msg.sender;
            info.stakedAt = block.timestamp;
            info.tierChangedAt = block.timestamp;
            info.exists = true;
            tierStakeCount[0]++; // New stakers start at Tier 0
            stakers.push(msg.sender);
        }

        info.amount += amount;
        // Allow immediate first hardware check
        if (info.lastHardwareCheck == 0) {
            info.lastHardwareCheck = 1; // Set to 1 so first check is allowed
        }

        // Auto-assign initial tier
        uint8 newTier = _computeTier(info.amount, info.hardwareScore + info.uptimeScore);
        if (newTier > info.currentTier) {
            tierStakeCount[info.currentTier]--;
            info.currentTier = newTier;
            tierStakeCount[newTier]++;
            info.tierChangedAt = block.timestamp;
            emit TierUpgraded(msg.sender, 0, newTier);
        }
        // Keep targetTier in sync — no pending downgrade after a stake
        info.targetTier = info.currentTier;

        emit Staked(msg.sender, amount, info.currentTier);
    }

    function unstake(uint256 amount) external nonReentrant whenNotPaused {
        StakeInfo storage info = stakes[msg.sender];
        require(info.exists, "No stake");
        require(info.amount >= amount, "Insufficient stake");
        require(amount > 0, "Amount must be > 0");

        info.amount -= amount;
        require(fcmToken.transfer(msg.sender, amount), "Transfer failed");

        // Recompute tier
        uint8 newTier = _computeTier(info.amount, info.hardwareScore + info.uptimeScore);
        if (newTier < info.currentTier) {
            // Grace period check — prevent tier-downgrade gaming
            require(
                block.timestamp - info.tierChangedAt >= TIER_CHANGE_GRACE_PERIOD,
                "Tier change grace period active"
            );
            tierStakeCount[info.currentTier]--;
            info.currentTier = newTier;
            tierStakeCount[newTier]++;
            emit TierDowngraded(msg.sender, info.currentTier, newTier);
        }
        // Keep targetTier in sync — no pending downgrade after an unstake
        info.targetTier = info.currentTier;

        emit Unstaked(msg.sender, amount);
    }

    // ── Hardware Score Updates (Oracle only) ────────────────────

    function updateHardwareScore(
        address operator,
        uint256 _hardwareScore,
        uint256 _uptimeScore
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        StakeInfo storage info = stakes[operator];
        require(info.exists, "No stake");
        require(_hardwareScore <= 10000 && _uptimeScore <= 10000, "Score out of range");
        require(block.timestamp - info.lastHardwareCheck >= HARDWARE_CHECK_INTERVAL, "Too soon");

        info.hardwareScore = _hardwareScore;
        info.uptimeScore = _uptimeScore;
        info.lastHardwareCheck = block.timestamp;

        // Auto-recompute tier
        uint8 oldTier = info.currentTier;
        uint8 newTier = _computeTier(info.amount, _hardwareScore + _uptimeScore);

        if (newTier != oldTier) {
            // Grace period for downgrades
            if (newTier < oldTier) {
                info.targetTier = newTier;
                // Downgrade happens after grace period — check if grace has passed
                if (block.timestamp - info.tierChangedAt >= TIER_CHANGE_GRACE_PERIOD) {
                    tierStakeCount[oldTier]--;
                    info.currentTier = newTier;
                    tierStakeCount[newTier]++;
                    info.tierChangedAt = block.timestamp;
                    emit TierDowngraded(operator, oldTier, newTier);
                }
                // If grace not passed, target is set but not applied yet
            } else {
                // Upgrades are immediate
                tierStakeCount[oldTier]--;
                info.currentTier = newTier;
                tierStakeCount[newTier]++;
                info.tierChangedAt = block.timestamp;
                info.targetTier = newTier; // No pending downgrade after upgrade
                emit TierUpgraded(operator, oldTier, newTier);
            }
        }

        emit HardwareScoreUpdated(operator, _hardwareScore, _uptimeScore);
    }

    // ── Governance ──────────────────────────────────────────────

    function updateTierConfig(
        uint8 _tier,
        uint256 _minStake,
        uint256 _minScore,
        uint256 _rewardMultiplier,
        uint256 _feeDiscount,
        uint256 _maxConcurrent,
        string calldata _name
    ) external onlyRole(ADMIN_ROLE) {
        require(_tier < MAX_TIERS, "Invalid tier");
        require(_rewardMultiplier <= 500, "Max 5x multiplier");
        require(_feeDiscount <= 5000, "Max 50% discount");

        tiers[_tier] = TierConfig(_minStake, _minScore, _rewardMultiplier, _feeDiscount, _maxConcurrent, _name);
        emit TierConfigUpdated(_tier, _name, _minStake, _minScore);
    }

    // ── View Functions ──────────────────────────────────────────

    function getTier(address operator) external view returns (uint8) {
        return stakes[operator].currentTier;
    }

    function getEffectiveMultiplier(address operator) external view returns (uint256) {
        return tiers[stakes[operator].currentTier].rewardMultiplier;
    }

    function getFeeDiscount(address operator) external view returns (uint256) {
        return tiers[stakes[operator].currentTier].feeDiscount;
    }

    function getMaxConcurrent(address operator) external view returns (uint256) {
        return tiers[stakes[operator].currentTier].maxConcurrent;
    }

    function getStakerCount() external view returns (uint256) {
        return stakers.length;
    }

    function getStakersByTier(uint8 tier) external view returns (address[] memory) {
        uint256 count = tierStakeCount[tier];
        address[] memory result = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < stakers.length && idx < count; i++) {
            if (stakes[stakers[i]].currentTier == tier) {
                result[idx++] = stakers[i];
            }
        }
        return result;
    }

    // ── Internal ────────────────────────────────────────────────

    function _computeTier(uint256 _stake, uint256 combinedScore) internal view returns (uint8) {
        uint8 bestTier = 0;
        for (uint8 t = 5; t >= 1; t--) {
            if (_stake >= tiers[t].minStake && combinedScore >= tiers[t].minScore) {
                bestTier = t;
                break;
            }
        }
        return bestTier;
    }

    // ── Pending Tier Downgrade ──────────────────────────────────

    /**
     * @notice Apply a pending tier downgrade after the grace period has passed.
     *         Callable by anyone. Safe to call even if no downgrade is pending.
     */
    function applyPendingDowngrade(address operator) external {
        StakeInfo storage info = stakes[operator];
        require(info.exists, "No stake");

        uint8 oldTier = info.currentTier;
        uint8 target = info.targetTier;

        if (target < oldTier) {
            require(
                block.timestamp - info.tierChangedAt >= TIER_CHANGE_GRACE_PERIOD,
                "Grace period not passed"
            );
            tierStakeCount[oldTier]--;
            info.currentTier = target;
            tierStakeCount[target]++;
            info.tierChangedAt = block.timestamp;
            info.targetTier = target; // Applied — no longer pending
            emit TierDowngraded(operator, oldTier, target);
        }
    }

    // Emergency withdraw — only when paused
    function emergencyWithdraw() external nonReentrant {
        require(paused(), "Not paused");
        StakeInfo storage info = stakes[msg.sender];
        require(info.exists && info.amount > 0, "No stake");

        uint256 amount = info.amount;
        uint8 oldTier = info.currentTier;
        info.amount = 0;
        info.currentTier = 0;
        if (oldTier > 0) {
            tierStakeCount[oldTier]--;
        }
        tierStakeCount[0]++;

        require(fcmToken.transfer(msg.sender, amount), "Transfer failed");
        emit Unstaked(msg.sender, amount);
    }
}
