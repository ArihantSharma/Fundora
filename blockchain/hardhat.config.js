require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    // Default in-process network used by `npx hardhat test`
    hardhat: {},
    // Long-running local node started with `npx hardhat node`
    // MetaMask connects here: http://127.0.0.1:8545  Chain ID: 31337
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};
