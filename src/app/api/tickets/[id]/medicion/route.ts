import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden } from "@/lib/tickets";
import { persistTicketImage } from "@/lib/media-storage";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { mensajeCedulaInvalida, normalizarCedula, validarCedulaEcuatoriana } from "@/lib/cedula-ec";
import { enMayusculasGuardar } from "@/lib/mayusculas";
import {
  tipoInventarioEfectivo,
  validarMaterialDetalle,
  guardarDetalleMaterial,
} from "@/lib/material-detalle";
import { calcularExcedenteMaterial } from "@/lib/fibra-excedente";
import { esTicketInfraestructura } from "@/lib/ticket-infraestructura";
import {
  normalizarDatosInstalacion,
  datosInstalacionParaGuardar,
  validarDatosInstalacion,
  type DatosInstalacionInput,
} from "@/lib/ticket-instalacion";
import { asegurarReportadorOrden } from "@/lib/ticket-reporte";
import { verificarTicketEditable } from "@/lib/ticket-cerrado";
import type { TipoPatchCord } from "@prisma/client";

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

  const editable = await verificarTicketEditable(id);
  if (!editable.ok) {
    return NextResponse.json({ error: editable.error }, { status: editable.status });
  }

  const permiso = await asegurarReportadorOrden(id, session.tecnicoId);
  if (!permiso.ok) {
    return NextResponse.json(
      { error: permiso.error, reportadoPor: permiso.reportadoPorNombre },
      { status: permiso.status }
    );
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

    const editable = await verificarTicketEditable(id);
    if (!editable.ok) {
      return NextResponse.json({ error: editable.error }, { status: editable.status });
    }

    const permiso = await asegurarReportadorOrden(id, session.tecnicoId);
    if (!permiso.ok) {
      return NextResponse.json(
        { error: permiso.error, reportadoPor: permiso.reportadoPorNombre },
        { status: permiso.status }
      );
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
          nombreCliente: enMayusculasGuardar(nombreCliente),
          cedula: cedulaNorm,
          imagenUrl,
          imagenData: imagen,
          lat,
          lng,
        },
        update: {
          nombreCliente: enMayusculasGuardar(nombreCliente),
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
      const items = body.materiales as {
        inventarioId: string;
        cantidad: string | number;
        serie?: string;
        modelo?: string;
        marca?: string;
        tipoPatchCord?: TipoPatchCord | null;
      }[];

      const inventarioIds = [...new Set(items.map((m) => m.inventarioId))];
      const inventarioMap = new Map(
        (
          await prisma.inventario.findMany({
            where: { id: { in: inventarioIds } },
          })
        ).map((inv) => [inv.id, inv])
      );

      for (const m of items) {
        const inv = inventarioMap.get(m.inventarioId);
        if (!inv) {
          return NextResponse.json({ error: "Material de inventario no encontrado" }, { status: 400 });
        }
        const tipo = tipoInventarioEfectivo(inv.tipo, inv.nombre);
        const errDetalle = validarMaterialDetalle(tipo, m, inv.nombre);
        if (errDetalle) {
          return NextResponse.json({ error: `${inv.nombre}: ${errDetalle}` }, { status: 400 });
        }
      }

      const ticketMat = await prisma.ticket.findUnique({
        where: { id },
        select: { tipo: true },
      });
      const esInfra = ticketMat ? esTicketInfraestructura(ticketMat.tipo) : false;

      await prisma.materialUtilizado.deleteMany({ where: { ordenId: orden.id } });

      for (const m of items) {
        const inv = inventarioMap.get(m.inventarioId)!;
        const tipo = tipoInventarioEfectivo(inv.tipo, inv.nombre);
        const detalle = guardarDetalleMaterial(tipo, inv.nombre, m);
        const cantidad = parseFloat(String(m.cantidad));
        const excedenteMetros = calcularExcedenteMaterial(inv.nombre, cantidad, esInfra);

        await prisma.materialUtilizado.create({
          data: {
            ordenId: orden.id,
            inventarioId: m.inventarioId,
            cantidad,
            serie: detalle.serie,
            modelo: detalle.modelo,
            marca: detalle.marca,
            tipoPatchCord: detalle.tipoPatchCord,
            excedenteMetros: excedenteMetros > 0 ? excedenteMetros : null,
          },
        });

        await prisma.inventario.update({
          where: { id: m.inventarioId },
          data: { stock: { decrement: parseFloat(String(m.cantidad)) } },
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (body.instalacion) {
      if (ticket.tipo !== "INSTALACION") {
        return NextResponse.json({ error: "Solo tickets de instalación registran estos datos" }, { status: 400 });
      }

      const datos = body.instalacion as DatosInstalacionInput;

      await prisma.ordenServicio.update({
        where: { id: orden.id },
        data: datosInstalacionParaGuardar(datos),
      });
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
