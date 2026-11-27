import { randomBytes } from "crypto";
import { origenPublico } from "@/lib/satisfaccion/reglas";

/** Token aleatorio criptográfico de 256 bits (43 caracteres base64url). */
export function generarTokenConfirmacion(): string {
  return randomBytes(32).toString("base64url");
}

/** Construye URL pública limpia sin PII, sin nombre, teléfono, dirección ni IDs internos. */
export function urlConfirmacionVisitaPublica(
  token: string,
  publicAppUrl: string | undefined
): string {
  const origin = origenPublico(publicAppUrl);
  const path = `/confirmar-visita/${token}`;
  return origin ? `${origin}${path}` : path;
}
