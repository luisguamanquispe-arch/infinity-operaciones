import { redirect } from "next/navigation";
import { getFullSession } from "@/lib/auth";

/** Crear = Nuevo Soporte (orden INF-*), no reporte IR. */
export default async function InfraestructuraNuevoEntryPage() {
  const session = await getFullSession();
  if (!session) redirect("/login");
  if (session.rol === "TECNICO") redirect("/tecnico");
  if (session.rol === "ADMIN" || session.rol === "SUPERVISOR") {
    redirect("/supervisor/tickets/nuevo-infraestructura");
  }
  redirect("/");
}
