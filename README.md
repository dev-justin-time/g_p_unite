# FCM Expert Agent Swarm

**Federated Compute Mesh — 8 Smart Contracts · 18 Agents · 362 Tests**

A decentralized compute platform with on-chain staking, task marketplace, tiered rewards, governance, milestone escrow, and soulbound reputation NFTs.

## Quick Start

```bash
# Install & compile
npm install
npx hardhat compile

# Run 362 tests
npx hardhat test

# Serve dashboard
python3 -m http.server 8080
```

## Contracts (Solidity ^0.8.20, OpenZeppelin)

| Contract | Purpose |
|----------|---------|
| **FCMToken** | ERC20 with 1% burn + 2% treasury fees, 1B max supply |
| **FCMAgentRegistry** | Agent registration, task lifecycle, dispute resolution, staking |
| **FCMTaskMarketplace** | Spot tasks, Dutch auctions, bid escrow, refunds |
| **FCMTierStaking** | 6-tier staking (Free→Elite) with hardware score + grace periods |
| **FCMGovernance** | On-chain proposals, tier-weighted voting, timelock execution |
| **FCMEscrow** | Milestone-based payments, multi-sig for high-value, dispute arbitration |
| **FCMReputationNFT** | Soulbound ERC721 badges with 8 achievement flags |
| **FCMRewardsPool** | Epoch-based reward distribution with Sybil resistance |

## Security

All contracts have been audited for:
- ✅ CEI (Checks-Effects-Interactions) compliance
- ✅ Reentrancy protection (OpenZeppelin ReentrancyGuard)
- ✅ Access control (OpenZeppelin AccessControl)
- ✅ Integer overflow/underflow (Solidity ^0.8.20 built-in)
- ✅ Double-spend prevention
- ✅ Division-by-zero guards
- ✅ Emergency pause (OpenZeppelin Pausable)

## Platform Dashboard

Open `dashboard.html` for the full 18-agent dashboard with live metrics, tier rankings, and role-based access control.

### Agent Tiers

| Tier | Name | Min Stake | Score | Multiplier | Fee Discount |
|------|------|-----------|-------|------------|-------------|
| 0 | Free | 0 FCM | 0 | 0.5x | 0% |
| 1 | Starter | 100 FCM | 2,000 | 1x | 5% |
| 2 | Standard | 500 FCM | 4,000 | 1.5x | 10% |
| 3 | Advanced | 2,000 FCM | 6,000 | 2x | 15% |
| 4 | Pro | 10,000 FCM | 8,000 | 3x | 20% |
| 5 | Elite | 50,000 FCM | 9,000 | 5x | 25% |
