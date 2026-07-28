/**
 * Pantalla de bienvenida (splash) — solo aplicación web.
 * La app móvil / login técnico (?app=tecnico) no usa este flujo.
 */

/** Cookie leída por el middleware para redirigir a /intro. */
export const SPLASH_COOKIE_NAME = "infinity-intro-v2";

/** localStorage (respaldo en el cliente). */
export const SPLASH_STORAGE_KEY = "infinity-intro-v2";

/** Video servido desde /public. */
export const SPLASH_VIDEO_SRC = "/intro_infinity.mp4";

/** Tras el intro, pantalla principal web. */
export const SPLASH_DESTINO_WEB = "/login";

/** Ruta dedicada al video de bienvenida. */
export const SPLASH_RUTA = "/intro";

/** ¿Es login web de supervisor/gerencia (no app técnico)? */
export function esLoginWebOperaciones(search: string): boolean {
  return !search.includes("app=tecnico");
}

/** Marca el intro como visto (cookie + localStorage). */
export function marcarSplashVisto(): void {
  if (typeof document === "undefined") return;
  try {
    localStorage.setItem(SPLASH_STORAGE_KEY, "1");
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${SPLASH_COOKIE_NAME}=1; path=/; max-age=31536000; SameSite=Lax${secure}`;
  } catch {
    /* ignorar */
  }
}

/** El cliente ya marcó el intro como visto. */
export function splashYaVistoCliente(): boolean {
  if (typeof document === "undefined") return true;
  try {
    if (localStorage.getItem(SPLASH_STORAGE_KEY) === "1") return true;
    return document.cookie.split(";").some((c) => c.trim().startsWith(`${SPLASH_COOKIE_NAME}=1`));
  } catch {
    return true;
  }
}
