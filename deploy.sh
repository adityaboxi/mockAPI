#!/bin/bash
set -e
set -o pipefail

# ─── 0. PRIVILEGE & COMPOSE DETECTION ─────────────────────────────
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  fi
fi

# Detect Docker Compose CLI (prefer Compose V2 plugin, fallback to standalone V1)
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "❌ Error: Neither 'docker compose' nor 'docker-compose' was found on this system."
  exit 1
fi

echo "🐳 Using Compose engine: $COMPOSE"

# ─── Check deployment flags ───────────────────────────────────────
if [ -z "$DEPLOY_SERVER" ] && [ -z "$DEPLOY_MOCK" ] && [ -z "$DEPLOY_CLIENT" ] && [ -z "$DEPLOY_DOMAIN" ] && [ -z "$DEPLOY_TELEMETRY" ]; then
  echo "⚠️ No deployment flags set - skipping deployment."
  exit 0
fi

# ─── Ensure shared Docker networks exist ──────────────────────────
docker network create orch-net 2>/dev/null || true
docker network create shared-net 2>/dev/null || true

# ─── 1. SET UP HEALTH MONITOR (Idempotent 1-Min Cron Job) ─────────
setup_health_monitor() {
  echo "⏳ Ensuring host health monitor cron is active..."
  SCRIPT_PATH="/usr/local/bin/health-monitor.sh"
  CRON_JOB="* * * * * $SCRIPT_PATH"

  $SUDO tee "$SCRIPT_PATH" > /dev/null <<'EOF'
#!/bin/bash
# /usr/local/bin/health-monitor.sh
declare -A HEALTH_URLS=(
  ["telemetry-server"]="http://localhost:3003/health"
  ["mockapi-nginx"]="http://localhost:8081"
  ["openresty"]="http://localhost:8080"
  ["mockapi-client"]="http://localhost:8082"
)

for container in "${!HEALTH_URLS[@]}"; do
  url="${HEALTH_URLS[$container]}"
  if ! curl -s -f --max-time 5 "$url" > /dev/null 2>&1; then
    echo "$(date) ⚠️ $container is unhealthy – auto-restarting..." >> /var/log/health-monitor.log
    docker restart "$container" 2>/dev/null || true
  fi
done

if docker ps --format '{{.Names}}' | grep -q "^domain-proxy$"; then
  if ! docker exec domain-proxy nginx -t 2>/dev/null; then
    docker restart domain-proxy 2>/dev/null || true
  fi
fi
EOF

  $SUDO chmod +x "$SCRIPT_PATH"

  if ! $SUDO crontab -l 2>/dev/null | grep -q "$SCRIPT_PATH"; then
    ($SUDO crontab -l 2>/dev/null; echo "$CRON_JOB") | $SUDO crontab -
  fi
}

setup_health_monitor

# ─── Helper: retry a command ──────────────────────────────────────
retry() {
  local n=0
  local max=3
  while [ $n -lt $max ]; do
    if "$@"; then
      return 0
    fi
    n=$((n+1))
    echo "⚠️ Command failed (attempt $n/$max). Retrying in 3s..."
    sleep 3
  done
  return 1
}

# ─── Helper: wait for health ──────────────────────────────────────
wait_for_health() {
  local container_name=$1
  local health_url=$2
  local max_attempts=15
  local attempt=0

  echo "🔍 Verifying health for $container_name ($health_url)..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -s -f --max-time 5 "$health_url" > /dev/null 2>&1; then
      echo "✅ $container_name is healthy!"
      return 0
    fi
    attempt=$((attempt+1))
    echo "⏳ $container_name initializing (attempt $attempt/$max_attempts) – waiting 3s..."
    sleep 3
  done

  echo "❌ $container_name failed health check."
  docker logs "$container_name" --tail 30 2>&1 || true
  return 1
}

# ─── PHASE 1: TARGETED IMAGE BUILDS ───────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "🛠️  PHASE 1: Building changed services..."
echo "═══════════════════════════════════════════════════════════"

if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "📦 Building domainservice..."
  (cd domainservice && docker build -t domainservice:latest .)
fi

if [ "$DEPLOY_SERVER" = "true" ]; then
  echo "📦 Building server stack..."
  (cd server && $COMPOSE build)
fi

if [ "$DEPLOY_MOCK" = "true" ]; then
  echo "📦 Building mock-server stack & template..."
  (cd mock-server && $COMPOSE --profile build-only build)
fi

if [ "$DEPLOY_CLIENT" = "true" ]; then
  echo "📦 Building client stack..."
  set -a
  [ -f client/.env ] && source client/.env 2>/dev/null || true
  set +a
  (cd client && $COMPOSE build)
fi

if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  echo "📦 Building telemetry stack..."
  set -a
  [ -f telemetry-server/.env ] && source telemetry-server/.env 2>/dev/null || true
  set +a
  (cd telemetry-server && $COMPOSE build)
fi

echo "✅ Target images built successfully."

# ─── PHASE 2: IN-PLACE ZERO-DOWNTIME RECREATION ───────────────────
echo "═══════════════════════════════════════════════════════════"
echo "🚀 PHASE 2: Rolling Container Updates..."
echo "═══════════════════════════════════════════════════════════"

if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "🔄 Updating domain-proxy..."
  docker stop domain-proxy 2>/dev/null || true
  docker rm domain-proxy 2>/dev/null || true
  $SUDO mkdir -p /etc/letsencrypt /var/www/certbot
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
fi

if [ "$DEPLOY_SERVER" = "true" ]; then
  echo "🔄 Updating server stack (zero-downtime rolling update)..."
  (cd server && retry $COMPOSE up -d --remove-orphans)
fi

if [ "$DEPLOY_MOCK" = "true" ]; then
  echo "🔄 Updating mock-server stack (zero-downtime rolling update)..."
  (cd mock-server && retry $COMPOSE up -d --remove-orphans)
fi

if [ "$DEPLOY_CLIENT" = "true" ]; then
  echo "🔄 Updating client stack (zero-downtime rolling update)..."
  (cd client && retry $COMPOSE up -d --remove-orphans)
fi

if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  echo "🔄 Updating telemetry stack (zero-downtime rolling update)..."
  (cd telemetry-server && retry $COMPOSE up -d --remove-orphans)
fi

# ─── PHASE 3: TARGETED HEALTH CHECKS ──────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "🔍 PHASE 3: Sequential Health Checks..."
echo "═══════════════════════════════════════════════════════════"

if [ "$DEPLOY_DOMAIN" = "true" ]; then
  for i in {1..10}; do
    if docker exec domain-proxy nginx -t 2>/dev/null; then break; fi
    sleep 2
    if [ $i -eq 10 ]; then exit 1; fi
  done
fi

if [ "$DEPLOY_SERVER" = "true" ]; then
  wait_for_health "mockapi-nginx" "http://localhost:8081" || exit 1
fi

if [ "$DEPLOY_MOCK" = "true" ]; then
  wait_for_health "openresty" "http://localhost:8080" || exit 1
fi

if [ "$DEPLOY_CLIENT" = "true" ]; then
  wait_for_health "mockapi-client" "http://localhost:8082" || exit 1
fi

if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  wait_for_health "telemetry-server" "http://localhost:3003/health" || exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "✅ All updated services are healthy."
echo "✅ Deployment completed successfully!"
exit 0