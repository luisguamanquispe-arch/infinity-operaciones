const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { prepareStandalone } = require("./prepare-standalone.cjs");

const root = path.join(__dirname, "..");

function fail(msg) {
  console.error(`\n[startup] ERROR: ${msg}\n`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  fail(
    "DATABASE_URL no configurada.\n" +
      "Render → infinity-operaciones → Environment → Add from Database → infinity-db → Internal URL"
  );
}

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = process.env.PORT || "3000";
process.env.HOSTNAME = hostname;
process.env.PORT = port;

const standaloneDir = path.join(root, ".next", "standalone");
const renderServer = path.join(standaloneDir, "server.js");
const dockerServer = path.join(root, "server.js");
const nextBuild = path.join(root, ".next", "BUILD_ID");

function startStandalone(cwd, entry) {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || "--max-old-space-size=192";
  console.log(`[startup] Standalone ${cwd}/${entry} (heap 192MB)`);
  return spawn(process.execPath, [entry], { cwd, env: process.env, stdio: "inherit" });
}

function startNext() {
  if (!fs.existsSync(nextBuild)) {
    fail("No hay build (.next/BUILD_ID). Build Command: npm run build:render");
  }
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || "--max-old-space-size=192";
  console.log(`[startup] next start en ${hostname}:${port} (heap 192MB, modo bajo RAM)`);
  const nextBin = require.resolve("next/dist/bin/next");
  return spawn(process.execPath, [nextBin, "start", "-H", hostname, "-p", port], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
}

const dbPreview = process.env.DATABASE_URL.replace(/:[^:@/]+@/, ":***@").slice(0, 48);
console.log(`[startup] DATABASE_URL ok (${dbPreview}...)`);

let child;

if (fs.existsSync(renderServer)) {
  const staticDir = path.join(standaloneDir, ".next", "static");
  if (!fs.existsSync(staticDir)) prepareStandalone(root);
  child = startStandalone(standaloneDir, "server.js");
} else if (fs.existsSync(dockerServer)) {
  child = startStandalone(root, "server.js");
} else {
  child = startNext();
}

child.on("exit", (code, signal) => {
  if (signal) console.error(`[startup] Proceso terminado por señal: ${signal}`);
  process.exit(code ?? 1);
});

process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
