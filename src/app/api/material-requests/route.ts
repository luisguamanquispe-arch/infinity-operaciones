import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireOpsInventarioView,
  requireSolicitarMaterial,
} from "@/lib/inventario-campo/auth";
import { inventarioFail } from "@/lib/inventario-campo/http";
import { crearSolicitud } from "@/lib/inventario-campo/servicio";
import { mapTipoTrabajoTicket } from "@/lib/inventario-campo/reglas";

export async function GET(request: Request) {
  const auth = await requireOpsInventarioView();
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const ticketId = searchParams.get("ticketId");
    const items = await prisma.materialRequest.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(ticketId ? { ticketId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        ticket: { select: { codigo: true, cliente: { select: { nombre: true } } } },
        tecnico: { include: { usuario: { select: { nombre: true } } } },
        warehouse: true,
        items: { include: { inventario: true } },
        _count: { select: { deliveries: true } },
      },
    });
    return NextResponse.json({ items });
  } catch (err) {
    return inventarioFail(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireSolicitarMaterial();
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    let workType = body.workType;
    if (!workType && body.ticketId) {
      const t = await prisma.ticket.findUnique({
        where: { id: body.ticketId },
        select: { tipo: true },
      });
      workType = mapTipoTrabajoTicket(t?.tipo);
    }
    const req = await crearSolicitud({
      ticketId: body.ticketId,
      tecnicoId: body.tecnicoId,
      warehouseId: body.warehouseId,
      requestedById: auth.session.id,
      workType,
      priority: body.priority,
      justification: body.justification,
      items: body.items || [],
      enviar: body.enviar !== false,
    });
    return NextResponse.json({ request: req }, { status: 201 });
  } catch (err) {
    return inventarioFail(err);
  }
}
