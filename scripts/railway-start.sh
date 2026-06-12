#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo ""
  echo "ERROR: DATABASE_URL is not set."
  echo ""
  echo "Railway fix:"
  echo "  1. Project → + New → Database → PostgreSQL"
  echo "  2. Open your WEB service (not Postgres) → Variables"
  echo "  3. New Variable → Add Reference → PostgreSQL → DATABASE_URL"
  echo "  4. Redeploy"
  echo ""
  exit 1
fi

echo "Running database migrations..."
npx prisma migrate deploy

echo "Ensuring initial users exist..."
node scripts/ensure-seed.cjs

echo "Starting application..."
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=384}"

if [ -f .next/standalone/server.js ]; then
  cd .next/standalone
  exec node server.js
elif [ -f server.js ]; then
  exec node server.js
else
  exec npm run start
fi
