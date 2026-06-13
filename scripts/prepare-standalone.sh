#!/bin/sh
# Next.js standalone no copia .next/static automáticamente (requerido en producción).
set -e

if [ ! -f .next/standalone/server.js ]; then
  echo "[prepare-standalone] Sin bundle standalone — se usará next start."
  exit 0
fi

mkdir -p .next/standalone/.next

if [ -d .next/static ]; then
  rm -rf .next/standalone/.next/static
  cp -r .next/static .next/standalone/.next/static
  echo "[prepare-standalone] .next/static copiado."
fi

if [ -d public ]; then
  rm -rf .next/standalone/public
  cp -r public .next/standalone/public
  echo "[prepare-standalone] public/ copiado."
fi
