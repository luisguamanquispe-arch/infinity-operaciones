import { redirect } from "next/navigation";
import { getFullSession } from "@/lib/auth";

export default async function InfraestructuraEstadisticasRedirect() {
  const session = await getFullSession();
  if (!session) redirect("/login");
  if (session.rol === "TECNICO") redirect("/tecnico");
  redirect("/supervisor/soporte-infraestructura/estadisticas");
}
