import { NextResponse } from "next/server";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";
import { parqueFail } from "@/lib/parque-automotor/http";
import { registrarNovedad, transicionarNovedad } from "@/lib/parque-automotor/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.novedadId && body.estado) {
      const n = await transicionarNovedad(body.novedadId, body.estado, auth.session.id);
      return NextResponse.json({ novedad: n });
    }
    if (!body.tecnicoId) {
      return NextResponse.json({ error: "Técnico obligatorio." }, { status: 400 });
    }
    const novedad = await registrarNovedad({
      vehiculoId: id,
      tecnicoId: body.tecnicoId,
      usuarioId: auth.session.id,
      kilometraje: Number(body.kilometraje),
      tipo: body.tipo ?? "OTRO",
      descripcion: body.descripcion ?? "",
      gravedad: body.gravedad,
      puedeCircular: body.puedeCircular !== false,
      fotos: body.fotos,
    });
    return NextResponse.json({ novedad }, { status: 201 });
  } catch (err) {
    return parqueFail(err);
  }
}
