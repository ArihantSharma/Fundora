require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    // Default in-process network used by `npx hardhat test`
    hardhat: {},

    // Long-running node.
    // Inside Docker the URL is http://hardhat:8545 (service name).
    // On the host machine it is http://127.0.0.1:8545.
    // HARDHAT_RPC_URL is injected by the deploy container's environment.
    localhost: {
      url: process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545",
    },
  },
};
