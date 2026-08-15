import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { ESTADO_LABELS, TIPO_LABELS, formatDateShort, formatDateTime, formatDuration } from "@/lib/utils";
import { FOTO_LABELS } from "@/lib/utils";
import { obtenerHistorialSoportesParaPdf } from "@/lib/historial-soportes-query";
import { materialesParaReporte } from "@/lib/materiales-reporte";

function bufferFromPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function rangoLabel(rango: string | undefined) {
  if (rango === "7d") return "Últimos 7 días";
  if (rango === "30d") return "Últimos 30 días";
  if (rango === "90d") return "Últimos 90 días";
  if (rango === "anio") return "Este año";
  if (rango === "custom") return "Periodo personalizado";
  return "Todo el historial";
}

export async function generarPdfHistorialSoportes(
  clienteId: string,
  search: URLSearchParams
): Promise<{ buffer: Buffer; filename: string }> {
  const data = await obtenerHistorialSoportesParaPdf(clienteId, search, 40);
  if (!data) throw new Error("Cliente no encontrado");

  const detalles = data.items.length
    ? await prisma.ticket.findMany({
        where: { id: { in: data.items.map((i) => i.id) } },
        include: {
          orden: {
            include: {
              firma: { select: { nombreCliente: true, firmadoEn: true, imagenData: true } },
              fotografias: { select: { tipo: true } },
              materiales: { include: { inventario: true } },
            },
          },
        },
      })
    : [];
  const porId = new Map(detalles.map((t) => [t.id, t]));

  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const done = bufferFromPdf(doc);

  const logo = path.join(process.cwd(), "public", "brand", "logo-infinity.png");
  if (fs.existsSync(logo)) {
    try {
      doc.image(logo, 48, 40, { width: 72 });
    } catch {
      /* logo opcional */
    }
  }

  doc.fontSize(16).fillColor("#006B7A").text("INFINITY INTERNET", 130, 45);
  doc.fontSize(11).fillColor("#334155").text("Historial de soportes por cliente", 130, 66);
  doc.fontSize(8).fillColor("#64748b").text(`Generado: ${formatDateTime(new Date())}`, 130, 82);

  doc.moveDown(3);
  doc.fillColor("#0f172a").fontSize(13).text(data.cliente.nombre);
  doc.fontSize(10).fillColor("#334155");
  doc.text(`Cédula: ${data.cliente.cedula}  ·  Plan: ${data.cliente.plan}`);
  doc.text(`Teléfono: ${data.cliente.telefono}`);
  doc.text(`Dirección: ${data.cliente.direccion}  ·  ${data.cliente.sector}`);
  doc.text(`Periodo: ${rangoLabel(data.filtros.rango)}`);
  doc.moveDown();

  const r = data.resumen;
  doc.fontSize(12).fillColor("#0f172a").text("Resumen estadístico", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#334155");
  doc.text(`Total soportes: ${r.total}    Últimos 30 días: ${r.ultimos30}    Últimos 90: ${r.ultimos90}    Año: ${r.anio}`);
  doc.text(
    `Tiempo promedio de atención: ${r.tiempoPromedioMin != null ? `${r.tiempoPromedioMin} min` : "—"}    Resolución: ${r.tiempoResolucionPromedioMin != null ? `${r.tiempoResolucionPromedioMin} min` : "—"}`
  );
  doc.text(`Problema frecuente: ${r.problemaFrecuente ?? "—"}    Reincidencias: ${r.reincidencias}`);
  if (r.tecnicoMasFrecuente) {
    doc.text(`Técnico más frecuente: ${r.tecnicoMasFrecuente.nombre} (${r.tecnicoMasFrecuente.cantidad})`);
  }
  doc.text(`Alerta: ${r.alerta.label}`);
  if (r.alerta.detalle) doc.text(r.alerta.detalle);
  doc.moveDown();

  if (r.tecnicos.length) {
    doc.fontSize(11).fillColor("#0f172a").text("Técnicos");
    doc.fontSize(10).fillColor("#334155");
    for (const t of r.tecnicos.slice(0, 12)) {
      doc.text(`• ${t.nombre} — ${t.cantidad}`);
    }
    doc.moveDown();
  }

  doc.fontSize(12).fillColor("#0f172a").text("Lista de soportes", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor("#334155");
  for (const item of data.items) {
    doc.text(
      `${formatDateShort(item.createdAt)}  ${item.codigo}  ${item.motivo || "—"}  ·  ${item.tecnicosLabel}  ·  ${ESTADO_LABELS[item.estado] ?? item.estado}  ·  ${item.resultado}`
    );
  }
  if (data.omitidos > 0) {
    doc.moveDown(0.3);
    doc.fontSize(8).fillColor("#64748b").text(`Se omitieron ${data.omitidos} soportes adicionales en este PDF (límite 40).`);
  }

  for (const item of data.items) {
    const full = porId.get(item.id);
    doc.addPage();
    doc.fontSize(13).fillColor("#006B7A").text(`Soporte ${item.codigo}`);
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#334155");
    doc.text(`Tipo: ${TIPO_LABELS[item.tipo] ?? item.tipo}    Estado: ${ESTADO_LABELS[item.estado] ?? item.estado}`);
    doc.text(`Motivo: ${item.motivo || "—"}`);
    doc.text(`Técnico: ${item.tecnicosLabel}`);
    doc.text(`Creado: ${formatDateTime(item.createdAt)}`);
    if (item.iniciadoEn) doc.text(`Inicio: ${formatDateTime(item.iniciadoEn)}`);
    if (item.finalizadoEn) doc.text(`Fin: ${formatDateTime(item.finalizadoEn)}`);
    if (item.duracionSegundos > 0) doc.text(`Duración: ${formatDuration(item.duracionSegundos)}`);
    doc.text(`Resultado: ${item.resultado}`);
    doc.moveDown(0.4);

    const resumenTrabajo = full?.orden?.resumenTrabajo?.trim();
    if (resumenTrabajo) {
      doc.fontSize(11).fillColor("#0f172a").text("Reporte del técnico", { underline: true });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor("#334155").text(resumenTrabajo, { align: "justify" });
      doc.moveDown();
    }

    const mats = materialesParaReporte(full?.orden?.materiales ?? []);
    if (mats.length) {
      doc.fontSize(11).fillColor("#0f172a").text("Materiales y equipos", { underline: true });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor("#334155");
      for (const m of mats) {
        const extra = [m.marca, m.modelo, m.serie].filter(Boolean).join(" · ");
        doc.text(`• ${m.inventario.nombre}: ${m.cantidad} ${m.inventario.unidad}${extra ? ` (${extra})` : ""}`);
      }
      doc.moveDown();
    }

    const fotos = full?.orden?.fotografias ?? [];
    if (fotos.length) {
      doc.fontSize(11).fillColor("#0f172a").text("Evidencia fotográfica", { underline: true });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor("#334155");
      for (const f of fotos) {
        doc.text(`• ${FOTO_LABELS[f.tipo] || f.tipo}`);
      }
      doc.moveDown();
    }

    const firma = full?.orden?.firma;
    if (firma) {
      doc.fontSize(11).fillColor("#0f172a").text("Firma del cliente", { underline: true });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor("#334155");
      doc.text(`Firmante: ${firma.nombreCliente}`);
      doc.text(`Fecha: ${formatDateTime(firma.firmadoEn)}`);
      if (firma.imagenData?.startsWith("data:image")) {
        try {
          const b64 = firma.imagenData.replace(/^data:image\/\w+;base64,/, "");
          doc.image(Buffer.from(b64, "base64"), { fit: [220, 90] });
        } catch {
          /* ignore */
        }
      }
    }
  }

  doc.end();
  const buffer = await done;
  const slug = data.cliente.nombre.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 40);
  return { buffer, filename: `historial-soportes-${slug}.pdf` };
}
