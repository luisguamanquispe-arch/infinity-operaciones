import { NextResponse } from "next/server";
import { HelpDeskAuthError, requireHelpDeskSession } from "@/lib/help-desk/auth";
import { ejecutarAccionRemota } from "@/lib/help-desk/acciones-remotas";
import type { HdTipoAccionRemota } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireHelpDeskSession();
    const { id } = await params;
    const body = await request.json();

    const tipo = body.tipo as HdTipoAccionRemota;
    if (!tipo) {
      return NextResponse.json({ error: "Tipo de acción requerido" }, { status: 400 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip");

    const result = await ejecutarAccionRemota({
      conversacionId: id,
      usuarioId: session.id,
      tipo,
      configNueva: body.configNueva,
      motivo: body.motivo,
      observaciones: body.observaciones,
      ipAgente: ip,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HelpDeskAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
