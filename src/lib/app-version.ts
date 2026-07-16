/** Commits válidos en producción (incluir al menos el que tiene novedades de soporte). */
const VALID_DEPLOY_PREFIXES = ["e92c3cb", "6d5c765", "916c2ce", "3e9136b", "a4d7d4b", "37ac2fd"];

/** Último commit recomendado para desplegar. */
export const EXPECTED_GIT_SHA_PREFIX = VALID_DEPLOY_PREFIXES[0];

export function gitShaMatchesExpected(sha: string | null | undefined): boolean {
  if (!sha || sha === "unknown") return false;
  const prefix = sha.slice(0, 7);
  return VALID_DEPLOY_PREFIXES.includes(prefix);
}
