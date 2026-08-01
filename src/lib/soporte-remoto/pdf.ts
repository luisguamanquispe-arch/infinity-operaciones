import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import {
  SR_ESTADO_LABELS,
  SR_RESULTADO_LABELS,
  SR_TIPO_SOPORTE_LABELS,
  formatTiempoMinutos,
} from "./labels";

function bufferFromPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export async function generarPdfSrTicket(ticketId: string): Promise<{
  buffer: Buffer;
  filename: string;
  codigo: string;
}> {
  const ticket = await prisma.srTicket.findUnique({
    where: { id: ticketId },
    include: {
      operador: { select: { nombre: true } },
    },
  });

  if (!ticket) throw new Error("Ticket no encontrado");

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

  doc.fontSize(16).fillColor("#006B7A").text("INFINITY INTERNET", { align: "center" });
  doc
    .fontSize(12)
    .fillColor("#334155")
    .text("Reporte de Soporte Remoto", { align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor("#64748b").text(`Generado: ${formatDateTime(new Date())}`, {
    align: "center",
  });
  doc.moveDown();

  const tipoLabel =
    ticket.tipoSoporte === "OTRO" && ticket.tipoSoporteOtro
      ? `Otro: ${ticket.tipoSoporteOtro}`
      : SR_TIPO_SOPORTE_LABELS[ticket.tipoSoporte];

  doc.fillColor("#0f172a").fontSize(13).text(`Ticket ${ticket.codigo}`, { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10);
  doc.text(`Fecha: ${formatDateTime(ticket.fecha)}`);
  if (ticket.horaInicio) doc.text(`Hora inicio: ${formatDateTime(ticket.horaInicio)}`);
  if (ticket.horaFin) doc.text(`Hora fin: ${formatDateTime(ticket.horaFin)}`);
  doc.text(`Tiempo empleado: ${formatTiempoMinutos(ticket.tiempoMinutos)}`);
  doc.text(`Operador: ${ticket.operador.nombre}`);
  doc.text(`Estado: ${SR_ESTADO_LABELS[ticket.estado]}`);
  doc.text(`Tipo de soporte: ${tipoLabel}`);
  if (ticket.resultado) {
    doc.text(`Resultado: ${SR_RESULTADO_LABELS[ticket.resultado]}`);
  }
  doc.moveDown(0.5);

  doc.fontSize(12).text("Datos del cliente", { underline: true });
  doc.fontSize(10);
  doc.text(`Nombre: ${ticket.clienteNombre}`);
  doc.text(`Código: ${ticket.clienteCodigo}`);
  doc.text(`Teléfono: ${ticket.telefono}`);
  doc.moveDown(0.5);

  doc.fontSize(12).text("Descripción del problema", { underline: true });
  doc.fontSize(10).text(ticket.descripcionProblema || "—", { align: "justify" });
  doc.moveDown(0.5);

  doc.fontSize(12).text("Solución aplicada", { underline: true });
  doc.fontSize(10).text(ticket.solucionAplicada || "—", { align: "justify" });
  doc.moveDown(0.5);

  if (ticket.observaciones) {
    doc.fontSize(12).text("Observaciones", { underline: true });
    doc.fontSize(10).text(ticket.observaciones, { align: "justify" });
  }

  doc.end();
  const buffer = await done;
  return {
    buffer,
    filename: `soporte-remoto-${ticket.codigo}.pdf`,
    codigo: ticket.codigo,
  };
}
