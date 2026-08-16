import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { ACTA_ITEMS, ESTADO_VEHICULO_LABELS, TIPO_VEHICULO_LABELS } from "./labels";

function bufferFromPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function dataUrlToBuffer(dataUrl: string | null | undefined): Buffer | null {
  if (!dataUrl?.startsWith("data:image")) return null;
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  try {
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

function encab(doc: PDFKit.PDFDocument, titulo: string) {
  const logoPath = path.join(process.cwd(), "public", "brand", "logo-infinity.png");
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, doc.page.width / 2 - 36, 36, { width: 72 });
      doc.moveDown(4.2);
    } catch {
      /* logo opcional */
    }
  }
  doc.fontSize(14).fillColor("#0f172a").text(titulo, { align: "center" });
  doc.moveDown(0.6);
  doc.fontSize(10).fillColor("#334155");
}

export async function generarPdfActaVehiculo(actaId: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const acta = await prisma.actaVehiculo.findUnique({
    where: { id: actaId },
    include: {
      vehiculo: true,
      firmas: true,
      asignacion: {
        include: {
          tecnico: { include: { usuario: { select: { nombre: true } } } },
          usuario: { select: { nombre: true } },
        },
      },
    },
  });
  if (!acta) throw new Error("Acta no encontrada");

  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const done = bufferFromPdf(doc);
  encab(
    doc,
    acta.tipo === "ENTREGA" ? "Acta de entrega de vehículo" : "Acta de recepción de vehículo"
  );
  doc.text(`Placa: ${acta.vehiculo.placa}`);
  doc.text(`${acta.vehiculo.marca} ${acta.vehiculo.modelo} ${acta.vehiculo.anio}`);
  doc.text(`Técnico: ${acta.asignacion.tecnico.usuario.nombre}`);
  doc.text(`Operaciones: ${acta.asignacion.usuario.nombre}`);
  doc.text(`Fecha: ${formatDateTime(acta.createdAt)}`);
  doc.text(`Kilometraje: ${acta.kilometraje} km`);
  doc.text(`Combustible: ${acta.combustible} %`);
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("#0f172a").text("Checklist", { underline: true });
  doc.fontSize(10).fillColor("#334155");
  for (const item of ACTA_ITEMS) {
    const ok = Boolean((acta as unknown as Record<string, boolean>)[item.key]);
    doc.text(`${ok ? "[X]" : "[ ]"} ${item.label}`);
  }
  if (acta.observaciones) {
    doc.moveDown(0.4);
    doc.text(`Observaciones: ${acta.observaciones}`);
  }
  doc.moveDown(0.8);
  for (const f of acta.firmas) {
    doc.text(`Firma ${f.tipo}: ${f.nombre}`);
    const buf = dataUrlToBuffer(f.imagenData);
    if (buf) {
      try {
        doc.image(buf, { width: 140, height: 50 });
      } catch {
        /* firma opcional */
      }
    }
    doc.moveDown(0.5);
  }
  doc.end();
  const buffer = await done;
  return {
    buffer,
    filename: `acta-${acta.tipo.toLowerCase()}-${acta.vehiculo.placa}.pdf`,
  };
}

export async function generarPdfHojaVida(vehiculoId: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const v = await prisma.vehiculo.findUnique({
    where: { id: vehiculoId },
    include: {
      asignaciones: {
        orderBy: { fechaInicio: "desc" },
        take: 12,
        include: {
          tecnico: { include: { usuario: { select: { nombre: true } } } },
        },
      },
      cargasCombustible: {
        where: { estadoRegistro: "ACTIVO" },
        orderBy: { fecha: "desc" },
        take: 15,
      },
      lecturasKm: {
        where: { estadoRegistro: "ACTIVO" },
        orderBy: { createdAt: "desc" },
        take: 15,
      },
      mantenimientos: {
        where: { estadoRegistro: "ACTIVO" },
        orderBy: { fecha: "desc" },
        take: 12,
      },
      novedades: { orderBy: { fecha: "desc" }, take: 12 },
      inspecciones: { orderBy: { fecha: "desc" }, take: 8 },
    },
  });
  if (!v) throw new Error("Vehículo no encontrado");

  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const done = bufferFromPdf(doc);
  encab(doc, `Hoja de vida · ${v.placa}`);
  doc.text(`${v.marca} ${v.modelo} (${v.anio}) · ${TIPO_VEHICULO_LABELS[v.tipo]}`);
  doc.text(`Estado: ${ESTADO_VEHICULO_LABELS[v.estado]}`);
  doc.text(`Kilometraje actual: ${v.kilometrajeActual} km`);
  doc.moveDown(0.5);
  doc.fontSize(12).text("Asignaciones", { underline: true });
  doc.fontSize(10);
  for (const a of v.asignaciones) {
    doc.text(
      `${formatDateTime(a.fechaInicio)} → ${a.fechaFin ? formatDateTime(a.fechaFin) : "abierta"} · ${a.tecnico.usuario.nombre} · ${a.kilometrajeEntrega} km`
    );
  }
  doc.moveDown(0.3);
  doc.fontSize(12).text("Combustible (reciente)", { underline: true });
  doc.fontSize(10);
  for (const c of v.cargasCombustible) {
    doc.text(
      `${formatDateTime(c.fecha)} · ${c.estacion} · ${c.galones} gal · $${c.total}` +
        (c.consumoFueraPromedio ? " · Consumo fuera del promedio." : "")
    );
  }
  doc.moveDown(0.3);
  doc.fontSize(12).text("Mantenimiento", { underline: true });
  doc.fontSize(10);
  for (const m of v.mantenimientos) {
    doc.text(`${formatDateTime(m.fecha)} · ${m.tipo} · $${m.costo} · ${m.kilometraje} km`);
  }
  doc.moveDown(0.3);
  doc.fontSize(12).text("Novedades", { underline: true });
  doc.fontSize(10);
  for (const n of v.novedades) {
    doc.text(`${formatDateTime(n.fecha)} · ${n.tipo} · ${n.estado} · ${n.descripcion.slice(0, 80)}`);
  }
  doc.end();
  const buffer = await done;
  return { buffer, filename: `hoja-vida-${v.placa}.pdf` };
}

export async function generarPdfReporteParque(
  tipo: "combustible" | "kilometraje" | "mantenimiento" | "novedades" | "costos" | "asignaciones" | "inspecciones",
  vehiculoId?: string | null
): Promise<{ buffer: Buffer; filename: string }> {
  const where = vehiculoId ? { vehiculoId } : {};
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const done = bufferFromPdf(doc);
  encab(doc, `Reporte parque automotor · ${tipo}`);

  if (tipo === "combustible") {
    const rows = await prisma.cargaCombustible.findMany({
      where: { ...where, estadoRegistro: "ACTIVO" },
      include: { vehiculo: { select: { placa: true } } },
      orderBy: { fecha: "desc" },
      take: 80,
    });
    for (const r of rows) {
      doc.text(
        `${formatDateTime(r.fecha)} ${r.vehiculo.placa} ${r.estacion} ${r.galones}gal $${r.total}` +
          (r.consumoFueraPromedio ? " · Consumo fuera del promedio." : "")
      );
    }
  } else if (tipo === "kilometraje") {
    const rows = await prisma.lecturaKilometraje.findMany({
      where: { ...where, estadoRegistro: "ACTIVO" },
      include: { vehiculo: { select: { placa: true } } },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    for (const r of rows) {
      doc.text(`${formatDateTime(r.createdAt)} ${r.vehiculo.placa} ${r.kilometraje} km (${r.origen})`);
    }
  } else if (tipo === "mantenimiento") {
    const rows = await prisma.mantenimientoVehiculo.findMany({
      where: { ...where, estadoRegistro: "ACTIVO" },
      include: { vehiculo: { select: { placa: true } } },
      orderBy: { fecha: "desc" },
      take: 80,
    });
    for (const r of rows) {
      doc.text(`${formatDateTime(r.fecha)} ${r.vehiculo.placa} ${r.tipo} $${r.costo}`);
    }
  } else if (tipo === "novedades") {
    const rows = await prisma.novedadVehiculo.findMany({
      where,
      include: { vehiculo: { select: { placa: true } } },
      orderBy: { fecha: "desc" },
      take: 80,
    });
    for (const r of rows) {
      doc.text(`${formatDateTime(r.fecha)} ${r.vehiculo.placa} ${r.tipo} ${r.estado}`);
    }
  } else if (tipo === "asignaciones") {
    const rows = await prisma.asignacionVehiculo.findMany({
      where,
      include: {
        vehiculo: { select: { placa: true } },
        tecnico: { include: { usuario: { select: { nombre: true } } } },
      },
      orderBy: { fechaInicio: "desc" },
      take: 80,
    });
    for (const r of rows) {
      doc.text(
        `${r.vehiculo.placa} · ${r.tecnico.usuario.nombre} · ${formatDateTime(r.fechaInicio)}`
      );
    }
  } else if (tipo === "inspecciones") {
    const rows = await prisma.inspeccionVehiculo.findMany({
      where,
      include: { vehiculo: { select: { placa: true } } },
      orderBy: { fecha: "desc" },
      take: 80,
    });
    for (const r of rows) {
      doc.text(`${formatDateTime(r.fecha)} ${r.vehiculo.placa} ${r.resultado}`);
    }
  } else {
    const cargas = await prisma.cargaCombustible.findMany({
      where: { estadoRegistro: "ACTIVO" },
      include: { vehiculo: { select: { placa: true } } },
    });
    const mants = await prisma.mantenimientoVehiculo.findMany({
      where: { estadoRegistro: "ACTIVO" },
      include: { vehiculo: { select: { placa: true } } },
    });
    const by: Record<string, { c: number; m: number }> = {};
    for (const c of cargas) {
      by[c.vehiculo.placa] ??= { c: 0, m: 0 };
      by[c.vehiculo.placa].c += c.total;
    }
    for (const m of mants) {
      by[m.vehiculo.placa] ??= { c: 0, m: 0 };
      by[m.vehiculo.placa].m += m.costo;
    }
    for (const [placa, v] of Object.entries(by)) {
      doc.text(`${placa} · combustible $${v.c.toFixed(2)} · mant. $${v.m.toFixed(2)}`);
    }
  }

  doc.end();
  const buffer = await done;
  return { buffer, filename: `reporte-${tipo}.pdf` };
}
