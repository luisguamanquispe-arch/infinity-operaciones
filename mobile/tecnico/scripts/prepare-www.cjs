const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const serverDefault = "https://infinity-operaciones-b3ij.onrender.com";

function readEnv() {
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = readEnv();
const serverUrl = (env.CAPACITOR_SERVER_URL || serverDefault).replace(/\/$/, "");

fs.writeFileSync(
  path.join(root, "www", "config.js"),
  `window.__INFINITY_SERVER__ = ${JSON.stringify(serverUrl)};\n`,
  "utf8"
);

console.log(`[prepare-www] Servidor: ${serverUrl}`);
