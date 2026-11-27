/**
 * Rate limit dedicado para Confirmación de Visita (sin servicios externos).
 * - Extrae IP confiable según configuración explícita de proxy (evita spoofing por
 *   `X-Real-IP` o por valores iniciales forjados en `X-Forwarded-For`).
 * - Soporta límites por IP, por token y cooldown de reenvío por ticket.
 *
 * Configuración de proxy (variables de entorno):
 * - `TRUST_CF_CONNECTING_IP`: por defecto `"true"` (Render/Cloudflare sobrescribe `cf-connecting-ip`).
 *   Usar `"false"` si la app NO está detrás de Cloudflare; `"strict"` exige además `cf-ray`.
 * - `TRUST_X_REAL_IP`: `"true"` únicamente si el reverse proxy limpia y establece `x-real-ip`
 *   de forma confiable. Si no es `"true"`, nunca se confía en `x-real-ip` en producción ni
 *   cuando existe `x-forwarded-for`.
 * - `TRUSTED_PROXY_HOPS`: número entero ≥ 1 de proxies confiables que anexan la IP al final
 *   de `x-forwarded-for` (por defecto `1`).
 *   Índice seleccionado: `Math.max(0, partes.length - TRUSTED_PROXY_HOPS)`.
 *   Ejemplo con 1 proxy confiable (`TRUSTED_PROXY_HOPS=1`):
 *     `x-forwarded-for: spoof, 203.0.113.55` → partes[2 - 1] = `203.0.113.55`.
 *   Ejemplo con 2 proxies confiables (`TRUSTED_PROXY_HOPS=2`, ej. Cloudflare + Render sin cf-connecting-ip):
 *     `x-forwarded-for: spoof, 198.51.100.7, 172.70.1.5` → partes[3 - 2] = `198.51.100.7`.
 */

const hits = new Map<string, number[]>();

export const IP_FALLBACK_SEGURA = "sin-ip-confiable";

export function limitarTasaConfirmacion(
  clave: string,
  max: number,
  ventanaMs: number,
  ahoraMs: number = Date.now()
): boolean {
  const prev = (hits.get(clave) || []).filter((t) => ahoraMs - t < ventanaMs);
  if (prev.length >= max) {
    hits.set(clave, prev);
    return false;
  }
  prev.push(ahoraMs);
  hits.set(clave, prev);
  if (hits.size > 5000) {
    const primero = hits.keys().next().value;
    if (primero) hits.delete(primero);
  }
  return true;
}

export function limpiarRateLimitConfirmacionParaTests(): void {
  hits.clear();
}

function sanitizarIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const val = raw.trim().slice(0, 64);
  if (!val || !/^[0-9a-fA-F:.]+$/.test(val)) return null;
  return val;
}

export interface OpcionesProxyIp {
  trustCfConnectingIp?: "true" | "false" | "strict";
  trustXRealIp?: boolean;
  trustedProxyHops?: number;
  isProduction?: boolean;
}

/**
 * Extrae una IP confiable para rate limiting sin permitir evasión mediante cabeceras
 * manipuladas por el cliente (`X-Real-IP` o valores iniciales de `X-Forwarded-For`).
 */
export function ipConfiableDeRequest(
  request: Request,
  opts?: OpcionesProxyIp
): string {
  const trustCf =
    opts?.trustCfConnectingIp ??
    ((process.env.TRUST_CF_CONNECTING_IP as "true" | "false" | "strict" | undefined) || "true");
  const trustXRealIp =
    opts?.trustXRealIp ?? process.env.TRUST_X_REAL_IP === "true";
  const isProduction =
    opts?.isProduction ?? process.env.NODE_ENV === "production";

  // 1. Cloudflare edge header (cuando está habilitado y proviene del proxy esperado)
  if (trustCf !== "false") {
    const cfIp = sanitizarIp(request.headers.get("cf-connecting-ip"));
    const tieneCfRay = Boolean(request.headers.get("cf-ray")?.trim());
    if (cfIp && (trustCf !== "strict" || tieneCfRay)) {
      return cfIp;
    }
  }

  // 2. X-Real-IP solo si está explícitamente configurado como cabecera limpia/confiable del proxy
  if (trustXRealIp) {
    const realIp = sanitizarIp(request.headers.get("x-real-ip"));
    if (realIp) return realIp;
  }

  // 3. X-Forwarded-For usando TRUSTED_PROXY_HOPS desde el final (ignora prefijos forjados por cliente)
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const partes = fwd
      .split(",")
      .map((s) => sanitizarIp(s))
      .filter((s): s is string => Boolean(s));
    if (partes.length > 0) {
      const hopsRaw =
        opts?.trustedProxyHops ?? Number(process.env.TRUSTED_PROXY_HOPS || "1");
      const hops = Number.isInteger(hopsRaw) && hopsRaw >= 1 ? hopsRaw : 1;
      const idx = Math.max(0, partes.length - hops);
      return partes[idx];
    }
  }

  // 4. Sin X-Forwarded-For: solo permitir x-real-ip en entornos locales/no-producción
  if (!isProduction) {
    const realIpLocal = sanitizarIp(request.headers.get("x-real-ip"));
    if (realIpLocal) return realIpLocal;
  }

  // 5. Fallback seguro constante: evita crear buckets nuevos rotando headers arbitrarios
  return IP_FALLBACK_SEGURA;
}

/** Cabeceras de privacidad y no-cache para respuestas del flujo público de confirmación. */
export const HEADERS_PUBLICOS_CONFIRMACION: Record<string, string> = {
  "Cache-Control": "no-store, private, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
