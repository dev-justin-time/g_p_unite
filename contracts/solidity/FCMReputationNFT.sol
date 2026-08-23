// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title FCMReputationNFT
 * @notice Soulbound (non-transferable) NFTs representing agent reputation, tier, and achievements.
 *         Each agent gets one badge that evolves as they complete work and maintain uptime.
 *         Serves as portable on-chain reputation across the FCM ecosystem.
 */
contract FCMReputationNFT is ERC721, AccessControl, Pausable {
    using Counters for Counters.Counter;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    Counters.Counter private _tokenIdCounter;

    struct Badge {
        address operator;
        bytes32 didHash;
        uint8   tier;
        uint256 totalWork;
        uint256 totalEarnings;
        uint256 uptimeScore;
        uint256 disputesWon;
        uint256 disputesLost;
        uint256 consecutiveDays;
        uint256 mintedAt;
        uint256 lastUpdated;
        bool    exists;
    }

    mapping(uint256 => Badge) public badges;
    mapping(address => uint256) public operatorBadge;
    mapping(bytes32 => uint256) public didBadge;

    uint256 public constant ACHIEVEMENT_FIRST_TASK       = 1 << 0;
    uint256 public constant ACHIEVEMENT_100_TASKS        = 1 << 1;
    uint256 public constant ACHIEVEMENT_1000_TASKS       = 1 << 2;
    uint256 public constant ACHIEVEMENT_PERFECT_UPTIME   = 1 << 3;
    uint256 public constant ACHIEVEMENT_TIER_5           = 1 << 4;
    uint256 public constant ACHIEVEMENT_YEAR_VETERAN     = 1 << 5;
    uint256 public constant ACHIEVEMENT_DISPUTE_CHAMPION = 1 << 6;
    uint256 public constant ACHIEVEMENT_MILLION_EARNED   = 1 << 7;

    mapping(uint256 => uint256) public achievements;

    event BadgeMinted(uint256 indexed tokenId, address indexed operator, bytes32 didHash);
    event BadgeUpdated(uint256 indexed tokenId, uint8 newTier, uint256 totalWork);
    event AchievementUnlocked(uint256 indexed tokenId, uint256 achievement);

    constructor() ERC721("FCM Reputation Badge", "FCMRB") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ── Required override: resolve ERC721 + AccessControl collision ──
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ── Badge Minting ───────────────────────────────────────────

    function mintBadge(address operator, bytes32 didHash) external onlyRole(ADMIN_ROLE) {
        require(operator != address(0), "Invalid operator");
        require(operatorBadge[operator] == 0, "Badge already exists");
        require(didBadge[didHash] == 0, "DID already has badge");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(operator, tokenId);

        badges[tokenId] = Badge({
            operator: operator,
            didHash: didHash,
            tier: 0,
            totalWork: 0,
            totalEarnings: 0,
            uptimeScore: 0,
            disputesWon: 0,
            disputesLost: 0,
            consecutiveDays: 0,
            mintedAt: block.timestamp,
            lastUpdated: block.timestamp,
            exists: true
        });

        operatorBadge[operator] = tokenId;
        didBadge[didHash] = tokenId;

        emit BadgeMinted(tokenId, operator, didHash);
    }

    // ── Badge Updates (Oracle only) ─────────────────────────────

    function updateBadge(
        address operator,
        uint8 newTier,
        uint256 addWork,
        uint256 addEarnings,
        uint256 newUptime,
        bool disputeWon,
        bool disputeLost
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        uint256 tokenId = operatorBadge[operator];
        require(tokenId > 0, "No badge");

        Badge storage b = badges[tokenId];
        b.tier = newTier;
        b.totalWork += addWork;
        b.totalEarnings += addEarnings;
        b.uptimeScore = newUptime;
        if (disputeWon) b.disputesWon++;
        if (disputeLost) b.disputesLost++;
        b.lastUpdated = block.timestamp;

        _checkAchievements(tokenId, b);
        emit BadgeUpdated(tokenId, newTier, b.totalWork);
    }

    function incrementStreak(address operator) external onlyRole(ORACLE_ROLE) {
        uint256 tokenId = operatorBadge[operator];
        require(tokenId > 0, "No badge");
        badges[tokenId].consecutiveDays++;
    }

    // ── Soulbound: Block transfers and approvals ────────────────

    function transferFrom(address, address, uint256) public view override {
        revert("Soulbound: cannot transfer");
    }

    function safeTransferFrom(address, address, uint256) public view override {
        revert("Soulbound: cannot transfer");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public view override {
        revert("Soulbound: cannot transfer");
    }

    function approve(address, uint256) public view override {
        revert("Soulbound: cannot approve");
    }

    function setApprovalForAll(address, bool) public view override {
        revert("Soulbound: cannot approve");
    }

    // ── View Functions ──────────────────────────────────────────

    function getBadge(address operator) external view returns (Badge memory) {
        uint256 tokenId = operatorBadge[operator];
        require(tokenId > 0, "No badge");
        return badges[tokenId];
    }

    function getAchievements(address operator) external view returns (uint256) {
        uint256 tokenId = operatorBadge[operator];
        require(tokenId > 0, "No badge");
        return achievements[tokenId];
    }

    function hasAchievement(address operator, uint256 achievement) external view returns (bool) {
        uint256 tokenId = operatorBadge[operator];
        if (tokenId == 0) return false;
        return (achievements[tokenId] & achievement) != 0;
    }

    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    // ── Internal ────────────────────────────────────────────────

    function _checkAchievements(uint256 tokenId, Badge storage b) internal {
        uint256 current = achievements[tokenId];
        uint256 updated = current;

        if (b.totalWork >= 1 && (updated & ACHIEVEMENT_FIRST_TASK) == 0) {
            updated |= ACHIEVEMENT_FIRST_TASK;
            emit AchievementUnlocked(tokenId, ACHIEVEMENT_FIRST_TASK);
        }
        if (b.totalWork >= 100 && (updated & ACHIEVEMENT_100_TASKS) == 0) {
            updated |= ACHIEVEMENT_100_TASKS;
            emit AchievementUnlocked(tokenId, ACHIEVEMENT_100_TASKS);
        }
        if (b.totalWork >= 1000 && (updated & ACHIEVEMENT_1000_TASKS) == 0) {
            updated |= ACHIEVEMENT_1000_TASKS;
            emit AchievementUnlocked(tokenId, ACHIEVEMENT_1000_TASKS);
        }
        if (b.uptimeScore >= 9900 && (updated & ACHIEVEMENT_PERFECT_UPTIME) == 0) {
            updated |= ACHIEVEMENT_PERFECT_UPTIME;
            emit AchievementUnlocked(tokenId, ACHIEVEMENT_PERFECT_UPTIME);
        }
        if (b.tier >= 5 && (updated & ACHIEVEMENT_TIER_5) == 0) {
            updated |= ACHIEVEMENT_TIER_5;
            emit AchievementUnlocked(tokenId, ACHIEVEMENT_TIER_5);
        }
        if (block.timestamp - b.mintedAt >= 365 days && (updated & ACHIEVEMENT_YEAR_VETERAN) == 0) {
            updated |= ACHIEVEMENT_YEAR_VETERAN;
            emit AchievementUnlocked(tokenId, ACHIEVEMENT_YEAR_VETERAN);
        }
        if (b.disputesWon >= 10 && b.disputesLost == 0 && (updated & ACHIEVEMENT_DISPUTE_CHAMPION) == 0) {
            updated |= ACHIEVEMENT_DISPUTE_CHAMPION;
            emit AchievementUnlocked(tokenId, ACHIEVEMENT_DISPUTE_CHAMPION);
        }
        if (b.totalEarnings >= 1_000_000e18 && (updated & ACHIEVEMENT_MILLION_EARNED) == 0) {
            updated |= ACHIEVEMENT_MILLION_EARNED;
            emit AchievementUnlocked(tokenId, ACHIEVEMENT_MILLION_EARNED);
        }

        if (updated != current) {
            achievements[tokenId] = updated;
        }
    }
}
