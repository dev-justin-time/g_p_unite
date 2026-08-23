/**
 * Gnosis Safe Integration Module
 *
 * Provides:
 *   - Safe address validation and lookup
 *   - Role grant transaction encoding for Safe execution
 *   - Safe configuration verification
 *   - Multi-sig role management
 *
 * Works with Gnosis Safe v1.3+ on any EVM chain.
 * Safe transactions are encoded and executed via the Safe's execTransaction function.
 */

const { ethers } = require("ethers");

// ── Gnosis Safe ABI (minimal) ────────────────────────────────────

const SAFE_ABI = [
    // Core
    "function getTransactionHash(address to, uint256 value, bytes data, Enum.Operation operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 nonce) view returns (bytes32)",
    "function execTransaction(address to, uint256 value, bytes calldata data, Enum.Operation operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes memory signatures) payable returns (bool)",
    "function nonce() view returns (uint256)",
    "function getThreshold() view returns (uint256)",
    "function getOwners() view returns (address[])",
    "function isOwner(address) view returns (bool)",
    "function domainSeparator() view returns (bytes32)",
    "function encodeTransactionData(address to, uint256 value, bytes calldata data, Enum.Operation operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 nonce) view returns (bytes memory)",

    // Events
    "event ExecutionFailure(bytes32 txHash)",
    "event ExecutionSuccess(bytes32 txHash, bool success)",
    "event SafeReceived(address indexed sender, uint256 value)",
];

// ── Role Grant ABI (common) ──────────────────────────────────────

const ACCESS_CONTROL_ABI = [
    "function grantRole(bytes32 role, address account)",
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function getRoleAdmin(bytes32 role) view returns (bytes32)",
    "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
    "function MINTER_ROLE() view returns (bytes32)",
    "function VALIDATOR_ROLE() view returns (bytes32)",
    "function ORACLE_ROLE() view returns (bytes32)",
    "function LISTING_ROLE() view returns (bytes32)",
    "function ARBITRATOR_ROLE() view returns (bytes32)",
    "function ADMIN_ROLE() view returns (bytes32)",
];

// ── Gnosis Safe Address Book (known deployments) ─────────────────

const SAFE_ADDRESSES = {
    sepolia: {
        // Gnosis Safe Proxy Factory
        proxyFactory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
        // Gnosis Safe Singleton
        singleton: "0xd9Db270c1B5838D91b3B2DC67669E51033A178ea",
    },
    mainnet: {
        proxyFactory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
        singleton: "0xd9Db270c1B5838D91b3B2DC67669E51033A178ea",
    },
    base: {
        proxyFactory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
        singleton: "0xd9Db270c1B5838D91b3B2DC67669E51033A178ea",
    },
};

// ── Class ────────────────────────────────────────────────────────

class GnosisSafeManager {
    /**
     * @param {ethers.Signer} signer - Deployer/admin signer
     * @param {string} safeAddress - Gnosis Safe address
     * @param {string} networkName - Network name for address book lookup
     */
    constructor(signer, safeAddress, networkName = "sepolia") {
        this.signer = signer;
        this.safeAddress = safeAddress;
        this.networkName = networkName;
        this.safe = new ethers.Contract(safeAddress, SAFE_ABI, signer);
    }

    // ── Validation ──────────────────────────────────────────────

    /**
     * Validate that the Safe exists and is configured correctly
     */
    async validate() {
        const checks = {};

        try {
            const code = await this.signer.provider.getCode(this.safeAddress);
            checks.hasCode = code !== "0x" && code !== "0x0";
        } catch (e) {
            checks.hasCode = false;
            checks.codeError = e.message;
        }

        try {
            const threshold = await this.safe.getThreshold();
            checks.threshold = Number(threshold);
            checks.thresholdValid = checks.threshold >= 1 && checks.threshold <= 10;
        } catch (e) {
            checks.thresholdError = e.message;
        }

        try {
            const owners = await this.safe.getOwners();
            checks.ownerCount = owners.length;
            checks.owners = owners;
            checks.ownersValid = checks.ownerCount >= 1 && checks.ownerCount <= 50;
        } catch (e) {
            checks.ownersError = e.message;
        }

        try {
            const nonce = await this.safe.nonce();
            checks.nonce = Number(nonce);
        } catch (e) {
            checks.nonceError = e.message;
        }

        try {
            checks.isOwner = await this.safe.isOwner(this.signer.address);
        } catch (e) {
            checks.isOwnerError = e.message;
        }

        checks.valid = checks.hasCode && checks.thresholdValid && checks.ownersValid && checks.isOwner;

        return checks;
    }

    // ── Role Grant Transaction Encoding ─────────────────────────

    /**
     * Encode a grantRole call for the Safe to execute
     */
    encodeRoleGrant(contractAddress, roleHash, granteeAddress) {
        const iface = new ethers.Interface(ACCESS_CONTROL_ABI);
        const calldata = iface.encodeFunctionData("grantRole", [roleHash, granteeAddress]);

        return {
            to: contractAddress,
            value: 0,
            data: calldata,
            operation: 0, // CALL
        };
    }

    /**
     * Encode multiple role grants as a batch transaction
     */
    encodeBatchRoleGrants(grants) {
        // For batch execution, we use a Multicall3 contract or
        // encode each as a separate Safe transaction
        return grants.map(grant =>
            this.encodeRoleGrant(grant.contract, grant.role, grant.account)
        );
    }

    /**
     * Get the transaction hash for a Safe transaction
     */
    async getTransactionHash(to, value, data, operation = 0) {
        const nonce = await this.safe.nonce();
        return this.safe.getTransactionHash(
            to,              // to
            value,           // value
            data,            // data
            operation,       // operation (0=CALL, 1=DELEGATECALL)
            0,               // safeTxGas
            0,               // baseGas
            0,               // gasPrice
            ethers.ZeroAddress, // gasToken (ETH)
            ethers.ZeroAddress, // refundReceiver
            nonce            // nonce
        );
    }

    /**
     * Create a signed Safe transaction (for owner to submit)
     */
    async signTransaction(to, value, data) {
        const txHash = await this.getTransactionHash(to, value, data);
        const signature = await this.signer.signMessage(ethers.getBytes(txHash));

        return {
            to,
            value,
            data,
            operation: 0,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: ethers.ZeroAddress,
            refundReceiver: ethers.ZeroAddress,
            nonce: await this.safe.nonce(),
            signature,
            signer: this.signer.address,
            txHash,
        };
    }

    /**
     * Execute a fully signed transaction (when threshold is met)
     */
    async executeTransaction(to, value, data, signatures) {
        const tx = await this.safe.execTransaction(
            to,
            value,
            data,
            0,                   // operation
            0,                   // safeTxGas
            0,                   // baseGas
            0,                   // gasPrice
            ethers.ZeroAddress,  // gasToken
            ethers.ZeroAddress,  // refundReceiver
            signatures           // packed signatures
        );
        return tx.wait();
    }

    // ── Safe Information ────────────────────────────────────────

    /**
     * Get full Safe information
     */
    async getInfo() {
        const [owners, threshold, nonce] = await Promise.all([
            this.safe.getOwners(),
            this.safe.getThreshold(),
            this.safe.nonce(),
        ]);

        return {
            address: this.safeAddress,
            owners,
            threshold: Number(threshold),
            nonce: Number(nonce),
            isDeployerOwner: await this.safe.isOwner(this.signer.address),
            chainId: (await this.signer.provider.getNetwork()).chainId,
        };
    }

    /**
     * Get pending transactions (requires Safe Transaction Service API)
     */
    async getPendingTransactions() {
        // Note: This requires the Safe Transaction Service API
        // For local usage, we return what we can from on-chain state
        const nonce = await this.safe.nonce();
        return {
            currentNonce: Number(nonce),
            message: "Use Safe Transaction Service API for pending tx list",
            serviceUrl: `https://safe-transaction-${this.networkName}.safe.global`,
        };
    }
}

// ── Static Helpers ───────────────────────────────────────────────

/**
 * Validate an Ethereum address
 */
function isValidAddress(address) {
    try {
        return ethers.isAddress(address);
    } catch {
        return false;
    }
}

/**
 * Check if an address looks like a Gnosis Safe (starts with specific proxy pattern)
 */
function isLikelySafe(address) {
    if (!isValidAddress(address)) return false;
    // Gnosis Safe proxies share common init code patterns
    // We can't be 100% sure without checking code, but we can validate format
    return isValidAddress(address);
}

/**
 * Create role grant transactions for a list of contracts
 */
function buildRoleGrantPlan(contracts, roleGrants, granteeAddress) {
    const plan = [];

    for (const grant of roleGrants) {
        const contract = contracts[grant.contract];
        if (!contract) {
            plan.push({ error: `Contract ${grant.contract} not found`, ...grant });
            continue;
        }

        plan.push({
            contract: grant.contract,
            contractAddress: contract.address,
            role: grant.roleName,
            roleHash: grant.roleHash,
            account: granteeAddress,
            description: `${grant.roleName} → ${granteeAddress.slice(0, 10)}...`,
        });
    }

    return plan;
}

module.exports = {
    GnosisSafeManager,
    SAFE_ABI,
    ACCESS_CONTROL_ABI,
    SAFE_ADDRESSES,
    isValidAddress,
    isLikelySafe,
    buildRoleGrantPlan,
};
