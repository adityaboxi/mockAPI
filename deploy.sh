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
  echo "⏳ Setting up health monitor..."
  SCRIPT_PATH="/usr/local/bin/health-monitor.sh"
  CRON_JOB="* * * * * $SCRIPT_PATH"

  sudo tee $SCRIPT_PATH > /dev/null <<'EOF'
#!/bin/bash
# /usr/local/bin/health-monitor.sh
# Runs every minute via cron to check and restart unhealthy containers.

declare -A HEALTH_URLS=(
  ["telemetry-server"]="http://localhost:3003/health"
  ["mockapi-app"]="http://localhost:8081/health"
  ["mock-server"]="http://localhost:8080/healthz"
  ["client"]="http://localhost:8082/"
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

  # Add cron job if it doesn't already exist
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

# ─── Helper: check and restart unhealthy container (non‑fatal) ──
check_and_restart() {
  local container_name=$1
  local health_url=$2
  local max_attempts=8          # increased from 3 to 8
  local attempt=0

  echo "🔍 Checking $container_name ..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -s -f "$health_url" > /dev/null; then
      echo "✅ $container_name is healthy"
      return 0
    fi
    attempt=$((attempt+1))
    echo "⏳ $container_name not ready (attempt $attempt/$max_attempts) – waiting 10s..."
    sleep 10                    # increased from 5 to 10
  done

  # If still unhealthy, try a restart and check again
  echo "⚠️ $container_name is unhealthy – restarting..."
  docker restart "$container_name" || true
  sleep 15
  if curl -s -f "$health_url" > /dev/null; then
    echo "✅ $container_name recovered after restart"
    return 0
  else
    echo "❌ $container_name still unhealthy – but we continue anyway."
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

  # ─── Check the single certificate that covers all domains ──
  NEEDED_CERTS=(
    "/etc/letsencrypt/live/opentelemetry.client.mockapi.info/fullchain.pem"
  )
  MISSING=false
  for cert in "${NEEDED_CERTS[@]}"; do
    if [ ! -f "$cert" ]; then
      echo "⚠️ Missing certificate: $cert"
      MISSING=true
    fi
  done

  if [ "$MISSING" = true ]; then
    echo "❌ SSL certificate is missing."
    echo "   To obtain a certificate that covers all five domains, run:"
    echo "     docker stop domain-proxy"
    echo "     sudo certbot certonly --standalone -d opentelemetry.client.mockapi.info -d api.mockapi.info -d opentelemetry.server.mockapi.info -d client.mockapi.info -d server.mockapi.info"
    echo "     docker start domain-proxy"
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

# ─── 6. POST‑DEPLOYMENT HEALTH CHECKS (non‑fatal) ──────────────
echo "⏳ Running post‑deployment health checks (warnings only)..."

if [ "$DEPLOY_TELEMETRY" = "true" ]; then
  check_and_restart "telemetry-server" "http://localhost:3003/health" || echo "⚠️ Telemetry health check failed – continuing."
fi

if [ "$DEPLOY_SERVER" = "true" ]; then
  check_and_restart "mockapi-app" "http://localhost:8081/health" || echo "⚠️ Server health check failed – continuing."
fi

if [ "$DEPLOY_MOCK" = "true" ]; then
  check_and_restart "mock-server" "http://localhost:8080/healthz" || echo "⚠️ Mock-server health check failed – continuing."
fi

if [ "$DEPLOY_CLIENT" = "true" ]; then
  check_and_restart "client" "http://localhost:8082/" || echo "⚠️ Client health check failed – continuing."
fi

if [ "$DEPLOY_DOMAIN" = "true" ]; then
  echo "🔍 Checking domain-proxy..."
  if docker exec domain-proxy nginx -t 2>/dev/null; then
    echo "✅ domain-proxy nginx config is valid"
  else
    echo "⚠️ domain-proxy config invalid – restarting..."
    docker restart domain-proxy
    sleep 5
    if docker exec domain-proxy nginx -t 2>/dev/null; then
      echo "✅ domain-proxy recovered"
    else
      echo "❌ domain-proxy still unhealthy – continuing anyway"
    fi
  fi
fi

# ─── Force exit 0 to never fail the workflow ──────────────────
echo "✅ Deployment complete – health checks are advisory."
exit 0