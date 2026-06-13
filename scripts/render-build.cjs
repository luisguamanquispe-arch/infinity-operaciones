const { execSync } = require("child_process");
const path = require("path");
const { prepareStandalone } = require("./prepare-standalone.cjs");

const root = path.join(__dirname, "..");
const lowMemory = process.env.RENDER_LOW_MEMORY !== "0";

if (lowMemory) {
  process.env.RENDER_LOW_MEMORY = "1";
  process.env.NODE_OPTIONS = process.env.BUILD_NODE_OPTIONS || "--max-old-space-size=320";
} else {
  process.env.NODE_OPTIONS = process.env.BUILD_NODE_OPTIONS || "--max-old-space-size=384";
}

process.env.NEXT_TELEMETRY_DISABLED = "1";
process.env.NEXT_BUILD_WORKERS = "1";
process.env.UV_THREADPOOL_SIZE = "1";

function run(cmd) {
  console.log(`[build] ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, env: process.env, shell: true });
}

console.log(`[build] lowMemory=${lowMemory} NODE_OPTIONS=${process.env.NODE_OPTIONS}`);

run("npm ci --include=dev --ignore-scripts");
run("npx prisma generate");
run("npm run build");

if (process.env.DATABASE_URL) {
  run("npx prisma migrate deploy");
} else {
  console.warn("[build] DATABASE_URL ausente — migraciones omitidas.");
}

if (lowMemory) {
  console.log("[build] Pruning devDependencies para reducir RAM en runtime...");
  run("npm prune --omit=dev");
  console.log("[build] Build ligero listo (next start en runtime).");
} else if (!prepareStandalone(root)) {
  console.error("[build] ERROR: falta .next/standalone/server.js tras el build.");
  process.exit(1);
} else {
  console.log("[build] Standalone preparado correctamente.");
}
