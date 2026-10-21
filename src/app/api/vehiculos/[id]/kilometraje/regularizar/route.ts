import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { regularizarKilometrajeHistorico } from "@/lib/parque-automotor/servicio";
import type { ItemRegularizacionKm, TipoLecturaKm } from "@/lib/parque-automotor/reglas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    const raw = Array.isArray(body.items) ? body.items : [];
    const items: ItemRegularizacionKm[] = raw.map((item: Record<string, unknown>) => ({
      dia: String(item.dia ?? item.fecha ?? ""),
      kilometraje: Number(item.kilometraje),
      tipoLectura: (item.tipoLectura === "ESTIMADA" ? "ESTIMADA" : "REAL") as TipoLecturaKm,
      justificacion: String(item.justificacion ?? ""),
      fuente: item.fuente == null ? null : String(item.fuente),
    }));
    const data = await regularizarKilometrajeHistorico({
      vehiculoId: id,
      usuarioId: auth.session.id,
      items,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
