import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { registrarDocumento } from "@/lib/parque-automotor/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    const documento = await registrarDocumento({
      vehiculoId: id,
      usuarioId: auth.session.id,
      tipo: body.tipo ?? "OTRO",
      numero: body.numero,
      fechaInicio: body.fechaInicio,
      fechaVencimiento: body.fechaVencimiento,
      archivo: body.archivo,
      observacion: body.observacion,
    });
    return NextResponse.json({ documento }, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
