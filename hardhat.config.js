require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("./tasks/deploy");

module.exports = {
    solidity: {
        version: "0.8.20",
        settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
    },
    networks: {
        hardhat: { chainId: 31337 },
        localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
        sepolia: {
            url: process.env.SEPOLIA_RPC || "https://rpc.sepolia.org",
            accounts: process.env.TESTNET_PRIVATE_KEY ? [process.env.TESTNET_PRIVATE_KEY] : [],
            chainId: 11155111,
            gasPrice: 20000000000, // 20 gwei
            verify: {
                etherscan: {
                    apiUrl: "https://api-sepolia.etherscan.io",
                    apiKey: process.env.ETHERSCAN_API_KEY || "",
                },
            },
        },
        arbitrumSepolia: {
            url: process.env.ARBITRUM_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
            accounts: process.env.TESTNET_PRIVATE_KEY ? [process.env.TESTNET_PRIVATE_KEY] : [],
            chainId: 421614,
        },
        baseSepolia: {
            url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
            accounts: process.env.TESTNET_PRIVATE_KEY ? [process.env.TESTNET_PRIVATE_KEY] : [],
            chainId: 84532,
        },
        base: {
            url: process.env.BASE_RPC || "https://mainnet.base.org",
            accounts: process.env.MAINNET_PRIVATE_KEY ? [process.env.MAINNET_PRIVATE_KEY] : [],
            chainId: 8453,
        },
    },
    etherscan: {
        apiKey: {
            sepolia: process.env.ETHERSCAN_API_KEY || "",
            arbitrumSepolia: process.env.ARBISCAN_API_KEY,
            baseSepolia: process.env.BASESCAN_API_KEY,
            base: process.env.BASESCAN_API_KEY,
        },
    },
    paths: { sources: "./contracts/solidity", tests: "./test", cache: "./cache", artifacts: "./artifacts", deployments: "./deployments" },
};
