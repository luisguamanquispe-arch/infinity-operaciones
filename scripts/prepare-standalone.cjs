const fs = require("fs");
const path = require("path");

/** Copia static/public al bundle standalone (requerido en producción). */
function prepareStandalone(root) {
  const standalone = path.join(root, ".next", "standalone");
  const serverJs = path.join(standalone, "server.js");
  if (!fs.existsSync(serverJs)) return false;

  const nextDir = path.join(standalone, ".next");
  fs.mkdirSync(nextDir, { recursive: true });

  const staticSrc = path.join(root, ".next", "static");
  const staticDest = path.join(nextDir, "static");
  if (fs.existsSync(staticSrc)) {
    fs.rmSync(staticDest, { recursive: true, force: true });
    fs.cpSync(staticSrc, staticDest, { recursive: true });
  }

  const publicSrc = path.join(root, "public");
  const publicDest = path.join(standalone, "public");
  if (fs.existsSync(publicSrc)) {
    fs.rmSync(publicDest, { recursive: true, force: true });
    fs.cpSync(publicSrc, publicDest, { recursive: true });
  }

  return true;
}

module.exports = { prepareStandalone };
