// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract FCMToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
    uint256 public constant INITIAL_SUPPLY = 500_000_000 * 10**18; // 500M pre-minted, 500M reserved for rewards
    uint256 public totalBurned;
    uint256 public totalMintedRewards;
    uint256 public burnRate = 100;       // 1%
    uint256 public treasuryRate = 200;   // 2%
    address public treasury;
    mapping(address => bool) public feeExempt;
    bool private _inFeeTransfer;

    event BurnMintEquilibrium(uint256 burned, uint256 minted, uint256 timestamp);
    event FeesUpdated(uint256 burnRate, uint256 treasuryRate);
    event FeeExemptUpdated(address account, bool exempt);

    constructor(address _treasury) ERC20("Federated Compute Mesh", "FCM") {
        treasury = _treasury;
        feeExempt[_treasury] = true;
        feeExempt[address(this)] = true;
        // Note: registry and marketplace addresses should be set fee-exempt after deployment
        // via setFeeExempt() by the admin
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        // Initial distribution: 200M deployer + 200M treasury + 100M contract reserve = 500M
        // Remaining 500M reserved for reward minting via mintRewards()
        _mint(msg.sender, 200_000_000 * 10**18);
        _mint(_treasury, 200_000_000 * 10**18);
        _mint(address(this), 100_000_000 * 10**18);
    }

    function mintRewards(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be > 0");
        require(totalMintedRewards + amount <= MAX_SUPPLY - INITIAL_SUPPLY, "Mintable supply exceeded");
        totalMintedRewards += amount;
        _mint(to, amount);
        emit BurnMintEquilibrium(totalBurned, totalMintedRewards, block.timestamp);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount) internal override {
        super._afterTokenTransfer(from, to, amount);

        // Skip if this is already a fee transfer, or if minting/burning, or if either party is exempt
        if (_inFeeTransfer) return;
        if (from == address(0) || to == address(0)) return;
        if (feeExempt[from] || feeExempt[to]) return;

        uint256 burnAmount = (amount * burnRate) / 10000;
        uint256 treasuryAmount = (amount * treasuryRate) / 10000;

        _inFeeTransfer = true;

        if (burnAmount > 0) {
            _burn(to, burnAmount);
            totalBurned += burnAmount;
        }

        if (treasuryAmount > 0) {
            _transfer(to, treasury, treasuryAmount);
        }

        _inFeeTransfer = false;
    }

    function setFeeRates(uint256 _burnRate, uint256 _treasuryRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_burnRate + _treasuryRate <= 1000, "Max 10% fees");
        burnRate = _burnRate;
        treasuryRate = _treasuryRate;
        emit FeesUpdated(_burnRate, _treasuryRate);
    }

    function setFeeExempt(address account, bool exempt) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeExempt[account] = exempt;
        emit FeeExemptUpdated(account, exempt);
    }

    function getMintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - INITIAL_SUPPLY - totalMintedRewards;
    }
}
