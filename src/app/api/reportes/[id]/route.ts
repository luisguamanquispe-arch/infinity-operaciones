import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { calcularDuracionCronometro } from "@/lib/tickets";
import { firmaParaReporte } from "@/lib/firma-image";
import { fotosParaReporte } from "@/lib/foto-image";
import { nombresTecnicosTicket, ticketIncludeTecnicos } from "@/lib/ticket-tecnicos";
import {
  CLAUSULAS_POLITICA_INSTALACION,
  esTicketInstalacion,
  gruposFotosPorTipo,
} from "@/lib/ticket-instalacion";
import { materialesParaReporte } from "@/lib/materiales-reporte";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      ...ticketIncludeTecnicos,
      orden: {
        include: {
          cronometro: true,
          medicion: true,
          fotografias: {
            orderBy: { tomadaEn: "asc" },
            select: {
              id: true,
              tipo: true,
              url: true,
              lat: true,
              lng: true,
              tomadaEn: true,
            },
          },
          firma: {
            select: {
              nombreCliente: true,
              cedula: true,
              imagenUrl: true,
              firmadoEn: true,
              lat: true,
              lng: true,
              aceptacionCondiciones: true,
              textoAceptacion: true,
              aceptadoEn: true,
            },
          },
          materiales: {
            include: { inventario: true },
          },
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

  const { antes: fotosAntes, durante: fotosDurante, final: fotosFinal } = gruposFotosPorTipo(
    ticket.tipo
  );

  const fotografias = orden?.fotografias ?? [];
  const firma = firmaParaReporte(orden?.firma ?? null);
  const fotosEnriquecidas = fotosParaReporte(fotografias);
  const materiales = materialesParaReporte(orden?.materiales ?? []);

  return NextResponse.json({
    ticket: {
      ...ticket,
      tecnicosLabel: nombresTecnicosTicket(ticket),
      orden: orden
        ? {
            ...orden,
            firma,
            materiales,
          }
        : null,
    },
    materiales,
    duracionSegundos,
    evidencia: {
      antes: fotosEnriquecidas.filter((f) => (fotosAntes as string[]).includes(f.tipo)),
      durante: fotosEnriquecidas.filter((f) => (fotosDurante as string[]).includes(f.tipo)),
      final: fotosEnriquecidas.filter((f) => (fotosFinal as string[]).includes(f.tipo)),
      otras: fotosEnriquecidas.filter(
        (f) =>
          ![...fotosAntes, ...fotosDurante, ...fotosFinal].includes(
            f.tipo as (typeof fotosAntes)[number]
          )
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
    clausulasInstalacion: esTicketInstalacion(ticket.tipo)
      ? [...CLAUSULAS_POLITICA_INSTALACION]
      : null,
  });
  } catch (err) {
    console.error("[GET reportes/id]", err);
    return NextResponse.json(
      { error: "No se pudo cargar el reporte" },
      { status: 500 }
    );
  }
}
