const { execSync, spawnSync } = require("child_process");
const path = require("path");
const { runPrisma } = require("./prisma-cli.cjs");
const { prepareStandalone } = require("./prepare-standalone.cjs");

const root = path.join(__dirname, "..");
const lowMemory = process.env.RENDER_LOW_MEMORY !== "0";

if (lowMemory) {
  process.env.RENDER_LOW_MEMORY = "1";
}

process.env.NEXT_TELEMETRY_DISABLED = "1";
process.env.NEXT_BUILD_WORKERS = "1";
process.env.UV_THREADPOOL_SIZE = "1";

function run(cmd, extraEnv = {}) {
  console.log(`[build] ${cmd}`);
  execSync(cmd, {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, ...extraEnv },
    shell: true,
  });
}

function runNextBuild(heapMb) {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  console.log(`[build] next build (heap ${heapMb}MB, proceso aislado)...`);
  const result = spawnSync(process.execPath, [nextBin, "build"], {
    stdio: "inherit",
    cwd: root,
    env: {
      ...process.env,
      RENDER_LOW_MEMORY: lowMemory ? "1" : "0",
      NODE_OPTIONS: `--max-old-space-size=${heapMb}`,
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_BUILD_WORKERS: "1",
      UV_THREADPOOL_SIZE: "1",
    },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const heapBuild = lowMemory ? 256 : 384;
console.log(`[build] lowMemory=${lowMemory} heapBuild=${heapBuild}MB`);

run("npm ci --include=dev --ignore-scripts --no-audit --no-fund", {
  NODE_OPTIONS: "--max-old-space-size=128",
});

console.log("[build] prisma generate (CLI directo, sin npx)...");
runPrisma(root, ["generate"], { NODE_OPTIONS: "--max-old-space-size=128" });

runNextBuild(heapBuild);

if (process.env.DATABASE_URL) {
  console.log("[build] prisma migrate deploy (CLI directo)...");
  runPrisma(root, ["migrate", "deploy"], { NODE_OPTIONS: "--max-old-space-size=128" });
} else {
  console.warn("[build] DATABASE_URL ausente — migraciones omitidas.");
}

if (lowMemory) {
  run("npm prune --omit=dev", { NODE_OPTIONS: "--max-old-space-size=128" });
  run("rm -rf node_modules/prisma node_modules/.bin/prisma node_modules/.bin/prisma.cmd 2>/dev/null; true", {
    NODE_OPTIONS: "--max-old-space-size=128",
  });
  console.log("[build] Build ligero listo (next start en runtime).");
} else if (!prepareStandalone(root)) {
  console.error("[build] ERROR: falta .next/standalone/server.js.");
  process.exit(1);
} else {
  console.log("[build] Standalone preparado.");
}
