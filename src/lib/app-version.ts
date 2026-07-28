/**
 * Builds conocidos como obsoletos (anteriores a novedades de soporte / clientes CRM).
 * Cualquier otro hash con GIT_SHA válido se considera actualizado.
 */
const STALE_DEPLOY_PREFIXES = new Set([
  "a99b779",
  "700c46f",
  "cce76be",
  "f00cdcc",
  "43119b6",
  "cf0edfe",
  // Builds anteriores al import Wispro CSV+Excel y cookie Firefox
  "37e311a",
  "47a6dc4",
  "5a049f8",
  "0121385",
  "7a5cf4e",
  "7e5c522",
  "0766570",
  "715884f",
]);

/** Último commit en main (referencia informativa para el banner). */
export const LATEST_GIT_SHA_PREFIX = "pending";

/** @deprecated Usar gitShaIsStale — mantenido para compatibilidad con badges. */
export const EXPECTED_GIT_SHA_PREFIX = LATEST_GIT_SHA_PREFIX;

export function gitShaPrefix(sha: string | null | undefined): string {
  if (!sha || sha === "unknown") return "";
  return sha.slice(0, 7);
}

/** true = servidor demasiado viejo o sin hash de build. */
export function gitShaIsStale(sha: string | null | undefined): boolean {
  const prefix = gitShaPrefix(sha);
  if (!prefix) return true;
  if (STALE_DEPLOY_PREFIXES.has(prefix)) return true;
  return prefix !== LATEST_GIT_SHA_PREFIX;
}

/** true = servidor con funciones actuales (no muestra banner de error). */
export function gitShaMatchesExpected(sha: string | null | undefined): boolean {
  return !gitShaIsStale(sha);
}
