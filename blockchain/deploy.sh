#!/bin/sh
# Deploy the FundoraFunding contract to the running Hardhat node.
# Waits until the node is responsive before deploying.
#
# Called by the hardhat-deploy service in docker-compose.yml.

set -e

NODE_URL="${HARDHAT_RPC_URL:-http://hardhat:8545}"
SHARED_DIR="${SHARED_DIR:-/shared}"

echo "[deploy] Waiting for Hardhat node at $NODE_URL ..."
WAIT=0
until node -e "
  const http = require('http');
  const url  = new URL('$NODE_URL');
  const req  = http.request(
    { hostname: url.hostname, port: url.port, method: 'POST',
      headers: {'Content-Type':'application/json'} },
    (res) => process.exit(0)
  );
  req.on('error', () => process.exit(1));
  req.write(JSON.stringify({ jsonrpc:'2.0', method:'net_version', params:[], id:1 }));
  req.end();
" 2>/dev/null; do
  sleep 2
  WAIT=$((WAIT + 2))
  if [ $WAIT -ge 120 ]; then
    echo "[deploy] Timed out waiting for Hardhat node." && exit 1
  fi
done

echo "[deploy] Hardhat node is ready. Deploying contract..."
SHARED_DIR="$SHARED_DIR" npx hardhat run scripts/deploy.js --network localhost

echo "[deploy] Deployment complete."
cat "$SHARED_DIR/deployment.json"
