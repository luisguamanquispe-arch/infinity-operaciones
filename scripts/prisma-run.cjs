const path = require("path");
const { runPrisma } = require("./prisma-cli.cjs");

const root = path.join(__dirname, "..");
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Uso: node scripts/prisma-cli.cjs <comando> [args...]");
  process.exit(1);
}

runPrisma(root, args);
