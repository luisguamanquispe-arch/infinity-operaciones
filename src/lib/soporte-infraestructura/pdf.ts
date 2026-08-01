import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import {
  SI_ESTADO_LABELS,
  SI_RESULTADO_LABELS,
  siTipoTrabajoTexto,
} from "@/lib/ticket-infraestructura";
import { FOTO_LABELS } from "@/lib/utils";
import { nombresTecnicosTicket } from "@/lib/ticket-tecnicos";

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

export async function generarPdfSoporteInfra(ticketId: string): Promise<{
  buffer: Buffer;
  filename: string;
  codigo: string;
}> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      tecnicos: { include: { tecnico: { include: { usuario: { select: { nombre: true } } } } } },
      orden: {
        include: {
          fotografias: { orderBy: { tomadaEn: "asc" } },
          materiales: { include: { inventario: true } },
          cronometro: true,
          firma: true,
        },
      },
    },
  });

  if (!ticket || ticket.tipo !== "INFRAESTRUCTURA") {
    throw new Error("Orden de Soporte de Infraestructura no encontrada");
  }

  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const done = bufferFromPdf(doc);

  const logoPath = path.join(process.cwd(), "public", "brand", "logo-infinity.png");
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, doc.page.width / 2 - 40, 40, { width: 80 });
      doc.moveDown(5);
    } catch {
      /* optional */
    }
  }

  doc.fontSize(16).fillColor("#006B7A").text("INFINITY INTERNET", { align: "center" });
  doc
    .fontSize(12)
    .fillColor("#334155")
    .text("Reporte de Soporte de Infraestructura", { align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor("#64748b").text(`Generado: ${formatDateTime(new Date())}`, {
    align: "center",
  });
  doc.moveDown();

  const tipoLabel = siTipoTrabajoTexto(ticket.siTipoTrabajo, ticket.siTipoTrabajoOtro);
  const orden = ticket.orden;

  doc.fillColor("#0f172a").fontSize(13).text(`Orden ${ticket.codigo}`, { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  doc.text(`Estado: ${SI_ESTADO_LABELS[ticket.estado] || ticket.estado}`);
  doc.text(`Prioridad: ${ticket.prioridad}`);
  doc.text(`Tipo de trabajo: ${tipoLabel || "—"}`);
  doc.text(`Técnico responsable: ${ticket.tecnico?.usuario.nombre ?? "—"}`);
  doc.text(`Técnicos asignados: ${nombresTecnicosTicket(ticket)}`);
  doc.text(`Creado: ${formatDateTime(ticket.createdAt)}`);
  if (orden?.iniciadoEn) doc.text(`Inicio: ${formatDateTime(orden.iniciadoEn)}`);
  if (orden?.finalizadoEn) doc.text(`Fin: ${formatDateTime(orden.finalizadoEn)}`);
  doc.moveDown(0.4);

  doc.fontSize(12).text("Ubicación", { underline: true });
  doc.fontSize(10);
  doc.text(
    [ticket.provincia, ticket.canton, ticket.parroquia].filter(Boolean).join(" / ") || "—"
  );
  doc.text(`Sector: ${ticket.sectorInfra || ticket.zonaInfra || "—"}`);
  doc.text(`Dirección: ${ticket.direccionInfra || ticket.nodoAfectado || "—"}`);
  if (ticket.referenciaInfra) doc.text(`Referencia: ${ticket.referenciaInfra}`);
  if (ticket.latInfra != null && ticket.lngInfra != null) {
    doc.text(`GPS: ${ticket.latInfra}, ${ticket.lngInfra}`);
  }
  if (ticket.nodoAfectado) doc.text(`Nodo: ${ticket.nodoAfectado}`);
  doc.moveDown(0.4);

  doc.fontSize(12).text("Descripción / solicitud", { underline: true });
  doc.fontSize(10).text(ticket.descripcion || "—", { align: "justify" });
  doc.moveDown(0.3);

  doc.fontSize(12).text("Diagnóstico", { underline: true });
  doc.fontSize(10).text(ticket.diagnosticoInfra || orden?.resumenTrabajo || "—", {
    align: "justify",
  });
  doc.moveDown(0.3);

  doc.fontSize(12).text("Trabajo realizado", { underline: true });
  doc.fontSize(10).text(ticket.trabajoRealizadoInfra || "—", { align: "justify" });
  doc.moveDown(0.3);

  if (ticket.resultadoInfra) {
    doc.fontSize(12).text("Resultado", { underline: true });
    doc.fontSize(10).text(SI_RESULTADO_LABELS[ticket.resultadoInfra]);
    doc.moveDown(0.3);
  }

  if (ticket.observacionesInfra) {
    doc.fontSize(12).text("Observaciones", { underline: true });
    doc.fontSize(10).text(ticket.observacionesInfra, { align: "justify" });
    doc.moveDown(0.3);
  }

  const mats = orden?.materiales || [];
  if (mats.length) {
    doc.fontSize(12).text("Materiales utilizados", { underline: true });
    doc.fontSize(10);
    for (const m of mats) {
      doc.text(`• ${m.inventario.nombre}: ${m.cantidad} ${m.inventario.unidad}`);
    }
    doc.moveDown(0.3);
  }

  for (const foto of orden?.fotografias || []) {
    const buf = dataUrlToBuffer(foto.imagenData);
    if (!buf) continue;
    if (doc.y > 640) doc.addPage();
    doc.fontSize(11).fillColor("#0f172a").text(`Foto — ${FOTO_LABELS[foto.tipo] || foto.tipo}`);
    try {
      doc.image(buf, { fit: [460, 260], align: "center" });
      doc.moveDown(0.4);
    } catch {
      doc.fontSize(9).fillColor("#64748b").text("(No se pudo incrustar la imagen)");
    }
  }

  doc.end();
  const buffer = await done;
  return {
    buffer,
    filename: `soporte-infra-${ticket.codigo}.pdf`,
    codigo: ticket.codigo,
  };
}
