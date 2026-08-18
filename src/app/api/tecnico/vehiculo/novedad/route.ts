import { NextResponse } from "next/server";
import { requireTecnicoVehiculoCampo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { registrarNovedad } from "@/lib/parque-automotor/servicio";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const auth = await requireTecnicoVehiculoCampo(
      typeof body?.vehiculoId === "string" ? body.vehiculoId : undefined
    );
    if (!auth.ok) return auth.response;
    const novedad = await registrarNovedad({
      vehiculoId: auth.asignacion.vehiculoId,
      tecnicoId: auth.tecnicoId,
      usuarioId: auth.session.id,
      kilometraje: Number(body.kilometraje),
      tipo: body.tipo ?? "OTRO",
      descripcion: body.descripcion ?? "",
      gravedad: body.gravedad,
      puedeCircular: body.puedeCircular !== false,
      fotos: body.fotos,
      modoCampo: true,
    });
    return NextResponse.json({ novedad }, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
