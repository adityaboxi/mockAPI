#!/bin/bash
set -e

# ─── Check flags ──────────────────────────────────────────────────
if [ -z "$DEPLOY_SERVER" ] && [ -z "$DEPLOY_MOCK" ] && [ -z "$DEPLOY_CLIENT" ] && [ -z "$DEPLOY_DOMAIN" ] && [ -z "$DEPLOY_TELEMETRY" ]; then
  echo "No deployment flags set - skipping."
  exit 0
fi

# ─── Create networks ────────────────────────────────────────────
docker network create orch-net 2>/dev/null || true
docker network create shared-net 2>/dev/null || true

# ─── Helper: retry a command ──────────────────────────────────
retry() {
  local n=0
  local max=3
  while [ $n -lt $max ]; do
    if "$@"; then
      return 0
    fi
    n=$((n+1))
    echo "⚠️ Command failed (attempt $n/$max). Retrying in 5s..."
    sleep 5
  done
  return 1
}

# ─── Helper: check and restart unhealthy container ──────────
check_and_restart() {
  local container_name=$1
  local health_url=$2
  local max_attempts=3
  local attempt=0

  echo "🔍 Checking $container_name ..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -s -f "$health_url" > /dev/null; then
      echo "✅ $container_name is healthy"
      return 0
    fi
    attempt=$((attempt+1))
    echo "⏳ $container_name not ready (attempt $attempt/$max_attempts) – waiting 5s..."
    sleep 5
  done

  echo "⚠️ $container_name is unhealthy – restarting..."
  docker restart "$container_name" || true
  sleep 10
  if curl -s -f "$health_url" > /dev/null; then
    echo "✅ $container_name recovered after restart"
    return 0
  else
    echo "❌ $container_name still unhealthy – continuing anyway"
    return 1
  fi
}

# ─── 1. TELEMETRY ─────────────────────────────────────────────
if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  echo "🚀 Deploying telemetry server..."
  (
    cd telemetry-server
    docker-compose down
    docker rmi telemetry-server:latest 2>/dev/null || true
    retry docker-compose up -d --build
  )
  echo "✅ Telemetry deployed."
fi

# ─── 2. SERVER ──────────────────────────────────────────────────
if [ "$DEPLOY_SERVER" = "true" ]; then
  echo "🚀 Deploying server..."
  (
    cd server
    docker-compose down
    docker rmi mockapi-server:latest 2>/dev/null || true
    retry docker-compose up -d --build
  )
  DEPLOY_MOCK=true
  echo "✅ Server deployed. Mock‑server rebuild triggered."
fi

# ─── 3. MOCK‑SERVER ────────────────────────────────────────────
if [ "$DEPLOY_MOCK" = "true" ]; then
  echo "🚀 Deploying mock-server..."
  (
    cd mock-server
    docker-compose down
    docker rmi mockapi-mock-server:latest 2>/dev/null || true
    retry docker-compose --profile build-only up -d --build
  )
  echo "✅ Mock‑server deployed."
fi

# ─── 4. CLIENT ──────────────────────────────────────────────────
if [ "$DEPLOY_CLIENT" = "true" ]; then
  echo "🚀 Deploying client..."
  (
    cd client
    docker-compose down
    docker rmi mockapi-react:latest 2>/dev/null || true
    retry docker-compose up -d --build
  )
  echo "✅ Client deployed."
fi

# ─── 5. DOMAIN SERVICE ─────────────────────────────────────────
if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "🔄 Deploying Domain Service (Nginx reverse proxy)..."

  # ─── Check SSL certificates (corrected) ──────────────────
  # We check for the actual certificate files, not directories.
  CERT_FILES=(
    "/etc/letsencrypt/live/opentelemetry.client.mockapi.info/fullchain.pem"  # covers api, opentelemetry.client, opentelemetry.server
    "/etc/letsencrypt/live/client.mockapi.info/fullchain.pem"
    "/etc/letsencrypt/live/server.mockapi.info/fullchain.pem"
  )
  MISSING_CERTS=false
  for cert in "${CERT_FILES[@]}"; do
    if [ ! -f "$cert" ]; then
      echo "⚠️ Missing certificate: $cert"
      MISSING_CERTS=true
    fi
  done

  if [ "$MISSING_CERTS" = true ]; then
    echo "❌ Some SSL certificates are missing. The container may fail to start."
    echo "   Please obtain certificates for all subdomains before deploying."
  fi

  # Stop and remove old container
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
    -v /var/www/certbot:/var/www/certbot:ro \
    --add-host host.docker.internal:host-gateway \
    --restart unless-stopped \
    domainservice:latest

  cd ..
  echo "✅ Domain Service container started."

  # Validate nginx config
  echo "⏳ Waiting for domain service to become healthy..."
  for i in {1..30}; do
    if docker exec domain-proxy nginx -t 2>/dev/null; then
      echo "✅ Nginx configuration is valid"
      break
    fi
    sleep 1
  done
  if ! docker exec domain-proxy nginx -t 2>/dev/null; then
    echo "⚠️ Nginx configuration test failed – check logs"
    docker logs domain-proxy --tail 20
  fi
fi

# ─── 6. POST‑DEPLOYMENT HEALTH CHECKS ──────────────────────
echo "⏳ Running post‑deployment health checks and auto‑recovery..."

if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  check_and_restart "telemetry-server" "http://localhost:3003/health"
fi

if [ "$DEPLOY_SERVER" = "true" ]; then
  check_and_restart "mockapi-app" "http://localhost:8081/health"
fi

if [ "$DEPLOY_MOCK" = "true" ]; then
  check_and_restart "mock-server" "http://localhost:8080/healthz"
fi

if [ "$DEPLOY_CLIENT" = "true" ]; then
  check_and_restart "client" "http://localhost:8082/"
fi

if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "🔍 Checking domain-proxy..."
  if docker exec domain-proxy nginx -t 2>/dev/null; then
    echo "✅ domain-proxy nginx config is valid"
  else
    echo "⚠️ domain-proxy nginx config invalid – restarting..."
    docker restart domain-proxy
    sleep 5
    if docker exec domain-proxy nginx -t 2>/dev/null; then
      echo "✅ domain-proxy recovered"
    else
      echo "❌ domain-proxy still unhealthy – continuing anyway"
    fi
  fi
fi

echo "✅ Deployment complete for selected services."