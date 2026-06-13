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
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || "--max-old-space-size=256";

const standaloneDir = path.join(root, ".next", "standalone");
const renderServer = path.join(standaloneDir, "server.js");
const dockerServer = path.join(root, "server.js");

let serverCwd;
let serverEntry;

if (fs.existsSync(renderServer)) {
  serverCwd = standaloneDir;
  serverEntry = "server.js";
  const staticDir = path.join(standaloneDir, ".next", "static");
  if (!fs.existsSync(staticDir)) {
    console.log("[startup] Copiando assets al bundle standalone...");
    prepareStandalone(root);
  }
} else if (fs.existsSync(dockerServer)) {
  serverCwd = root;
  serverEntry = "server.js";
} else {
  fail(
    "No se encontró server.js.\n" +
      "Build Command en Render: npm run build:render"
  );
}

const dbPreview = process.env.DATABASE_URL.replace(/:[^:@/]+@/, ":***@").slice(0, 48);
console.log(`[startup] DATABASE_URL ok (${dbPreview}...)`);
console.log(`[startup] NODE_OPTIONS=${process.env.NODE_OPTIONS}`);
console.log(`[startup] ${serverCwd}/server.js → http://${hostname}:${port}`);

const child = spawn(process.execPath, [serverEntry], {
  cwd: serverCwd,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) console.error(`[startup] Proceso terminado por señal: ${signal}`);
  process.exit(code ?? 1);
});

process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
