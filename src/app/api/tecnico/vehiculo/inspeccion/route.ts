import { NextResponse } from "next/server";
import { requireTecnicoVehiculoCampo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { registrarInspeccion } from "@/lib/parque-automotor/servicio";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const auth = await requireTecnicoVehiculoCampo(
      typeof body?.vehiculoId === "string" ? body.vehiculoId : undefined
    );
    if (!auth.ok) return auth.response;
    const inspeccion = await registrarInspeccion({
      vehiculoId: auth.asignacion.vehiculoId,
      tecnicoId: auth.tecnicoId,
      usuarioId: auth.session.id,
      kilometraje: Number(body.kilometraje),
      combustible: Number(body.combustible ?? 0),
      items: body.items ?? {},
      observaciones: body.observaciones,
      fotos: body.fotos,
      modoCampo: true,
    });
    return NextResponse.json({ inspeccion }, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
