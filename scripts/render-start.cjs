const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { migrateDeploy } = require("./migrate-deploy.cjs");

const root = path.join(__dirname, "..");
const hostname = "0.0.0.0";
const port = process.env.PORT || "3000";

process.env.HOSTNAME = hostname;
process.env.PORT = port;
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || "--max-old-space-size=160";

function fail(msg) {
  console.error(`\n[startup] ERROR: ${msg}\n`);
  process.exit(1);
}

console.log(`[startup] GIT_SHA=${process.env.GIT_SHA || "unknown"}`);
console.log(`[startup] NODE_OPTIONS=${process.env.NODE_OPTIONS}`);

if (!process.env.DATABASE_URL) {
  console.warn("[startup] ADVERTENCIA: DATABASE_URL no configurada — login y APIs fallarán.");
} else {
  const preview = process.env.DATABASE_URL.replace(/:[^:@/]+@/, ":***@").slice(0, 48);
  console.log(`[startup] DATABASE_URL ok (${preview}...)`);
}

if (!process.env.JWT_SECRET) {
  console.warn("[startup] ADVERTENCIA: JWT_SECRET no configurada.");
}

migrateDeploy(root);

console.log("[startup] Asegurando enum LEIDO (semáforo)...");
const ensure = spawnSync(process.execPath, [path.join(__dirname, "ensure-leido-enum.cjs")], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
if (ensure.status !== 0) {
  console.warn(`[startup] ensure-leido-enum terminó con código ${ensure.status ?? 1}`);
}

console.log("[startup] Verificando usuarios iniciales...");
const seedResult = spawnSync(process.execPath, [path.join(__dirname, "ensure-seed.cjs")], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
if (seedResult.status !== 0) {
  console.warn(`[startup] ensure-seed terminó con código ${seedResult.status ?? 1}`);
}

const buildId = path.join(root, ".next", "BUILD_ID");
if (!fs.existsSync(buildId)) {
  fail("Falta build (.next/BUILD_ID). Reconstruye la imagen o ejecuta npm run build.");
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!fs.existsSync(nextBin)) {
  fail(`Next.js no encontrado en ${nextBin}`);
}

console.log(`[startup] next start → http://${hostname}:${port}`);

const child = spawn(process.execPath, [nextBin, "start", "-H", hostname, "-p", port], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) console.error(`[startup] Señal: ${signal}`);
  process.exit(code ?? 1);
});

process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
