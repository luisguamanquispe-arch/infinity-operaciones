import { redirect } from "next/navigation";
import { getFullSession } from "@/lib/auth";

/**
 * Entrada legacy /infraestructura → flujo operativo Soporte de Infraestructura.
 * Técnicos van a su panel (Mis Soportes); supervisor/admin al listado SI.
 */
export default async function InfraestructuraEntryPage() {
  const session = await getFullSession();
  if (!session) redirect("/login");
  if (session.rol === "TECNICO") redirect("/tecnico");
  if (session.rol === "ADMIN" || session.rol === "SUPERVISOR") {
    redirect("/supervisor/soporte-infraestructura");
  }
  redirect("/");
}
