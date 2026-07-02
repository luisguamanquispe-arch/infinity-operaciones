import type { Rol } from "@prisma/client";
import { getFullSession } from "@/lib/auth";

/** Roles con acceso al módulo Help Desk (solo web). */
export const ROLES_HELP_DESK: Rol[] = ["ADMIN", "SUPERVISOR", "HELP_DESK"];

export function puedeAccederHelpDesk(rol: Rol): boolean {
  return ROLES_HELP_DESK.includes(rol);
}

export function puedeSupervisarHelpDesk(rol: Rol): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR";
}

/** Sesión API: exige rol Help Desk. */
export async function requireHelpDeskSession() {
  const session = await getFullSession();
  if (!session) {
    throw new HelpDeskAuthError("No autorizado", 401);
  }
  if (!puedeAccederHelpDesk(session.rol)) {
    throw new HelpDeskAuthError("Sin acceso al Help Desk", 403);
  }
  return session;
}

export class HelpDeskAuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}
