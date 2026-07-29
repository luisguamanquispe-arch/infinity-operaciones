/**
 * Builds conocidos como obsoletos (sin import Wispro CSV+Excel / cookie Firefox).
 */
const STALE_DEPLOY_PREFIXES = new Set([
  "a99b779",
  "700c46f",
  "cce76be",
  "f00cdcc",
  "43119b6",
  "cf0edfe",
  "37e311a",
  "47a6dc4",
  "5a049f8",
  "0121385",
  "7a5cf4e",
  "7e5c522",
  "0766570",
  "715884f",
  "200d4ee",
]);

/** Último commit con logo Infinity visible en supervisor/gerencia. */
export const LATEST_GIT_SHA_PREFIX = "3dd4ac6";

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
  return STALE_DEPLOY_PREFIXES.has(prefix);
}

/** true = servidor con funciones actuales (no muestra banner de error). */
export function gitShaMatchesExpected(sha: string | null | undefined): boolean {
  return !gitShaIsStale(sha);
}
