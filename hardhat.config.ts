import type { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
  },
};

export default config;
