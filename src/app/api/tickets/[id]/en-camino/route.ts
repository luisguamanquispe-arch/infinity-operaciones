import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarEnCaminoTecnico } from "@/lib/confirmacion-visita/servicio";

/**
 * POST /api/tickets/[id]/en-camino
 * Valida en backend que el técnico esté asignado al ticket y que exista una
 * confirmación válida y vigente (o exención / ticket histórico) antes de habilitar
 * el desplazamiento.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  const { id } = await params;

  if (!session?.id || session.rol !== "TECNICO" || !session.tecnicoId) {
    return NextResponse.json(
      { error: "Solo un técnico autenticado puede iniciar el desplazamiento." },
      { status: 401 }
    );
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      tecnicos: { select: { tecnicoId: true } },
      confirmacionVisita: true,
    },
  });

  const res = await registrarEnCaminoTecnico({
    ticket,
    session,
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, codigo: res.codigo },
      { status: res.status }
    );
  }

  return NextResponse.json({
    ok: true,
    yaEnCamino: res.yaEnCamino,
    enCaminoEn: res.enCaminoEn,
    confirmacionVisita: res.vista,
  });
}
