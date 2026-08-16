import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import {
  registrarMantenimiento,
  vehiculoOperativoTrasMant,
} from "@/lib/parque-automotor/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.accion === "OPERATIVO") {
      const vehiculo = await vehiculoOperativoTrasMant(id, auth.session.id);
      return NextResponse.json({ vehiculo });
    }
    const rec = await registrarMantenimiento({
      vehiculoId: id,
      usuarioId: auth.session.id,
      kilometraje: Number(body.kilometraje),
      clase: body.clase ?? "PREVENTIVO",
      tipo: body.tipo ?? "OTRO",
      descripcion: body.descripcion ?? "",
      proveedor: body.proveedor,
      costo: Number(body.costo ?? 0),
      factura: body.factura,
      proximoFecha: body.proximoFecha,
      proximoKm: body.proximoKm != null ? Number(body.proximoKm) : null,
      observaciones: body.observaciones,
      fotos: body.fotos,
    });
    return NextResponse.json({ mantenimiento: rec }, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
