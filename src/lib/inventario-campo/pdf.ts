import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

function bufferFromPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
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

export async function generarPdfEntregaMateriales(deliveryId: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const del = await prisma.materialDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      ticket: { include: { cliente: true } },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      deliveredBy: { select: { nombre: true } },
      request: true,
      items: { include: { inventario: true } },
    },
  });
  if (!del) throw new Error("Entrega no encontrada");

  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const done = bufferFromPdf(doc);
  encab(doc, "Acta de entrega de materiales");
  doc.text(`Entrega: ${del.deliveryNumber}`);
  doc.text(`Solicitud: ${del.request.requestNumber}`);
  doc.text(`OT: ${del.ticket.codigo}`);
  doc.text(`Cliente: ${del.ticket.cliente.nombre}`);
  doc.text(`Técnico: ${del.tecnico.usuario.nombre}`);
  doc.text(`Entregó: ${del.deliveredBy.nombre}`);
  doc.text(`Fecha: ${formatDateTime(del.deliveredAt)}`);
  if (del.confirmedAt) {
    doc.text(`Confirmada: ${formatDateTime(del.confirmedAt)}`);
  }
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("#0f172a").text("Materiales", { underline: true });
  doc.fontSize(10).fillColor("#334155");
  for (const it of del.items) {
    doc.text(
      `• ${it.inventario.nombre}: ${it.deliveredQty} ${it.inventario.unidad}` +
        (it.lotNumber ? ` · lote ${it.lotNumber}` : "")
    );
  }
  doc.moveDown(1);
  doc.fontSize(8).fillColor("#64748b").text(
    `Verificación: ENT/${del.deliveryNumber} · documento operativo no sensible`
  );
  doc.end();
  const buffer = await done;
  return {
    buffer,
    filename: `acta-entrega-${del.deliveryNumber}.pdf`,
  };
}

export async function generarPdfConsumoMateriales(requestId: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const req = await prisma.materialRequest.findUnique({
    where: { id: requestId },
    include: {
      ticket: { include: { cliente: true } },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      reconciliations: { orderBy: { createdAt: "desc" }, take: 1 },
      deliveries: {
        include: {
          items: { include: { inventario: true } },
        },
      },
    },
  });
  if (!req) throw new Error("Solicitud no encontrada");

  const rec = req.reconciliations[0];
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const done = bufferFromPdf(doc);
  encab(doc, "Acta de consumo / conciliación de materiales");
  doc.text(`Solicitud: ${req.requestNumber}`);
  doc.text(`OT: ${req.ticket.codigo}`);
  doc.text(`Cliente: ${req.ticket.cliente.nombre}`);
  doc.text(`Técnico: ${req.tecnico.usuario.nombre}`);
  doc.text(`Estado: ${req.status}`);
  if (rec) {
    doc.text(`Conciliado: ${formatDateTime(rec.createdAt)}`);
    doc.text(`Costo total: $${rec.totalCost}`);
    if (rec.exceptionAuthorized) {
      doc.text(`Excepción: ${rec.exceptionReason || "autorizada"}`);
    }
  }
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("#0f172a").text("Detalle", { underline: true });
  doc.fontSize(10).fillColor("#334155");
  for (const del of req.deliveries) {
    doc.text(`Entrega ${del.deliveryNumber}`);
    for (const it of del.items) {
      doc.text(
        `  ${it.inventario.nombre}: ent ${it.deliveredQty} · uso ${it.usedQty} · dev ${it.returnedQty} · daño ${it.damagedQty} · perd ${it.lostQty}`
      );
    }
  }
  doc.moveDown(1);
  doc.fontSize(8).fillColor("#64748b").text(
    `Verificación: CONS/${req.requestNumber} · documento operativo no sensible`
  );
  doc.end();
  const buffer = await done;
  return {
    buffer,
    filename: `acta-consumo-${req.requestNumber}.pdf`,
  };
}
