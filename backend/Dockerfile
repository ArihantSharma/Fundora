# Build from the existing backend image (all Python deps already installed).
# We only add the Node.js binary and the pre-installed blockchain helper.
# This avoids all network downloads during the build.
FROM fundora-backend:latest AS existing_backend

# Stage to grab Node binary
FROM node:20-slim AS node_stage

# Final image: start from existing backend, add Node
FROM existing_backend

# Copy just the node binary from the Node stage
COPY --from=node_stage /usr/local/bin/node /usr/local/bin/node

WORKDIR /app

# Copy updated application code
COPY main.py .

# Copy the pre-installed blockchain helper (node_modules already present locally)
COPY blockchain/ blockchain/

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
