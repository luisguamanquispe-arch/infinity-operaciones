/**
 * Utilidades para la pantalla de bienvenida (splash) en la aplicación web.
 * No aplica a la app móvil Capacitor ni al modo PWA del técnico.
 */

/** Clave en localStorage: el intro ya se reprodujo en este navegador. */
export const SPLASH_STORAGE_KEY = "infinity-intro-visto";

/** Ruta pública del video de introducción. */
export const SPLASH_VIDEO_SRC = "/intro_infinity.mp4";

/** Destino tras el splash o al omitir con ESC (pantalla principal web). */
export const SPLASH_DESTINO_WEB = "/login";

/**
 * Indica si el entorno actual es la web operativa (supervisor/gerencia),
 * excluyendo app nativa y PWA del técnico.
 */
export function esAplicacionWebOperaciones(): boolean {
  if (typeof window === "undefined") return false;

  const capacitor = (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;

  if (capacitor?.isNativePlatform?.()) {
    return false;
  }

  const esPwaStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const sesionAppTecnico = sessionStorage.getItem("infinity-app-tecnico") === "1";
  const urlAppTecnico = window.location.search.includes("app=tecnico");

  if (esPwaStandalone || sesionAppTecnico || urlAppTecnico) {
    return false;
  }

  return true;
}

/** El usuario ya vio el video de bienvenida en este navegador. */
export function splashYaVisto(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SPLASH_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

/** Marca el intro como reproducido (una sola vez por navegador). */
export function marcarSplashVisto(): void {
  try {
    localStorage.setItem(SPLASH_STORAGE_KEY, "1");
  } catch {
    /* almacenamiento bloqueado: no impedir el flujo */
  }
}

/** ¿Debe mostrarse el splash en esta visita? */
export function debeMostrarSplashWeb(): boolean {
  return esAplicacionWebOperaciones() && !splashYaVisto();
}
