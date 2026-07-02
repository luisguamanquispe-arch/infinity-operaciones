import { NextResponse } from "next/server";
import { HelpDeskAuthError, requireHelpDeskSession } from "@/lib/help-desk/auth";
import { escalarConversacionACampo } from "@/lib/help-desk/escalamiento";
import type { HdMotivoEscalamiento, Prioridad } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireHelpDeskSession();
    const { id } = await params;
    const body = await request.json();

    const motivo = body.motivo as HdMotivoEscalamiento;
    if (!motivo) {
      return NextResponse.json({ error: "Motivo de escalamiento requerido" }, { status: 400 });
    }

    const result = await escalarConversacionACampo({
      conversacionId: id,
      usuarioId: session.id,
      motivo,
      prioridad: body.prioridad as Prioridad | undefined,
      materialSugerido: body.materialSugerido,
      tiempoEstimadoMin: body.tiempoEstimadoMin,
      diagnostico: body.diagnostico,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HelpDeskAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Error al escalar";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
