#!/bin/bash
set -e

# Create networks if they don't exist
docker network create orch-net 2>/dev/null || true
docker network create shared-net 2>/dev/null || true

echo "Starting server (with redis-external)..."
(
  cd server && docker-compose up -d --build
)

echo "Starting mock-server..."
(
  cd mock-server && docker-compose --profile build-only up -d --build
)

echo "Starting client..."
(
  cd client && docker-compose up -d --build
)

echo "✅ All services are up!"