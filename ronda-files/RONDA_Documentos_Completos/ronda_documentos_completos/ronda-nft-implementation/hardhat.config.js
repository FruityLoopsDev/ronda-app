/**
 * Hardhat Configuration para RONDA NFT Contracts
 * Soporta: Mumbai testnet, Polygon mainnet
 */

require('dotenv').config({ path: '.env.local' });
require('@nomicfoundation/hardhat-toolbox');
require('@nomiclabs/hardhat-etherscan');
require('hardhat-gas-reporter');

const MUMBAI_RPC = process.env.POLYGON_MUMBAI_RPC || 'https://rpc-mumbai.maticvigil.com';
const MAINNET_RPC = process.env.POLYGON_MAINNET_RPC || 'https://polygon-rpc.com';
const PRIVATE_KEY = process.env.RONDA_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    hardhat: {
      chainId: 1337,
    },

    mumbai: {
      url: MUMBAI_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 80001,
      gasPrice: 'auto',
    },

    polygon: {
      url: MAINNET_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 137,
      gasPrice: 'auto',
    },

    localhost: {
      url: 'http://127.0.0.1:8545',
    },
  },

  etherscan: {
    apiKey: {
      polygon: ETHERSCAN_API_KEY,
      polygonMumbai: ETHERSCAN_API_KEY,
    },
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'COP',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    outputFile: 'gas-report.txt',
    noColors: false,
  },

  paths: {
    sources: './contracts',
    tests: './test',
    cache: './hardhat_cache',
    artifacts: './artifacts',
  },

  mocha: {
    timeout: 40000,
  },
};
