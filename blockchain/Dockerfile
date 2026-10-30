FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy everything needed: contracts, config, scripts, tests, entrypoints
COPY contracts/        contracts/
COPY hardhat.config.js .
COPY scripts/          scripts/
COPY test/             test/
COPY start-node.sh     start-node.sh
COPY deploy.sh         deploy.sh
RUN chmod +x start-node.sh deploy.sh

# Compile contracts during image build so the artifact is ready.
RUN npx hardhat compile

EXPOSE 8545
