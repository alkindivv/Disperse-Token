require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("hardhat-circom");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  networks: {
    // Konfigurasi untuk testnet (contoh: Sepolia)
    sepolia: {
      url: process.env.SEPOLIA_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    // Konfigurasi untuk mainnet
    mainnet: {
      url: process.env.MAINNET_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  circom: {
    inputBasePath: "./circuits",
    ptau: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau",
    circuits: [
      {
        name: "withdraw",
        protocol: "groth16",
        version: 2,
      },
    ],
  },
};
