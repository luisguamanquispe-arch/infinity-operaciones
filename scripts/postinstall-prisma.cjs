/** postinstall: prisma generate solo en desarrollo local */
const { execSync } = require("child_process");

if (
  process.env.NODE_ENV === "production" ||
  process.env.SKIP_PRISMA_GENERATE === "1" ||
  process.env.CI === "true" ||
  process.env.npm_config_ignore_scripts === "true"
) {
  process.exit(0);
}

execSync("prisma generate", { stdio: "inherit" });
