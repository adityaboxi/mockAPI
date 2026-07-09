#!/bin/bash
set -e

# Clear Docker build cache (fixes corrupted snapshot errors)
docker builder prune -f

docker network create orch-net 2>/dev/null || true
docker network create shared-net 2>/dev/null || true

echo "Starting server (with redis-external)..."
(
  cd server
  docker-compose down
  docker rmi mockapi-server:latest 2>/dev/null || true
  docker-compose up -d --build
)

echo "Starting mock-server..."
(
  cd mock-server
  docker-compose down
  docker rmi mockapi-mock-server:latest 2>/dev/null || true
  docker-compose --profile build-only up -d --build
)

echo "Starting client..."
(
  cd client
  docker-compose down
  docker rmi mockapi-react:latest 2>/dev/null || true
  docker-compose up -d --build
)

echo "✅ All services are up!"