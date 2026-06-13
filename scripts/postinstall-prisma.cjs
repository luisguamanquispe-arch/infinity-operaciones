/** postinstall: generar cliente Prisma solo en desarrollo/CI explícito */
const { execSync } = require("child_process");

if (
  process.env.SKIP_PRISMA_GENERATE === "1" ||
  process.env.CI === "true" ||
  process.env.npm_config_ignore_scripts === "true"
) {
  process.exit(0);
}

execSync("prisma generate", { stdio: "inherit" });
