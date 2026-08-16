import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { recibirVehiculo } from "@/lib/parque-automotor/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await recibirVehiculo({
      vehiculoId: id,
      usuarioId: auth.session.id,
      kilometrajeRecepcion: Number(body.kilometrajeRecepcion),
      combustibleRecepcion: Number(body.combustibleRecepcion ?? 0),
      observaciones: body.observaciones,
      checklist: body.checklist,
      dejarDisponible: body.dejarDisponible,
      firmaTecnico: body.firmaTecnico,
      firmaAdmin: body.firmaAdmin,
    });
    return NextResponse.json(result);
  } catch (err) {
    return parqueFail(err);
  }
}
