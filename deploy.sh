#!/bin/bash
set -e

# Default: deploy nothing (we'll set flags from workflow)
if [ -z "$DEPLOY_SERVER" ] && [ -z "$DEPLOY_MOCK" ] && [ -z "$DEPLOY_CLIENT" ]; then
  echo "No deployment flags set – skipping."
  exit 0
fi

docker network create orch-net 2>/dev/null || true
docker network create shared-net 2>/dev/null || true

# ---- SERVER (must come before mock-server) ----
if [ "$DEPLOY_SERVER" = "true" ]; then
  echo "🚀 Deploying server..."
  (
    cd server
    docker-compose down
    docker rmi mockapi-server:latest 2>/dev/null || true
    docker-compose up -d --build
  )
  # Server deployment forces mock-server rebuild
  DEPLOY_MOCK=true
fi

# ---- MOCK-SERVER ----
if [ "$DEPLOY_MOCK" = "true" ]; then
  echo "🚀 Deploying mock-server..."
  (
    cd mock-server
    docker-compose down
    docker rmi mockapi-mock-server:latest 2>/dev/null || true
    docker-compose --profile build-only up -d --build
  )
fi

# ---- CLIENT ----
if [ "$DEPLOY_CLIENT" = "true" ]; then
  echo "🚀 Deploying client..."
  (
    cd client
    docker-compose down
    docker rmi mockapi-react:latest 2>/dev/null || true
    docker-compose up -d --build
  )
fi

echo "✅ Deployment complete for changed services."