import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { resolverNovedadTicket } from "@/lib/novedad-ticket";
import { validarTecnicoIds } from "@/lib/ticket-tecnicos";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const accion = body.accion as "REPROGRAMAR" | "DESCARTAR";

  if (!accion || !["REPROGRAMAR", "DESCARTAR"].includes(accion)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  if (body.tecnicoIds?.length) {
    const err = await validarTecnicoIds(body.tecnicoIds);
    if (err) return NextResponse.json({ error: err }, { status: 404 });
  }

  try {
    const result = await resolverNovedadTicket({
      novedadId: id,
      usuarioId: session.id,
      accion,
      programadoEn: body.programadoEn,
      tecnicoIds: body.tecnicoIds,
      notaSupervisor: body.notaSupervisor,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al procesar novedad";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
