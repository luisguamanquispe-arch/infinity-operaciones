#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo ""
  echo "ERROR: DATABASE_URL is not set."
  echo ""
  echo "Render fix:"
  echo "  1. Dashboard → infinity-operaciones → Environment"
  echo "  2. Confirm DATABASE_URL is linked to infinity-db"
  echo "  3. Manual Deploy → Clear build cache & deploy"
  echo ""
  exit 1
fi

export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3000}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=384}"

echo "Running database migrations..."
npx prisma migrate deploy

echo "Ensuring initial users exist..."
node scripts/ensure-seed.cjs || echo "[Seed] Omitido o falló — la app arrancará igual."

if [ -f scripts/prepare-standalone.sh ]; then
  sh scripts/prepare-standalone.sh
fi

echo "Starting application on ${HOSTNAME}:${PORT}..."

if [ -f .next/standalone/server.js ]; then
  cd .next/standalone
  exec node server.js
elif [ -f server.js ]; then
  exec node server.js
fi

exec npx next start -H "$HOSTNAME" -p "$PORT"
