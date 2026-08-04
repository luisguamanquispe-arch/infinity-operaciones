import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { TIPO_LABELS, ESTADO_LABELS, formatDateTime, formatDuration } from "@/lib/utils";
import { calcularDuracionCronometro } from "@/lib/tickets";
import { TEXTO_ACEPTACION_SOPORTE, LABEL_CHECKBOX_ACEPTACION } from "@/lib/aceptacion-soporte";
import {
  esSoporteExpress,
  MODALIDAD_SOPORTE_LABELS,
  trabajoExpressTexto,
} from "@/lib/soporte-express";

function bufferFromPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export async function generarPdfReporteSoporte(ticketId: string): Promise<{
  buffer: Buffer;
  filename: string;
  codigo: string;
}> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      cliente: true,
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      tecnicos: { include: { tecnico: { include: { usuario: { select: { nombre: true } } } } } },
      orden: {
        include: {
          cronometro: true,
          medicion: true,
          firma: true,
          materiales: { include: { inventario: true } },
          fotografias: { select: { tipo: true, tomadaEn: true } },
        },
      },
    },
  });

  if (!ticket) throw new Error("Ticket no encontrado");
  if (!ticket.orden) throw new Error("Orden no encontrada");

  const orden = ticket.orden;
  const duracion = orden.cronometro
    ? calcularDuracionCronometro(
        orden.cronometro.inicio,
        orden.cronometro.fin,
        orden.cronometro.pausasJson
      )
    : 0;

  const tecnicos = [
    ticket.tecnico?.usuario.nombre,
    ...ticket.tecnicos.map((t) => t.tecnico.usuario.nombre),
  ]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const done = bufferFromPdf(doc);

  doc
    .fontSize(18)
    .fillColor("#006B7A")
    .text("INFINITY INTERNET", { align: "center" });
  doc
    .fontSize(12)
    .fillColor("#334155")
    .text("Reporte consolidado de soporte técnico", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#64748b").text(`Generado: ${formatDateTime(new Date())}`, {
    align: "center",
  });
  doc.moveDown();

  doc.fillColor("#0f172a").fontSize(13).text(`Ticket ${ticket.codigo}`, { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10);
  doc.text(`Tipo: ${TIPO_LABELS[ticket.tipo] ?? ticket.tipo}`);
  if (esSoporteExpress(ticket)) {
    doc.text(`Modalidad: ${MODALIDAD_SOPORTE_LABELS.EXPRESS}`);
    const te = trabajoExpressTexto(ticket.trabajoExpress, ticket.trabajoExpressOtro);
    if (te) doc.text(`Trabajo Express: ${te}`);
  }
  doc.text(`Estado: ${ESTADO_LABELS[ticket.estado] ?? ticket.estado}`);
  doc.text(`Prioridad: ${ticket.prioridad}`);
  doc.text(`Motivo: ${ticket.motivo || "—"}`);
  if (ticket.descripcion) doc.text(`Descripción inicial: ${ticket.descripcion}`);
  doc.text(`Técnico(s): ${tecnicos || "—"}`);
  if (duracion > 0) doc.text(`Duración: ${formatDuration(duracion)}`);
  if (orden.finalizadoEn) doc.text(`Finalizado: ${formatDateTime(orden.finalizadoEn)}`);
  doc.moveDown();

  doc.fontSize(13).text("Cliente", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  doc.text(`Nombre: ${ticket.cliente.nombre}`);
  doc.text(`Cédula: ${ticket.cliente.cedula}`);
  doc.text(`Teléfono: ${ticket.cliente.telefono}`);
  doc.text(`Plan: ${ticket.cliente.plan}`);
  doc.text(`Dirección: ${ticket.cliente.direccion}`);
  doc.text(`Sector: ${ticket.cliente.sector}`);
  doc.moveDown();

  doc.fontSize(13).text("Trabajo efectuado", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  doc.text(orden.resumenTrabajo?.trim() || "Sin resumen registrado.", {
    align: "justify",
  });
  doc.moveDown();

  if (orden.medicion) {
    doc.fontSize(13).text("Potencia óptica", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    doc.text(`RX: ${orden.medicion.rxDbm} dBm`);
    doc.text(`TX: ${orden.medicion.txDbm} dBm`);
    doc.moveDown();
  }

  if (orden.materiales.length > 0) {
    doc.fontSize(13).text("Material utilizado", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    for (const m of orden.materiales) {
      doc.text(`• ${m.inventario.nombre}: ${m.cantidad} ${m.inventario.unidad}`);
    }
    doc.moveDown();
  }

  doc.fontSize(13).text("Checklist", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
  doc.text(`Servicio OK: ${orden.servicioOk ? "Sí" : "No"}`);
  doc.text(`Potencia OK: ${orden.potenciaOk ? "Sí" : "No"}`);
  doc.text(`Fotos OK: ${orden.fotosOk ? "Sí" : "No"}`);
  doc.text(`Cliente conforme: ${orden.clienteConforme ? "Sí" : "No"}`);
  doc.text(`Firma registrada: ${orden.firmaOk ? "Sí" : "No"}`);
  doc.text(`Fotos tomadas: ${orden.fotografias.length}`);
  doc.moveDown();

  if (orden.firma) {
    doc.fontSize(13).text("Firma y aceptación del cliente", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    doc.text(`Firmante: ${orden.firma.nombreCliente}`);
    doc.text(`Cédula: ${orden.firma.cedula}`);
    doc.text(`Firmado: ${formatDateTime(orden.firma.firmadoEn)}`);
    if (orden.firma.aceptacionCondiciones) {
      doc.moveDown(0.3);
      doc.text("✓ Condiciones aceptadas");
      doc.text(orden.firma.textoAceptacion || TEXTO_ACEPTACION_SOPORTE, {
        align: "justify",
      });
      doc.moveDown(0.2);
      doc.text(`☑ ${LABEL_CHECKBOX_ACEPTACION}`);
    }
    if (orden.firma.imagenData?.startsWith("data:image")) {
      try {
        const b64 = orden.firma.imagenData.replace(/^data:image\/\w+;base64,/, "");
        const img = Buffer.from(b64, "base64");
        doc.moveDown(0.5);
        doc.image(img, { fit: [220, 90] });
      } catch {
        /* ignore image errors */
      }
    }
    doc.moveDown();
  }

  doc
    .fontSize(8)
    .fillColor("#64748b")
    .text(
      "Documento generado por Infinity Operaciones. El soporte sin costo aplica mientras el contrato esté activo, según condiciones aceptadas por el cliente.",
      { align: "center" }
    );

  doc.end();
  const buffer = await done;
  const filename = `reporte-${ticket.codigo.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
  return { buffer, filename, codigo: ticket.codigo };
}
