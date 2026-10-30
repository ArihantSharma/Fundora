FROM node:20-slim

WORKDIR /app

# Install dependencies (cache this layer)
COPY package.json package-lock.json ./
RUN npm install

# Copy source files
COPY . .

# The entrypoint script reads /shared/deployment.json (written by the
# hardhat-deploy service) and injects the contract address into .env
# before starting the Vite dev server.
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 5173

ENTRYPOINT ["/docker-entrypoint.sh"]
