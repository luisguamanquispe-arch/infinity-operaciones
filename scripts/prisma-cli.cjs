/** Invoca Prisma CLI sin pasar por node_modules/.bin (evita ENOENT de *.wasm). */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function prismaCliPath(root) {
  return path.join(root, "node_modules", "prisma", "build", "index.js");
}

function runPrisma(root, args, extraEnv = {}) {
  const cli = prismaCliPath(root);
  if (!fs.existsSync(cli)) {
    console.error("[prisma] CLI no encontrado:", cli);
    process.exit(1);
  }

  const result = spawnSync(process.execPath, [cli, ...args], {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, ...extraEnv },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

module.exports = { prismaCliPath, runPrisma };
