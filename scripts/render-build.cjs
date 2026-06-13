const { execSync } = require("child_process");
const path = require("path");
const { prepareStandalone } = require("./prepare-standalone.cjs");

const root = path.join(__dirname, "..");

process.env.NODE_OPTIONS = process.env.BUILD_NODE_OPTIONS || "--max-old-space-size=384";
process.env.NEXT_TELEMETRY_DISABLED = "1";

function run(cmd) {
  console.log(`[build] ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, env: process.env, shell: true });
}

console.log(`[build] NODE_OPTIONS=${process.env.NODE_OPTIONS}`);

run("npm install --include=dev --ignore-scripts");
run("npx prisma generate");

if (process.env.DATABASE_URL) {
  run("npx prisma migrate deploy");
} else {
  console.warn("[build] DATABASE_URL ausente — migraciones omitidas (configúrala en Render).");
}

run("npm run build");

if (!prepareStandalone(root)) {
  console.error("[build] ERROR: falta .next/standalone/server.js tras el build.");
  process.exit(1);
}

console.log("[build] Standalone preparado correctamente.");
