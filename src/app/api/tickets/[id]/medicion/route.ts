import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden } from "@/lib/tickets";
import { saveUpload } from "@/lib/storage";
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

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket || ticket.tecnicoId !== session.tecnicoId) {
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
  const session = await getFullSession();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket || ticket.tecnicoId !== session.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const orden = await getOrCreateOrden(id);

  if (body.firma) {
    const { nombreCliente, cedula, imagen, lat, lng } = body.firma;
    const base64 = imagen.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const filename = `firma_${Date.now()}.png`;
    const imagenUrl = await saveUpload(buffer, id, filename);
    const firma = await prisma.firma.upsert({
      where: { ordenId: orden.id },
      create: {
        ordenId: orden.id,
        nombreCliente,
        cedula,
        imagenUrl,
        imagenData: imagen,
        lat,
        lng,
      },
      update: { nombreCliente, cedula, imagenUrl, imagenData: imagen, lat, lng },
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
}
