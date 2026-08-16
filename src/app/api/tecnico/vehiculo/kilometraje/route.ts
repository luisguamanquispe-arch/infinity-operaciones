import { NextResponse } from "next/server";
import { requireTecnicoVehiculoCampo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { registrarKm } from "@/lib/parque-automotor/servicio";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const auth = await requireTecnicoVehiculoCampo(
      typeof body?.vehiculoId === "string" ? body.vehiculoId : undefined
    );
    if (!auth.ok) return auth.response;
    const lectura = await registrarKm({
      vehiculoId: auth.asignacion.vehiculoId,
      tecnicoId: auth.tecnicoId,
      usuarioId: auth.session.id,
      kilometraje: Number(body.kilometraje),
      origen: "MANUAL",
      observacion: body.observacion,
      modoCampo: true,
    });
    return NextResponse.json({ lectura }, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
