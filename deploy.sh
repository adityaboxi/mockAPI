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
  echo "⚠️ No deployment flags set (DEPLOY_SERVER, DEPLOY_MOCK, DEPLOY_CLIENT, DEPLOY_DOMAIN, DEPLOY_TELEMETRY) - skipping."
  exit 0
fi

# ─── Create shared Docker networks ────────────────────────────────
docker network create orch-net 2>/dev/null || true
docker network create shared-net 2>/dev/null || true

# ─── 1. SET UP HEALTH MONITOR (Idempotent Cron Job) ──────────────
setup_health_monitor() {
  echo "⏳ Setting up host health monitor (cron job)..."
  SCRIPT_PATH="/usr/local/bin/health-monitor.sh"
  CRON_JOB="* * * * * $SCRIPT_PATH"

  $SUDO tee "$SCRIPT_PATH" > /dev/null <<'EOF'
#!/bin/bash
# /usr/local/bin/health-monitor.sh
# Runs every minute via cron to check and restart unhealthy containers.

declare -A HEALTH_URLS=(
  ["telemetry-server"]="http://localhost:3003/health"
  ["mockapi-nginx"]="http://localhost:8081"
  ["openresty"]="http://localhost:8080"
  ["mockapi-client"]="http://localhost:8082"
)

for container in "${!HEALTH_URLS[@]}"; do
  url="${HEALTH_URLS[$container]}"
  if ! curl -s -f --max-time 5 "$url" > /dev/null 2>&1; then
    echo "$(date) ⚠️ $container is unhealthy – restarting..." >> /var/log/health-monitor.log
    docker restart "$container" 2>/dev/null || true
    sleep 5
    if curl -s -f --max-time 5 "$url" > /dev/null 2>&1; then
      echo "$(date) ✅ $container recovered after restart." >> /var/log/health-monitor.log
    else
      echo "$(date) ❌ $container still unhealthy – manual intervention may be needed." >> /var/log/health-monitor.log
    fi
  fi
done

# Check domain service separately (nginx config test)
if docker ps --format '{{.Names}}' | grep -q "^domain-proxy$"; then
  if ! docker exec domain-proxy nginx -t 2>/dev/null; then
    echo "$(date) ⚠️ domain-proxy config invalid – restarting..." >> /var/log/health-monitor.log
    docker restart domain-proxy 2>/dev/null || true
  fi
fi
EOF

  $SUDO chmod +x "$SCRIPT_PATH"

  if ! $SUDO crontab -l 2>/dev/null | grep -q "$SCRIPT_PATH"; then
    ($SUDO crontab -l 2>/dev/null; echo "$CRON_JOB") | $SUDO crontab -
    echo "✅ Cron job registered."
  else
    echo "✅ Cron job already active."
  fi

  echo "✅ Health monitor configured."
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
    echo "⚠️ Command failed (attempt $n/$max). Retrying in 5s..."
    sleep 5
  done
  return 1
}

# ─── Helper: wait for a service to become healthy (fatal) ──────────
wait_for_health() {
  local container_name=$1
  local health_url=$2
  local max_attempts=18          # 18 * 10s = 3 minutes total
  local attempt=0

  echo "🔍 Waiting for $container_name to become healthy ($health_url)..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -s -f --max-time 5 "$health_url" > /dev/null 2>&1; then
      echo "✅ $container_name is healthy"
      return 0
    fi
    attempt=$((attempt+1))
    echo "⏳ $container_name not ready (attempt $attempt/$max_attempts) – waiting 10s..."
    sleep 10
  done

  # ── Health check failed – print diagnostics ────────────────────
  echo "❌ $container_name failed to become healthy after $max_attempts attempts."
  echo "🔍 Last 50 log lines from $container_name:"
  docker logs "$container_name" --tail 50 2>&1 || echo "⚠️ Could not fetch logs."
  echo "🔍 Current container status and port mappings:"
  docker ps --filter "name=$container_name" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  return 1
}

# ─── PHASE 1: BUILD ALL IMAGES ──────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "🛠️  PHASE 1: Building all images..."
echo "═══════════════════════════════════════════════════════════"

# Domain service (uses plain Dockerfile)
if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "📦 Building domainservice..."
  (cd domainservice && docker build -t domainservice:latest .)
fi

# Server stack
if [ "$DEPLOY_SERVER" = "true" ]; then
  echo "📦 Building server stack (via $COMPOSE build)..."
  (cd server && $COMPOSE build)
fi

# Mock-server stack (including project-container:latest)
if [ "$DEPLOY_MOCK" = "true" ]; then
  echo "📦 Building mock-server stack & project-container template..."
  (cd mock-server && $COMPOSE --profile build-only build)
fi

# Client stack (inject build args from client/.env)
if [ "$DEPLOY_CLIENT" = "true" ]; then
  echo "📦 Building client stack (via $COMPOSE build)..."
  set -a
  [ -f client/.env ] && source client/.env 2>/dev/null || true
  set +a
  (cd client && $COMPOSE build)
fi

# Telemetry stack (inject build args from telemetry-server/.env)
if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  echo "📦 Building telemetry stack (via $COMPOSE build)..."
  set -a
  [ -f telemetry-server/.env ] && source telemetry-server/.env 2>/dev/null || true
  set +a
  (cd telemetry-server && $COMPOSE build)
fi

echo "✅ All required images built successfully."

# ─── PHASE 2: START CONTAINERS ──────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "🚀 PHASE 2: Starting containers..."
echo "═══════════════════════════════════════════════════════════"

# Domain service (standalone container)
if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "🔄 Starting domain-proxy..."
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
  echo "✅ domain-proxy started."
fi

# Server stack
if [ "$DEPLOY_SERVER" = "true" ]; then
  echo "🔄 Starting server stack..."
  (cd server && $COMPOSE down && retry $COMPOSE up -d)
  echo "✅ server stack started."
fi

# Mock-server stack
if [ "$DEPLOY_MOCK" = "true" ]; then
  echo "🔄 Starting mock-server stack..."
  (cd mock-server && $COMPOSE down && retry $COMPOSE up -d)
  echo "✅ mock-server stack started."
fi

# Client stack
if [ "$DEPLOY_CLIENT" = "true" ]; then
  echo "🔄 Starting client stack..."
  (cd client && $COMPOSE down && retry $COMPOSE up -d)
  echo "✅ client stack started."
fi

# Telemetry stack
if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  echo "🔄 Starting telemetry stack..."
  (cd telemetry-server && $COMPOSE down && retry $COMPOSE up -d)
  echo "✅ telemetry stack started."
fi

# ─── PHASE 3: HEALTH CHECKS (Fatal on failure) ───────────────────
echo "═══════════════════════════════════════════════════════════"
echo "🔍 PHASE 3: Health checks (sequential) - failing fast..."
echo "═══════════════════════════════════════════════════════════"

# Domain check
if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "🔍 Checking domain-proxy nginx configuration..."
  for i in {1..10}; do
    if docker exec domain-proxy nginx -t 2>/dev/null; then
      echo "✅ domain-proxy nginx config is valid"
      break
    fi
    sleep 2
    if [ $i -eq 10 ]; then
      echo "❌ domain-proxy nginx config invalid after 10 attempts."
      exit 1
    fi
  done
fi

# Server check
if [ "$DEPLOY_SERVER" = "true" ]; then
  wait_for_health "mockapi-nginx" "http://localhost:8081" || exit 1
fi

# Mock-server check
if [ "$DEPLOY_MOCK" = "true" ]; then
  wait_for_health "openresty" "http://localhost:8080" || exit 1
fi

# Client check
if [ "$DEPLOY_CLIENT" = "true" ]; then
  wait_for_health "mockapi-client" "http://localhost:8082" || exit 1
fi

# Telemetry check
if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  wait_for_health "telemetry-server" "http://localhost:3003/health" || exit 1
  wait_for_health "telemetry-client" "http://localhost:8083" || exit 1
fi

# ─── COOLDOWN ────────────────────────────────────────────────────
echo "⏳ All services healthy. Cooling down 15 seconds before finalizing..."
sleep 15

echo "═══════════════════════════════════════════════════════════"
echo "✅ All deployed services are healthy."
echo "✅ Deployment completed successfully."
exit 0


