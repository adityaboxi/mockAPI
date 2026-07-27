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

# ─── 0. SET UP HEALTH MONITOR (idempotent) ─────────────────────
setup_health_monitor() {
  echo "⏳ Setting up health monitor (cron job)..."
  SCRIPT_PATH="/usr/local/bin/health-monitor.sh"
  CRON_JOB="* * * * * $SCRIPT_PATH"

  sudo tee $SCRIPT_PATH > /dev/null <<'EOF'
#!/bin/bash
# /usr/local/bin/health-monitor.sh
# Runs every minute via cron to check and restart unhealthy containers.

declare -A HEALTH_URLS=(
  ["telemetry-server"]="http://localhost:3003/health"
  ["mockapi-app"]="http://localhost:8081"
  ["mock-server"]="http://localhost:8080"
  ["client"]="http://localhost:8082/home"
)

for container in "${!HEALTH_URLS[@]}"; do
  url=${HEALTH_URLS[$container]}
  if ! curl -s -f "$url" > /dev/null; then
    echo "$(date) ⚠️ $container is unhealthy – restarting..." >> /var/log/health-monitor.log
    docker restart "$container" 2>/dev/null || true
    sleep 5
    if curl -s -f "$url" > /dev/null; then
      echo "$(date) ✅ $container recovered after restart." >> /var/log/health-monitor.log
    else
      echo "$(date) ❌ $container still unhealthy – manual intervention may be needed." >> /var/log/health-monitor.log
    fi
  fi
done

# Check domain service separately (nginx config test)
if ! docker exec domain-proxy nginx -t 2>/dev/null; then
  echo "$(date) ⚠️ domain-proxy config invalid – restarting..." >> /var/log/health-monitor.log
  docker restart domain-proxy
fi
EOF

  sudo chmod +x $SCRIPT_PATH

  if ! sudo crontab -l 2>/dev/null | grep -q "$SCRIPT_PATH"; then
    (sudo crontab -l 2>/dev/null; echo "$CRON_JOB") | sudo crontab -
    echo "✅ Cron job added."
  else
    echo "✅ Cron job already exists."
  fi

  echo "✅ Health monitor set up."
}

setup_health_monitor

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

# ─── Helper: wait for a service to become healthy (fatal) ──────
wait_for_health() {
  local container_name=$1
  local health_url=$2
  local max_attempts=18          # 18 * 10s = 3 minutes total
  local attempt=0

  echo "🔍 Waiting for $container_name to become healthy..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -s -f "$health_url" > /dev/null; then
      echo "✅ $container_name is healthy"
      return 0
    fi
    attempt=$((attempt+1))
    echo "⏳ $container_name not ready (attempt $attempt/$max_attempts) – waiting 10s..."
    sleep 10
  done

  # ── Health check failed – print diagnostics ──────────────────
  echo "❌ $container_name failed to become healthy after $max_attempts attempts."
  echo "🔍 Last 50 log lines from $container_name:"
  docker logs "$container_name" --tail 50 2>&1 || echo "⚠️ Could not fetch logs."
  echo "🔍 Current container status and port mappings:"
  docker ps --filter "name=$container_name" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  return 1
}

# ─── PHASE 1: BUILD ALL IMAGES ──────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "🛠️  PHASE 1: Building all images..."
echo "═══════════════════════════════════════════════════════════"

# Domain service (uses plain Dockerfile)
if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "📦 Building domainservice..."
  (cd domainservice && docker build -t domainservice:latest .)
fi

# Services that use docker-compose – build via compose
if [ "$DEPLOY_SERVER" = "true" ]; then
  echo "📦 Building server (via docker-compose build)..."
  (cd server && docker-compose build)
fi

if [ "$DEPLOY_MOCK" = "true" ]; then
  echo "📦 Building mock-server (via docker-compose build)..."
  (cd mock-server && docker-compose build)
fi

if [ "$DEPLOY_CLIENT" = "true" ]; then
  echo "📦 Building client (via docker-compose build)..."
  (cd client && docker-compose build)
fi

if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  echo "📦 Building telemetry-server (via docker-compose build)..."
  # ─── Source .env so client build args (VITE_*) are available ──
  set -a
  source telemetry-server/.env
  set +a
  (cd telemetry-server && docker-compose build)
fi

echo "✅ All images built successfully."

# ─── PHASE 2: START CONTAINERS ──────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "🚀 PHASE 2: Starting containers..."
echo "═══════════════════════════════════════════════════════════"

# Domain service (special – not using docker-compose)
if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "🔄 Starting domain-proxy..."
  docker stop domain-proxy 2>/dev/null || true
  docker rm domain-proxy 2>/dev/null || true

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

# Services with docker-compose
if [ "$DEPLOY_SERVER" = "true" ]; then
  echo "🔄 Starting server..."
  (cd server && docker-compose down && retry docker-compose up -d)
  echo "✅ server started."
fi

if [ "$DEPLOY_MOCK" = "true" ]; then
  echo "🔄 Starting mock-server..."
  (cd mock-server && docker-compose down && retry docker-compose --profile build-only up -d)
  echo "✅ mock-server started."
fi

if [ "$DEPLOY_CLIENT" = "true" ]; then
  echo "🔄 Starting client..."
  (cd client && docker-compose down && retry docker-compose up -d)
  echo "✅ client started."
fi

if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  echo "🔄 Starting telemetry-server..."
  (cd telemetry-server && docker-compose down && retry docker-compose up -d)
  echo "✅ telemetry-server started."
fi

# ─── PHASE 3: HEALTH CHECKS (fatal if any fails) ─────────────
echo "═══════════════════════════════════════════════════════════"
echo "🔍 PHASE 3: Health checks (sequential) - failing fast..."
echo "═══════════════════════════════════════════════════════════"

# Domain (nginx config test)
if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "🔍 Checking domain-proxy nginx config..."
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

# Server
if [ "$DEPLOY_SERVER" = "true" ]; then
  wait_for_health "mockapi-app" "http://localhost:8081" || exit 1
fi

# Mock-server
if [ "$DEPLOY_MOCK" = "true" ]; then
  wait_for_health "mock-server" "http://localhost:8080" || exit 1
fi

# Client
if [ "$DEPLOY_CLIENT" = "true" ]; then
  wait_for_health "client" "http://localhost:8082/home" || exit 1
fi

# Telemetry
if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  wait_for_health "telemetry-server" "http://localhost:3003/health" || exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "✅ All deployed services are healthy."
echo "✅ Deployment complete."
exit 0


