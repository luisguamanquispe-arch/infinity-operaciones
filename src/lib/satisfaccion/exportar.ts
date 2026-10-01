import PDFDocument from "pdfkit";
import type { datosExportacion } from "./consultas";

type Paquete = Awaited<ReturnType<typeof datosExportacion>>;

export function exportarCsv(paquete: Paquete): string {
  const lineas = [
    "periodo,encuestas,enviadas,respondidas,tasa_respuesta,promedio,csat,solucion,insatisfechos,seguimientos_abiertos,seguimientos_cerrados",
    [
      "filtro",
      paquete.resumen.encuestas,
      paquete.resumen.enviadas,
      paquete.resumen.respuestas,
      paquete.resumen.tasaRespuesta ?? "",
      paquete.resumen.promedio ?? "",
      paquete.resumen.csat ?? "",
      paquete.resumen.solucion ?? "",
      paquete.insatisfechos,
      paquete.abiertos,
      paquete.cerrados,
    ].join(","),
    "",
    "codigo,cliente,tecnico,servicio,zona,estado,rating,tecnico_rating,solucionado,comentario,creada,respondida",
    ...paquete.filas.map((fila) =>
      [
        fila.ticket.codigo,
        fila.cliente.nombre,
        fila.tecnico?.usuario.nombre || "",
        fila.tipoServicio,
        fila.zona || "",
        fila.status,
        fila.ratingGeneral ?? "",
        fila.ratingTecnico ?? "",
        fila.solucionado || "",
        csvCampo(fila.comentario || ""),
        fila.createdAt.toISOString(),
        fila.answeredAt?.toISOString() || "",
      ].join(",")
    ),
  ];
  return `\uFEFF${lineas.join("\n")}`;
}

export function exportarExcelHtml(paquete: Paquete): string {
  const filas = paquete.filas
    .map(
      (fila) =>
        `<tr><td>${esc(fila.ticket.codigo)}</td><td>${esc(fila.cliente.nombre)}</td><td>${esc(
          fila.tecnico?.usuario.nombre || ""
        )}</td><td>${esc(fila.tipoServicio)}</td><td>${fila.ratingGeneral ?? ""}</td><td>${esc(
          fila.solucionado || ""
        )}</td><td>${esc(fila.comentario || "")}</td></tr>`
    )
    .join("");
  return `<html><head><meta charset="utf-8"></head><body><table><tr><th>OT</th><th>Cliente</th><th>Técnico</th><th>Servicio</th><th>Calificación</th><th>Solucionado</th><th>Comentario</th></tr>${filas}</table></body></html>`;
}

export function exportarPdf(paquete: Paquete): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(16).text("INFINITY INTERNET — Satisfacción del cliente");
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Encuestas: ${paquete.resumen.encuestas}`);
    doc.text(`Enviadas: ${paquete.resumen.enviadas}`);
    doc.text(`Respondidas: ${paquete.resumen.respuestas}`);
    doc.text(`Tasa de respuesta: ${fmt(paquete.resumen.tasaRespuesta)}%`);
    doc.text(`Promedio: ${fmt(paquete.resumen.promedio)}`);
    doc.text(`CSAT: ${fmt(paquete.resumen.csat)}%`);
    doc.text(`Solución completa: ${fmt(paquete.resumen.solucion)}%`);
    doc.text(`Insatisfechos: ${paquete.insatisfechos}`);
    doc.text(`Seguimientos abiertos: ${paquete.abiertos}`);
    doc.text(`Seguimientos cerrados: ${paquete.cerrados}`);
    doc.moveDown();
    doc.text("Distribución");
    for (const item of paquete.distribucion) {
      doc.text(`${item.estrella} estrellas: ${item.pct}% (${item.cantidad})`);
    }
    doc.moveDown();
    doc.text("Comentarios");
    for (const fila of paquete.filas.filter((f) => f.comentario).slice(0, 40)) {
      doc.text(`${fila.ticket.codigo}: ${fila.comentario}`.slice(0, 240));
    }
    doc.end();
  });
}

function fmt(valor: number | null) {
  return valor == null ? "s/d" : String(valor);
}

function csvCampo(valor: string) {
  return `"${valor.replace(/"/g, '""')}"`;
}

function esc(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
