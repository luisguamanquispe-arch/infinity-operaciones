/** Ejecuta prisma migrate deploy sin terminar el proceso padre si falla. */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { prismaCliPath } = require("./prisma-cli.cjs");

function migrateDeploy(root) {
  if (!process.env.DATABASE_URL) {
    console.warn("[migrate] DATABASE_URL ausente — omitiendo migrate deploy.");
    return false;
  }

  const migrationsDir = path.join(root, "prisma", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.warn("[migrate] Sin carpeta prisma/migrations — omitiendo.");
    return false;
  }

  const cli = prismaCliPath(root);
  if (!fs.existsSync(cli)) {
    console.warn("[migrate] CLI Prisma no encontrado — omitiendo migrate deploy.");
    return false;
  }

  console.log("[migrate] Ejecutando prisma migrate deploy...");
  const result = spawnSync(process.execPath, [cli, "migrate", "deploy"], {
    stdio: "inherit",
    cwd: root,
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=128",
    },
  });

  if (result.status === 0) {
    console.log("[migrate] Migraciones aplicadas.");
    return true;
  }

  console.warn(`[migrate] migrate deploy terminó con código ${result.status ?? 1}`);
  return false;
}

module.exports = { migrateDeploy };
