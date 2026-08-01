import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { asegurarColaboracionOrden } from "@/lib/ticket-reporte";
import { verificarTicketEditable } from "@/lib/ticket-cerrado";

export const runtime = "nodejs";

/** Elimina una foto de evidencia del soporte (técnico asignado, ticket editable). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fotoId: string }> }
) {
  try {
    const session = await getFullSession();
    if (!session?.tecnicoId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id, fotoId } = await params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        tecnicos: { select: { tecnicoId: true } },
        orden: { select: { id: true } },
      },
    });
    if (!ticket || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const editable = await verificarTicketEditable(id);
    if (!editable.ok) {
      return NextResponse.json({ error: editable.error }, { status: editable.status });
    }

    const permiso = await asegurarColaboracionOrden(id, session.tecnicoId);
    if (!permiso.ok) {
      return NextResponse.json(
        { error: permiso.error, reportadoPor: permiso.reportadoPorNombre },
        { status: permiso.status }
      );
    }

    if (!ticket.orden) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    const foto = await prisma.fotografia.findFirst({
      where: { id: fotoId, ordenId: ticket.orden.id },
    });
    if (!foto) {
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }

    await prisma.fotografia.delete({ where: { id: foto.id } });

    return NextResponse.json({ ok: true, eliminada: foto.id });
  } catch (err) {
    console.error("[DELETE fotos]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "No se pudo eliminar la foto. Intente de nuevo.",
      },
      { status: 500 }
    );
  }
}
