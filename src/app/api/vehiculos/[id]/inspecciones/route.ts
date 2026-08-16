import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { registrarInspeccion } from "@/lib/parque-automotor/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.tecnicoId) {
      return NextResponse.json({ error: "Técnico obligatorio." }, { status: 400 });
    }
    const inspeccion = await registrarInspeccion({
      vehiculoId: id,
      tecnicoId: body.tecnicoId,
      usuarioId: auth.session.id,
      kilometraje: Number(body.kilometraje),
      combustible: Number(body.combustible ?? 0),
      items: body.items ?? {},
      observaciones: body.observaciones,
      fotos: body.fotos,
    });
    return NextResponse.json({ inspeccion }, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
