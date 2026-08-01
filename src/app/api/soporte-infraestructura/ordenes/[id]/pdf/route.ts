import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { esTicketInfraestructura } from "@/lib/ticket-infraestructura";
import { generarPdfSoporteInfra } from "@/lib/soporte-infraestructura/pdf";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { ordenServicioCerrada } from "@/lib/ticket-cerrado";

/** PDF solo tras finalizar el soporte (no durante la ejecución). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      tecnicos: { select: { tecnicoId: true } },
      orden: { select: { finalizadoEn: true } },
    },
  });
  if (!ticket || !esTicketInfraestructura(ticket.tipo)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (
    session.rol === "TECNICO" &&
    (!session.tecnicoId || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId))
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const cerrado =
    ticket.estado === "CERRADO" ||
    ticket.estado === "FINALIZADO" ||
    ordenServicioCerrada(ticket.orden);

  if (!cerrado) {
    return NextResponse.json(
      {
        error:
          "El reporte PDF solo está disponible cuando el Técnico Responsable finaliza el soporte",
      },
      { status: 400 }
    );
  }

  try {
    const { buffer, filename } = await generarPdfSoporteInfra(id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar PDF" },
      { status: 500 }
    );
  }
}
