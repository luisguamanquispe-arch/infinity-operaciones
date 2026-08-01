/**
 * Builds conocidos como obsoletos (sin Soporte Remoto / Help Desk reemplazado).
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
  "3dd4ac6",
  "fcf65bf",
  "e031d00",
  "ebbcf7c",
  "693de18",
  "7dd249c",
  "c05bdf8",
]);

/** Último commit: Help Desk → Soporte Remoto bajo /help-desk. */
export const LATEST_GIT_SHA_PREFIX = "8f993a7";

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
