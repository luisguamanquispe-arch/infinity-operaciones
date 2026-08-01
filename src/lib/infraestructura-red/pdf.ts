import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import {
  IR_ESTADO_LABELS,
  IR_PRIORIDAD_LABELS,
  IR_TIPO_FOTO_LABELS,
  IR_TIPO_FIRMA_LABELS,
  IR_TIPO_TRABAJO_LABELS,
} from "./labels";

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

export async function generarPdfIrReporte(reporteId: string): Promise<{
  buffer: Buffer;
  filename: string;
  codigo: string;
}> {
  const reporte = await prisma.irReporte.findUnique({
    where: { id: reporteId },
    include: {
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      supervisor: { select: { nombre: true } },
      materiales: true,
      fotografias: { orderBy: { tomadaEn: "asc" } },
      firmas: true,
    },
  });

  if (!reporte) throw new Error("Reporte no encontrado");

  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const done = bufferFromPdf(doc);

  const logoPath = path.join(process.cwd(), "public", "brand", "logo-infinity.png");
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, doc.page.width / 2 - 40, 40, { width: 80 });
      doc.moveDown(5);
    } catch {
      /* logo opcional */
    }
  }

  doc
    .fontSize(16)
    .fillColor("#006B7A")
    .text("INFINITY INTERNET", { align: "center" });
  doc
    .fontSize(12)
    .fillColor("#334155")
    .text("Reporte de Infraestructura de Red", { align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor("#64748b").text(`Generado: ${formatDateTime(new Date())}`, {
    align: "center",
  });
  doc.moveDown();

  const tipoLabel =
    reporte.tipoTrabajo === "OTRO" && reporte.tipoTrabajoOtro
      ? `Otro: ${reporte.tipoTrabajoOtro}`
      : IR_TIPO_TRABAJO_LABELS[reporte.tipoTrabajo];

  doc.fillColor("#0f172a").fontSize(13).text(`Reporte ${reporte.codigo}`, { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10);
  doc.text(`Fecha: ${formatDateTime(reporte.fecha)}`);
  if (reporte.horaInicio) doc.text(`Hora inicio: ${formatDateTime(reporte.horaInicio)}`);
  if (reporte.horaFin) doc.text(`Hora fin: ${formatDateTime(reporte.horaFin)}`);
  doc.text(`Técnico: ${reporte.tecnico.usuario.nombre}`);
  doc.text(`Supervisor: ${reporte.supervisor?.nombre ?? "—"}`);
  doc.text(`Estado: ${IR_ESTADO_LABELS[reporte.estado]}`);
  doc.text(`Prioridad: ${IR_PRIORIDAD_LABELS[reporte.prioridad]}`);
  doc.text(`Tipo de trabajo: ${tipoLabel}`);
  doc.moveDown(0.5);

  doc.fontSize(12).text("Ubicación", { underline: true });
  doc.fontSize(10);
  doc.text(
    `${reporte.provincia} / ${reporte.canton} / ${reporte.parroquia} — ${reporte.sector}`
  );
  doc.text(reporte.direccion);
  if (reporte.lat != null && reporte.lng != null) {
    doc.text(`GPS: ${reporte.lat}, ${reporte.lng}`);
  }
  doc.moveDown(0.5);

  doc.fontSize(12).text("Descripción del trabajo", { underline: true });
  doc.fontSize(10).text(reporte.descripcion || "—", { align: "justify" });
  doc.moveDown(0.5);

  if (reporte.observaciones) {
    doc.fontSize(12).text("Observaciones", { underline: true });
    doc.fontSize(10).text(reporte.observaciones, { align: "justify" });
    doc.moveDown(0.5);
  }

  if (reporte.materiales.length) {
    doc.fontSize(12).text("Materiales utilizados", { underline: true });
    doc.fontSize(10);
    for (const m of reporte.materiales) {
      doc.text(`• ${m.material}: ${m.cantidad} ${m.unidad}`);
    }
    doc.moveDown(0.5);
  }

  for (const foto of reporte.fotografias) {
    const buf = dataUrlToBuffer(foto.imagenData);
    if (!buf) continue;
    if (doc.y > 640) doc.addPage();
    doc.fontSize(11).fillColor("#0f172a").text(`Foto — ${IR_TIPO_FOTO_LABELS[foto.tipo]}`);
    try {
      doc.image(buf, { fit: [460, 280], align: "center" });
      doc.moveDown(0.5);
    } catch {
      doc.fontSize(9).fillColor("#64748b").text("(No se pudo incrustar la imagen)");
    }
  }

  if (reporte.firmas.length) {
    if (doc.y > 620) doc.addPage();
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor("#0f172a").text("Firmas", { underline: true });
    doc.moveDown(0.3);
    for (const f of reporte.firmas) {
      doc.fontSize(10).text(`${IR_TIPO_FIRMA_LABELS[f.tipo]}: ${f.nombre}`);
      const buf = dataUrlToBuffer(f.imagenData);
      if (buf) {
        try {
          doc.image(buf, { fit: [220, 90] });
        } catch {
          /* ignore */
        }
      }
      doc.moveDown(0.4);
    }
  }

  doc.end();
  const buffer = await done;
  return {
    buffer,
    filename: `infraestructura-${reporte.codigo}.pdf`,
    codigo: reporte.codigo,
  };
}
