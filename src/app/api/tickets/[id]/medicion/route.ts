import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden } from "@/lib/tickets";
import { persistTicketImage } from "@/lib/media-storage";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { mensajeCedulaInvalida, normalizarCedula, validarCedulaEcuatoriana } from "@/lib/cedula-ec";
import { enMayusculas } from "@/lib/mayusculas";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { rxDbm, txDbm, pingMs, downloadMbps, uploadMbps } = await request.json();

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });
  if (!ticket || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const orden = await getOrCreateOrden(id);

  const medicion = await prisma.medicion.upsert({
    where: { ordenId: orden.id },
    create: {
      ordenId: orden.id,
      rxDbm: parseFloat(rxDbm),
      txDbm: parseFloat(txDbm),
      pingMs: pingMs ? parseFloat(pingMs) : null,
      downloadMbps: parseFloat(downloadMbps),
      uploadMbps: parseFloat(uploadMbps),
    },
    update: {
      rxDbm: parseFloat(rxDbm),
      txDbm: parseFloat(txDbm),
      pingMs: pingMs ? parseFloat(pingMs) : null,
      downloadMbps: parseFloat(downloadMbps),
      uploadMbps: parseFloat(uploadMbps),
      registradoEn: new Date(),
    },
  });

  return NextResponse.json({ medicion });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getFullSession();
    if (!session?.tecnicoId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { tecnicos: { select: { tecnicoId: true } } },
    });
    if (!ticket || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const orden = await getOrCreateOrden(id);

    if (body.firma) {
      const { nombreCliente, cedula, imagen, lat, lng } = body.firma;
      const cedulaNorm = normalizarCedula(cedula || "");
      if (!validarCedulaEcuatoriana(cedulaNorm)) {
        return NextResponse.json({ error: mensajeCedulaInvalida() }, { status: 400 });
      }
      const base64 = imagen.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const filename = `firma_${Date.now()}.png`;
      const imagenUrl = await persistTicketImage(id, filename, buffer);
      const firma = await prisma.firma.upsert({
        where: { ordenId: orden.id },
        create: {
          ordenId: orden.id,
          nombreCliente: enMayusculas(nombreCliente),
          cedula: cedulaNorm,
          imagenUrl,
          imagenData: imagen,
          lat,
          lng,
        },
        update: {
          nombreCliente: enMayusculas(nombreCliente),
          cedula: cedulaNorm,
          imagenUrl,
          imagenData: imagen,
          lat,
          lng,
        },
      });

      return NextResponse.json({ firma });
    }

    if (body.materiales) {
      await prisma.materialUtilizado.deleteMany({ where: { ordenId: orden.id } });

      for (const m of body.materiales) {
        await prisma.materialUtilizado.create({
          data: {
            ordenId: orden.id,
            inventarioId: m.inventarioId,
            cantidad: parseFloat(m.cantidad),
          },
        });

        await prisma.inventario.update({
          where: { id: m.inventarioId },
          data: { stock: { decrement: parseFloat(m.cantidad) } },
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (body.checklist) {
      await prisma.ordenServicio.update({
        where: { id: orden.id },
        data: body.checklist,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (err) {
    console.error("[PUT medicion]", err);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
