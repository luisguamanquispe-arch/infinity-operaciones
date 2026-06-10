import { ReportesList } from "@/components/reportes/ReportesList";

export default function ReportesPage() {
  return (
    <ReportesList
      backHref="/supervisor"
      backLabel="Volver al panel supervisor"
    />
  );
}
