#!/bin/bash
set -e

# Check if any deployment flag is set (including DOMAIN)
if [ -z "$DEPLOY_SERVER" ] && [ -z "$DEPLOY_MOCK" ] && [ -z "$DEPLOY_CLIENT" ] && [ -z "$DEPLOY_DOMAIN" ]; then
  echo "No deployment flags set - skipping."
  exit 0
fi

# Create networks if   they don't exist (idempotent)
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

# ---- 3. CLIENT (deploys third) ----
if [ "$DEPLOY_CLIENT" = "true" ]; then
  echo "🚀 Deploying client..."
  (
    cd client
    docker-compose down
    docker rmi mockapi-react:latest 2>/dev/null || true
    docker-compose up -d --build
  )
fi

# ---- 4. DOMAIN SERVICE (Standalone Nginx) ----
if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "🔄 Deploying Domain Service (Nginx reverse proxy)..."

  # Check if the domainservice folder exists
  if [ ! -d "domainservice" ]; then
    echo "❌ domainservice folder not found – skipping."
    exit 1
  fi

  # Optional: Check if SSL certificates exist (warn but continue)
  if [ ! -f "/etc/letsencrypt/live/api.mockapi.info/fullchain.pem" ]; then
    echo "⚠️ SSL certificate not found at /etc/letsencrypt/live/api.mockapi.info/fullchain.pem"
    echo "⚠️ The container may fail to start if certificates are missing."
  fi

  # Stop and remove the old container (if it exists)
  docker stop domain-proxy 2>/dev/null || true
  docker rm domain-proxy 2>/dev/null || true

  # Build the new image from the domainservice folder
  cd domainservice
  docker build -t domainservice:latest .

  # Run the new container (ports 80 & 443, mount SSL certs)
  docker run -d \
    --name domain-proxy \
    -p 80:80 \
    -p 443:443 \
    -v /etc/letsencrypt:/etc/letsencrypt:ro \
    --add-host host.docker.internal:host-gateway \
    --restart unless-stopped \
    domainservice:latest

  cd ..  # Go back to root
  echo "✅ Domain Service container started"
fi

echo "✅ Deployment complete for selected services."

