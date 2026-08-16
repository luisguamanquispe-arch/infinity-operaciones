import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { registrarCombustible } from "@/lib/parque-automotor/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await registrarCombustible({
      vehiculoId: id,
      usuarioId: auth.session.id,
      estacion: body.estacion,
      kilometraje: Number(body.kilometraje),
      galones: Number(body.galones),
      precioPorGalon: Number(body.precioPorGalon),
      numeroFactura: body.numeroFactura,
      comprobante: body.comprobante,
      observaciones: body.observaciones,
      fecha: body.fecha,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
