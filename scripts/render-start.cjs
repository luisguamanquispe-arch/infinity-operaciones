const { execSync, spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

if (!process.env.DATABASE_URL) {
  console.error("");
  console.error("ERROR: DATABASE_URL is not set.");
  console.error("");
  console.error("Render fix:");
  console.error("  1. Dashboard → infinity-operaciones → Environment");
  console.error("  2. Add DATABASE_URL from infinity-db (Internal Database URL)");
  console.error("  3. Manual Deploy → Clear build cache & deploy");
  console.error("");
  process.exit(1);
}

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = process.env.PORT || "3000";
process.env.HOSTNAME = hostname;
process.env.PORT = port;
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || "--max-old-space-size=384";

const dbPreview = process.env.DATABASE_URL.replace(/:[^:@/]+@/, ":***@").slice(0, 48);
console.log(`[startup] DATABASE_URL ok (${dbPreview}...)`);

console.log("[startup] Running database migrations...");
try {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
    cwd: root,
  });
} catch {
  console.error("[startup] prisma migrate deploy failed — revise DATABASE_URL y logs de Postgres.");
  process.exit(1);
}

console.log("[startup] Seed en segundo plano...");
const seed = spawn(process.execPath, [path.join(__dirname, "ensure-seed.cjs")], {
  cwd: root,
  env: process.env,
  stdio: "ignore",
  detached: true,
});
seed.unref();

console.log(`[startup] Next.js on ${hostname}:${port}...`);
const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "start", "-H", hostname, "-p", port], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));
