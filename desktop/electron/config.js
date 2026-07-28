/**
 * Configuración de la aplicación de escritorio Infinity Operaciones.
 * Variables de entorno opcionales:
 *   DESKTOP_APP_URL  — URL del servidor Next.js (producción o local)
 *   DESKTOP_DEV_TOOLS — "1" para abrir DevTools en la ventana principal
 */
const path = require("path");

/** URL de la aplicación web cargada en la ventana principal. */
const APP_URL =
  process.env.DESKTOP_APP_URL?.trim() || "https://infinity-operaciones-b3ij.onrender.com";

/** Título de la ventana principal. */
const APP_TITLE = "Infinity Operaciones";

/** Nombre del archivo de video de bienvenida (raíz del repositorio). */
const INTRO_VIDEO_FILENAME = "intro_infinity.mp4";

/**
 * Resuelve la ruta absoluta del video de intro.
 * - Desarrollo: busca en la raíz del monorepo (../../intro_infinity.mp4)
 * - Empaquetado: busca en resources/ junto al ejecutable
 */
function resolveIntroVideoPath() {
  const fs = require("fs");

  const candidates = [
    path.join(__dirname, "..", "..", INTRO_VIDEO_FILENAME),
    path.join(process.resourcesPath || "", INTRO_VIDEO_FILENAME),
    path.join(__dirname, "..", "assets", INTRO_VIDEO_FILENAME),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

module.exports = {
  APP_URL,
  APP_TITLE,
  INTRO_VIDEO_FILENAME,
  resolveIntroVideoPath,
};
