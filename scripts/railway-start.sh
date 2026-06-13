#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo ""
  echo "ERROR: DATABASE_URL is not set."
  echo ""
  echo "Render fix:"
  echo "  1. Dashboard → infinity-operaciones → Environment"
  echo "  2. Add DATABASE_URL linked to infinity-db (Internal URL)"
  echo "  3. Manual Deploy → Clear build cache & deploy"
  echo ""
  exit 1
fi

export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3000}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=384}"

echo "[startup] Running database migrations..."
npx prisma migrate deploy

echo "[startup] Seed en segundo plano (no bloquea)..."
(node scripts/ensure-seed.cjs || true) &

echo "[startup] Next.js en ${HOSTNAME}:${PORT}..."
exec ./node_modules/.bin/next start -H "$HOSTNAME" -p "$PORT"
