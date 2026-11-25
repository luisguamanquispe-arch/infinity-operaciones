import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { alertaRiesgoBajaActiva } from "@/lib/motivo-tecnico/riesgo-baja";
import { rolPuedeGestionarRiesgoBaja } from "@/lib/motivo-tecnico/reglas-patch";
import { nombresTecnicosTicket, ticketIncludeTecnicos } from "@/lib/ticket-tecnicos";

export async function GET() {
  const session = await getFullSession();
  if (!session || !rolPuedeGestionarRiesgoBaja(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const rows = await prisma.ticket.findMany({
    where: {
      clienteRiesgoBaja: true,
      clienteRiesgoBajaResueltoEn: null,
    },
    include: {
      ...ticketIncludeTecnicos,
      cliente: { select: { nombre: true, sector: true } },
      clienteRiesgoBajaActivadoPor: { select: { id: true, nombre: true } },
      gestionesRiesgoBaja: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          resultado: true,
          observaciones: true,
          usuarioNombre: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ prioridad: "asc" }, { createdAt: "asc" }],
    take: 50,
  });

  const now = Date.now();
  return NextResponse.json({
    tickets: rows
      .filter((t) =>
        alertaRiesgoBajaActiva({
          clienteRiesgoBaja: t.clienteRiesgoBaja,
          clienteRiesgoBajaResueltoEn: t.clienteRiesgoBajaResueltoEn,
        })
      )
      .map((t) => ({
        id: t.id,
        codigo: t.codigo,
        prioridad: t.prioridad,
        estado: t.estado,
        motivo: t.motivo,
        createdAt: t.createdAt.toISOString(),
        minutosDesdeCreacion: Math.max(
          0,
          Math.floor((now - t.createdAt.getTime()) / 60_000)
        ),
        cliente: {
          nombre: t.cliente.nombre,
          sector: (t.cliente.sector || "").trim() || null,
        },
        tecnicosLabel: nombresTecnicosTicket(t),
        clienteRiesgoBaja: true,
        clienteRiesgoBajaMotivo: t.clienteRiesgoBajaMotivo,
        clienteRiesgoBajaActivadoEn: t.clienteRiesgoBajaActivadoEn?.toISOString() ?? null,
        activadoPor: t.clienteRiesgoBajaActivadoPor
          ? {
              id: t.clienteRiesgoBajaActivadoPor.id,
              nombre: t.clienteRiesgoBajaActivadoPor.nombre,
            }
          : null,
        gestiones: t.gestionesRiesgoBaja.map((g) => ({
          ...g,
          createdAt: g.createdAt.toISOString(),
        })),
      })),
  });
}
