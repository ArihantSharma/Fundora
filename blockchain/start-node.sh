#!/bin/sh
# Start the Hardhat local node, binding to all interfaces so other
# containers and the host machine can connect.
exec npx hardhat node --hostname 0.0.0.0
