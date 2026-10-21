import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { generarExcelReporteParque } from "@/lib/parque-automotor/excel";
import { TIPOS_REPORTE_PARQUE, type TipoReporteParque } from "@/lib/parque-automotor/labels";

export async function GET(request: Request) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") as TipoReporteParque | null;
  if (!tipo || !TIPOS_REPORTE_PARQUE.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de reporte inválido." }, { status: 400 });
  }
  try {
    const { buffer, filename } = await generarExcelReporteParque(
      tipo,
      searchParams.get("vehiculoId")
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return parqueFail(err);
  }
}
