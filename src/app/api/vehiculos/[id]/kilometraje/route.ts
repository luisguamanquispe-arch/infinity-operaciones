import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { registrarKm } from "@/lib/parque-automotor/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    const lectura = await registrarKm({
      vehiculoId: id,
      usuarioId: auth.session.id,
      kilometraje: Number(body.kilometraje),
      origen: body.origen ?? "MANUAL",
      observacion: body.observacion,
    });
    return NextResponse.json({ lectura }, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
