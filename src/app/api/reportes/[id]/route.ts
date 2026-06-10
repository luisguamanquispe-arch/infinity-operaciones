import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { calcularDuracionCronometro } from "@/lib/tickets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      cliente: true,
      tecnico: { include: { usuario: true } },
      orden: {
        include: {
          cronometro: true,
          medicion: true,
          fotografias: { orderBy: { tomadaEn: "asc" } },
          firma: true,
          materiales: { include: { inventario: true } },
        },
      },
      eventos: {
        include: { usuario: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }

  if (!["CERRADO", "FINALIZADO"].includes(ticket.estado)) {
    return NextResponse.json(
      { error: "Solo disponible para órdenes finalizadas o cerradas" },
      { status: 400 }
    );
  }

  const orden = ticket.orden;
  const duracionSegundos = orden?.cronometro
    ? calcularDuracionCronometro(
        orden.cronometro.inicio,
        orden.cronometro.fin,
        orden.cronometro.pausasJson
      )
    : 0;

  const fotosAntes = ["FACHADA", "POSTE", "NAP"];
  const fotosDurante = ["TRABAJO", "EMPALME", "CAJA_TERMINAL"];
  const fotosFinal = ["ONU", "SPEEDTEST", "CLIENTE_CONFORME"];

  const fotografias = orden?.fotografias ?? [];

  return NextResponse.json({
    ticket,
    duracionSegundos,
    evidencia: {
      antes: fotografias.filter((f) => fotosAntes.includes(f.tipo)),
      durante: fotografias.filter((f) => fotosDurante.includes(f.tipo)),
      final: fotografias.filter((f) => fotosFinal.includes(f.tipo)),
      otras: fotografias.filter(
        (f) =>
          ![...fotosAntes, ...fotosDurante, ...fotosFinal].includes(f.tipo)
      ),
    },
    checklist: orden
      ? {
          servicioOk: orden.servicioOk,
          potenciaOk: orden.potenciaOk,
          fotosOk: orden.fotosOk,
          clienteConforme: orden.clienteConforme,
          firmaOk: orden.firmaOk,
          whatsappEnviado: orden.whatsappEnviado,
        }
      : null,
  });
}
