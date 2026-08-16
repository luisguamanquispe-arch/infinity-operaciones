import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { generarPdfReporteParque } from "@/lib/parque-automotor/pdf";

const TIPOS = [
  "combustible",
  "kilometraje",
  "mantenimiento",
  "novedades",
  "costos",
  "asignaciones",
  "inspecciones",
] as const;

export async function GET(request: Request) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") as (typeof TIPOS)[number] | null;
  if (!tipo || !TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de reporte inválido." }, { status: 400 });
  }
  try {
    const { buffer, filename } = await generarPdfReporteParque(
      tipo,
      searchParams.get("vehiculoId")
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return parqueFail(err);
  }
}
