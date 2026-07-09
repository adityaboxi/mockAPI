#!/bin/bash
set -e

# If no flags are set, do nothing
if [ -z "$DEPLOY_SERVER" ] && [ -z "$DEPLOY_MOCK" ] && [ -z "$DEPLOY_CLIENT" ]; then
  echo "No deployment flags set – skipping."
  exit 0
fi

# Create networks if they don't exist (idempotent)
docker network create orch-net 2>/dev/null || true
docker network create shared-net 2>/dev/null || true

# ---- 1. SERVER (deploys first; forces mock‑server) ----
if [ "$DEPLOY_SERVER" = "true" ]; then
  echo "🚀 Deploying server..."
  (
    cd server
    docker-compose down
    docker rmi mockapi-server:latest 2>/dev/null || true
    docker-compose up -d --build
  )
  # Server change always rebuilds mock‑server (as per requirement)
  DEPLOY_MOCK=true
fi

# ---- 2. MOCK‑SERVER (deploys second) ----
if [ "$DEPLOY_MOCK" = "true" ]; then
  echo "🚀 Deploying mock-server..."
  (
    cd mock-server
    docker-compose down
    docker rmi mockapi-mock-server:latest 2>/dev/null || true
    docker-compose --profile build-only up -d --build
  )
fi

# ---- 3. CLIENT (deploys last) ----
if [ "$DEPLOY_CLIENT" = "true" ]; then
  echo "🚀 Deploying client..."
  (
    cd client
    docker-compose down
    docker rmi mockapi-react:latest 2>/dev/null || true
    docker-compose up -d --build
  )
fi

echo "✅ Deployment complete for selected services."