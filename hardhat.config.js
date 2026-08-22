require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
    solidity: {
        version: "0.8.20",
        settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
    },
    networks: {
        hardhat: { chainId: 31337 },
        localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
        arbitrumSepolia: {
            url: process.env.ARBITRUM_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 421614,
        },
        baseSepolia: {
            url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 84532,
        },
        base: {
            url: process.env.BASE_RPC || "https://mainnet.base.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 8453,
        },
    },
    etherscan: {
        apiKey: {
            arbitrumSepolia: process.env.ARBISCAN_API_KEY,
            baseSepolia: process.env.BASESCAN_API_KEY,
            base: process.env.BASESCAN_API_KEY,
        },
    },
    paths: { sources: "./contracts/solidity", tests: "./test", cache: "./cache", artifacts: "./artifacts", deployments: "./deployments" },
};
