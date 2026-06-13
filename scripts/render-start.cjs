const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { prepareStandalone } = require("./prepare-standalone.cjs");

const root = path.join(__dirname, "..");

function fail(msg) {
  console.error(`\n[startup] ERROR: ${msg}\n`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  fail("DATABASE_URL no configurada. Render → Environment → infinity-db → Internal URL");
}

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = process.env.PORT || "3000";
process.env.HOSTNAME = hostname;
process.env.PORT = port;
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || "--max-old-space-size=160";

console.log(`[startup] NODE_OPTIONS=${process.env.NODE_OPTIONS}`);

function runMigrateDeploy() {
  if (process.env.PRISMA_MIGRATE_ON_START === "0") {
    console.log("[startup] PRISMA_MIGRATE_ON_START=0 — omitiendo migrate deploy.");
    return;
  }

  const prismaDir = path.join(root, "node_modules", "prisma", "build");
  const prismaCli = path.join(prismaDir, "index.js");
  const prismaWasm = path.join(prismaDir, "prisma_schema_build_bg.wasm");

  if (!fs.existsSync(prismaCli)) {
    console.warn("[startup] Prisma CLI no encontrado — omitiendo migrate deploy.");
    return;
  }
  if (!fs.existsSync(prismaWasm)) {
    console.warn(
      "[startup] prisma_schema_build_bg.wasm no encontrado en prisma/build — omitiendo migrate deploy."
    );
    return;
  }

  console.log("[startup] Ejecutando prisma migrate deploy...");
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=128" },
  });

  if (result.status !== 0) {
    throw new Error(`migrate deploy terminó con código ${result.status ?? 1}`);
  }
}

try {
  runMigrateDeploy();
} catch {
  console.warn("[startup] migrate deploy falló o prisma no disponible — continuando.");
}

const standaloneDir = path.join(root, ".next", "standalone");
const renderServer = path.join(standaloneDir, "server.js");
const dockerServer = path.join(root, "server.js");
const nextBuild = path.join(root, ".next", "BUILD_ID");

function attach(child) {
  child.on("exit", (code, signal) => {
    if (signal) console.error(`[startup] Señal: ${signal}`);
    process.exit(code ?? 1);
  });
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  process.on("SIGINT", () => child.kill("SIGINT"));
}

const dbPreview = process.env.DATABASE_URL.replace(/:[^:@/]+@/, ":***@").slice(0, 48);
console.log(`[startup] DATABASE_URL ok (${dbPreview}...)`);

if (fs.existsSync(renderServer)) {
  const staticDir = path.join(standaloneDir, ".next", "static");
  if (!fs.existsSync(staticDir)) prepareStandalone(root);
  console.log(`[startup] Standalone → http://${hostname}:${port}`);
  attach(spawn(process.execPath, ["server.js"], { cwd: standaloneDir, env: process.env, stdio: "inherit" }));
} else if (fs.existsSync(dockerServer)) {
  console.log(`[startup] Docker standalone → http://${hostname}:${port}`);
  attach(spawn(process.execPath, ["server.js"], { cwd: root, env: process.env, stdio: "inherit" }));
} else if (fs.existsSync(nextBuild)) {
  console.log(`[startup] next start (modo bajo RAM) → http://${hostname}:${port}`);
  const nextBin = require.resolve("next/dist/bin/next");
  attach(
    spawn(process.execPath, [nextBin, "start", "-H", hostname, "-p", port], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    })
  );
} else {
  fail("Sin build. Usa imagen Docker (GitHub Actions) o Build Command: npm run build:render");
}
