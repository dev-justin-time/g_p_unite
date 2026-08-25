# FCM Sepolia Testnet Deployment Guide

Step-by-step guide to deploy all 8 FCM smart contracts to the Ethereum Sepolia testnet.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **Node.js** | v18+ required |
| **Sepolia ETH** | ~0.8 ETH for gas (8 deploys + role grants) |
| **Private Key** | Throwaway wallet — never use your main key |
| **Etherscan API Key** | For contract verification |

### Get Sepolia ETH

1. **Alchemy Faucet**: https://sepoliafaucet.com (0.5 ETH/day)
2. **Infura Faucet**: https://www.infura.io/faucet/sepolia
3. **Google Cloud Faucet**: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
4. **QuickNode Faucet**: https://faucet.quicknode.com/ethereum/sepolia

### Get Etherscan API Key

1. Go to https://etherscan.io/myapikey
2. Create free account → API Keys → Add
3. Copy the key

---

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment

```bash
# Copy the template
cp .env.example .env

# Edit .env with your values
```

Required `.env` values:

```bash
# Your Sepolia deployer wallet private key (0x prefix required)
TESTNET_PRIVATE_KEY=0x_YOUR_PRIVATE_KEY_HERE

# Etherscan API key for verification
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY

# Sepolia RPC (default works, or use Alchemy/Infura for faster)
SEPOLIA_RPC=https://rpc.sepolia.org
```

## Step 3: Verify Wallet Balance

```bash
# Check deployer balance
npx hardhat run --network sepolia -e "
  const [s] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(s.address);
  console.log('Address:', s.address);
  console.log('Balance:', ethers.formatEther(bal), 'ETH');
"
```

**Need at least 0.3 ETH.** If low, visit a faucet.

## Step 4: Compile Contracts

```bash
npx hardhat compile
```

Expected output:
```
Compiled 29 Solidity files successfully
```

## Step 5: Deploy All 8 Contracts

```bash
npm run deploy:sepolia
```

This deploys in order:
1. **FCMToken** — ERC20 with fees, 500M initial supply, 500M reserve
2. **FCMAgentRegistry** — Agent registration, tasks, heartbeats, disputes
3. **FCMTaskMarketplace** — Spot tasks, auctions, escrow (no requirements param)
4. **FCMTierStaking** — 6-tier staking with hardware verification
5. **FCMGovernance** — On-chain proposal voting (tier-weighted, snapshots)
6. **FCMEscrow** — Milestone payment escrow with multi-sig
7. **FCMReputationNFT** — Soulbound reputation badges
8. **FCMRewardsPool** — Epoch reward distribution (ADMIN-only finalize)

The script also:
- Grants 8 cross-contract roles
- Saves addresses to `deployments/latest.json`
- Verifies all contracts on Etherscan (after 30s delay)

**Typical gas cost:** ~0.2-0.4 ETH on Sepolia

## Step 6: Save Contract Addresses

After deployment, update your `.env`:

```bash
FCM_TOKEN_CONTRACT=0x...
FCM_REGISTRY_CONTRACT=0x...
FCM_MARKETPLACE_CONTRACT=0x...
FCM_TIER_STAKING_CONTRACT=0x...
FCM_GOVERNANCE_CONTRACT=0x...
FCM_ESCROW_CONTRACT=0x...
FCM_REPUTATION_NFT_CONTRACT=0x...
FCM_REWARDS_POOL_CONTRACT=0x...
```

## Step 7: Verify on Etherscan

If automatic verification failed, verify manually:

```bash
# Verify each contract
npx hardhat verify --network sepolia CONTRACT_ADDRESS [constructor_args]

# Example: FCMToken
npx hardhat verify --network sepolia 0xYOUR_TOKEN 0xYOUR_DEPLOYER

# Example: FCMAgentRegistry
npx hardhat verify --network sepolia 0xYOUR_REGISTRY 0xYOUR_TOKEN

# Example: FCMGovernance
npx hardhat verify --network sepolia 0xYOUR_GOVERNANCE 0xYOUR_TOKEN 0xYOUR_TIER_STAKING
```

### Constructor Arguments Reference

| Contract | Constructor Args |
|----------|-----------------|
| FCMToken | `(treasury_address)` |
| FCMAgentRegistry | `(token_address)` |
| FCMTaskMarketplace | `(registry_address, token_address)` |
| FCMTierStaking | `(token_address)` |
| FCMGovernance | `(token_address, tier_staking_address)` |
| FCMEscrow | `(token_address)` |
| FCMReputationNFT | `()` |
| FCMRewardsPool | `(token_address, tier_staking_address)` |

## Step 8: Post-Deployment Setup

### Grant Additional Roles (Optional)

```bash
# Grant VALIDATOR_ROLE to a separate resolver address
npx hardhat console --network sepolia
> const registry = await ethers.getContractAt("FCMAgentRegistry", "0xYOUR_REGISTRY")
> const VALIDATOR_ROLE = await registry.VALIDATOR_ROLE()
> await registry.grantRole(VALIDATOR_ROLE, "0xRESOLVER_ADDRESS")
```

### Fund the RewardsPool

```bash
> const token = await ethers.getContractAt("FCMToken", "0xYOUR_TOKEN")
> const pool = await ethers.getContractAt("FCMRewardsPool", "0xYOUR_POOL")
> await token.approve(await pool.getAddress(), ethers.parseEther("100000"))
> await pool.fundPool(ethers.parseEther("100000"))
```

### Create First Proposal (Governance Test)

```bash
> const gov = await ethers.getContractAt("FCMGovernance", "0xYOUR_GOVERNANCE")
> await gov.propose("Test proposal: update MIN_STAKE", "0xYOUR_REGISTRY", "0x")
```

---

## Deployed Contract URLs

After deployment, view on Etherscan:

```
https://sepolia.etherscan.io/address/0xYOUR_TOKEN
https://sepolia.etherscan.io/address/0xYOUR_REGISTRY
https://sepolia.etherscan.io/address/0xYOUR_MARKETPLACE
https://sepolia.etherscan.io/address/0xYOUR_TIER_STAKING
https://sepolia.etherscan.io/address/0xYOUR_GOVERNANCE
https://sepolia.etherscan.io/address/0xYOUR_ESCROW
https://sepolia.etherscan.io/address/0xYOUR_REPUTATION_NFT
https://sepolia.etherscan.io/address/0xYOUR_REWARDS_POOL
```

---

## Troubleshooting

### "insufficient funds for gas"
→ Get more Sepolia ETH from a faucet

### "nonce has already been used"
→ Wait 30s and retry, or reset nonce:
```bash
npx hardhat nonce --network sepolia
```

### "contract verification failed"
→ Wait 5 minutes for Etherscan indexing, then:
```bash
npx hardhat verify --network sepolia ADDRESS [args]
```

### "replacement transaction underpriced"
→ Increase gas price in `hardhat.config.js`:
```js
sepolia: { gasPrice: 30000000000 } // 30 gwei
```

### Deployment hangs
→ Check RPC endpoint. Try alternative:
```bash
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
```

---

## Other Testnets

Deploy to Base Sepolia:
```bash
npm run deploy:baseSepolia
```

Deploy to Arbitrum Sepolia:
```bash
npm run deploy:arbitrumSepolia
```

Deploy locally (no gas needed):
```bash
npm run deploy:local
```

---

## Role Summary

| Role | Contract | Grantee | Purpose |
|------|----------|---------|---------|
| `MINTER_ROLE` | FCMToken | Registry | Mint task rewards |
| `MINTER_ROLE` | FCMToken | RewardsPool | Mint epoch rewards |
| `LISTING_ROLE` | Marketplace | Deployer | List spot/auction tasks |
| `VALIDATOR_ROLE` | Registry | Deployer | Resolve disputes |
| `ORACLE_ROLE` | TierStaking | Deployer | Update HW scores |
| `ORACLE_ROLE` | ReputationNFT | Deployer | Update badges |
| `ORACLE_ROLE` | RewardsPool | Deployer | Record work |
| `ARBITRATOR_ROLE` | Escrow | Deployer | Resolve disputes |
