import { ReportesList } from "@/components/reportes/ReportesList";
import { getSession } from "@/lib/auth";
import { panelHomeHref, panelHomeLabel } from "@/lib/modulos-acceso";

export default async function ReportesPage() {
  const session = await getSession();
  const rol = session?.rol;
  return (
    <ReportesList
      backHref={panelHomeHref(rol === "ADMIN" ? "ADMIN" : "SUPERVISOR")}
      backLabel={panelHomeLabel(rol === "ADMIN" ? "ADMIN" : "SUPERVISOR")}
    />
  );
}
