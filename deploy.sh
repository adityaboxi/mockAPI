#!/bin/bash
set -e

# Check if any deployment flag is set
if [ -z "$DEPLOY_SERVER" ] && [ -z "$DEPLOY_MOCK" ] && [ -z "$DEPLOY_CLIENT" ] && [ -z "$DEPLOY_DOMAIN" ] && [ -z "$DEPLOY_TELEMETRY" ]; then
  echo "No deployment flags set - skipping."
  exit 0
fi

# Create networks if they don't exist (idempotent)
docker network create orch-net 2>/dev/null || true
docker network create shared-net 2>/dev/null || true

# ---- 1. TELEMETRY SERVER (deploys first) ----
if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  echo "🚀 Deploying telemetry server..."

  # Ensure .env exists (safety check)
  if [ ! -f "telemetry-server/.env" ]; then
    echo "⚠️ telemetry-server/.env not found – using defaults (may fail)"
  fi

  (
    cd telemetry-server
    docker compose down
    docker rmi telemetry-server:latest 2>/dev/null || true
    docker compose up -d --build
  )

  # Health check for telemetry
  echo "⏳ Waiting for telemetry server to become healthy..."
  for i in {1..30}; do
    if curl -s -f http://localhost:3003/health > /dev/null; then
      echo "✅ Telemetry server is healthy"
      break
    fi
    sleep 1
  done
fi

# ---- 2. SERVER (deploys second; forces mock‑server) ----
if [ "$DEPLOY_SERVER" = "true" ]; then
  echo "🚀 Deploying server..."
  (
    cd server
    docker compose down
    docker rmi mockapi-server:latest 2>/dev/null || true
    docker compose up -d --build
  )
  # Server change always rebuilds mock‑server (as per requirement)
  DEPLOY_MOCK=true
fi

# ---- 3. MOCK‑SERVER (deploys third) ----
if [ "$DEPLOY_MOCK" = "true" ]; then
  echo "🚀 Deploying mock-server..."
  (
    cd mock-server
    docker compose down
    docker rmi mockapi-mock-server:latest 2>/dev/null || true
    docker compose --profile build-only up -d --build
  )
fi

# ---- 4. CLIENT (deploys fourth) ----
if [ "$DEPLOY_CLIENT" = "true" ]; then
  echo "🚀 Deploying client..."
  (
    cd client
    docker compose down
    docker rmi mockapi-react:latest 2>/dev/null || true
    docker compose up -d --build
  )
fi

# ---- 5. DOMAIN SERVICE (Standalone Nginx) ----
if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "🔄 Deploying Domain Service (Nginx reverse proxy)..."

  if [ ! -d "domainservice" ]; then
    echo "❌ domainservice folder not found – skipping."
    exit 1
  fi

  if [ ! -f "/etc/letsencrypt/live/api.mockapi.info/fullchain.pem" ]; then
    echo "⚠️ SSL certificate not found – the container may fail to start."
  fi

  docker stop domain-proxy 2>/dev/null || true
  docker rm domain-proxy 2>/dev/null || true

  cd domainservice
  docker build -t domainservice:latest .

  docker run -d \
    --name domain-proxy \
    --network shared-net \
    -p 80:80 \
    -p 443:443 \
    -v /etc/letsencrypt:/etc/letsencrypt:ro \
    --add-host host.docker.internal:host-gateway \
    --restart unless-stopped \
    domainservice:latest

  cd ..
  echo "✅ Domain Service container started"

  # Reload nginx configuration (if the container is running)
  sleep 2
  if docker exec domain-proxy nginx -t 2>/dev/null; then
    echo "✅ Nginx configuration is valid"
  else
    echo "⚠️ Nginx configuration test failed – check logs"
    docker logs domain-proxy --tail 20
  fi
fi

echo "✅ Deployment complete for selected services."