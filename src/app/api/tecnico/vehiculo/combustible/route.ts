import { NextResponse } from "next/server";
import { requireTecnicoVehiculoCampo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { registrarCombustible } from "@/lib/parque-automotor/servicio";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const auth = await requireTecnicoVehiculoCampo(
      typeof body?.vehiculoId === "string" ? body.vehiculoId : undefined
    );
    if (!auth.ok) return auth.response;
    const result = await registrarCombustible({
      vehiculoId: auth.asignacion.vehiculoId,
      tecnicoId: auth.tecnicoId,
      usuarioId: auth.session.id,
      estacion: body.estacion,
      kilometraje: Number(body.kilometraje),
      galones: Number(body.galones),
      precioPorGalon: Number(body.precioPorGalon),
      numeroFactura: body.numeroFactura,
      comprobante: body.comprobante,
      observaciones: body.observaciones,
      modoCampo: true,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
