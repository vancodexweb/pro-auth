#!/bin/sh
set -eu

# Defense in depth on top of the compose healthcheck gate: refuse to run
# migrations against a database that isn't accepting connections yet.
echo "[entrypoint] waiting for database ${DATABASE_HOST}:${DATABASE_PORT}..."
attempt=0
until node -e "
  const net = require('net');
  const socket = net.createConnection({ host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT) });
  socket.on('connect', () => { socket.end(); process.exit(0); });
  socket.on('error', () => process.exit(1));
"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "[entrypoint] database did not become reachable in time, giving up" >&2
    exit 1
  fi
  sleep 2
done
echo "[entrypoint] database is reachable"

echo "[entrypoint] running database migrations..."
node node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run
echo "[entrypoint] migrations complete"

exec "$@"
