/** Primeros 7 caracteres del último commit desplegado en producción. Actualizar tras cada release. */
export const EXPECTED_GIT_SHA_PREFIX = "3e9136b";

export function gitShaMatchesExpected(sha: string | null | undefined): boolean {
  if (!sha || sha === "unknown") return false;
  return sha.slice(0, 7) === EXPECTED_GIT_SHA_PREFIX;
}
