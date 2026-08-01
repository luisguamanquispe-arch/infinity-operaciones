import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import {
  IR_EQUIPO_LABELS,
  IR_ESTADO_LABELS,
  IR_PRIORIDAD_LABELS,
  IR_RESULTADO_LABELS,
  IR_TIPO_FOTO_LABELS,
  IR_TIPO_FIRMA_LABELS,
  IR_TIPO_TRABAJO_LABELS,
  formatoTiempoMinutos,
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

function section(doc: PDFKit.PDFDocument, title: string) {
  if (doc.y > 700) doc.addPage();
  doc.moveDown(0.4);
  doc.fontSize(12).fillColor("#0f172a").text(title, { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(10).fillColor("#334155");
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
      equipos: true,
      participantes: {
        include: { tecnico: { include: { usuario: { select: { nombre: true } } } } },
      },
      clientesAfectados: {
        include: { cliente: { select: { nombre: true, cedula: true } } },
      },
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

  doc.fontSize(16).fillColor("#006B7A").text("INFINITY INTERNET", { align: "center" });
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
  doc.text(`Tiempo empleado: ${formatoTiempoMinutos(reporte.tiempoMinutos)}`);
  doc.text(`Técnico responsable: ${reporte.tecnico.usuario.nombre}`);
  if (reporte.participantes.length) {
    doc.text(
      `Participantes: ${reporte.participantes.map((p) => p.tecnico.usuario.nombre).join(", ")}`
    );
  }
  doc.text(`Supervisor: ${reporte.supervisor?.nombre ?? "—"}`);
  doc.text(`Estado: ${IR_ESTADO_LABELS[reporte.estado]}`);
  doc.text(`Prioridad: ${IR_PRIORIDAD_LABELS[reporte.prioridad]}`);
  doc.text(`Tipo de trabajo: ${tipoLabel}`);
  if (reporte.resultado) {
    doc.text(`Resultado: ${IR_RESULTADO_LABELS[reporte.resultado]}`);
  }

  section(doc, "Ubicación");
  doc.text(
    `${reporte.provincia} / ${reporte.canton} / ${reporte.parroquia} — ${reporte.sector}`
  );
  doc.text(reporte.direccion);
  if (reporte.lat != null && reporte.lng != null) {
    doc.text(`GPS: ${reporte.lat}, ${reporte.lng}`);
  }

  section(doc, "Infraestructura afectada");
  const infra = [
    ["Nodo", reporte.nodo],
    ["NAP", reporte.nap],
    ["CTO", reporte.cto],
    ["ODF", reporte.odf],
    ["Splitter", reporte.splitter],
    ["Manga", reporte.manga],
    ["Caja de paso", reporte.cajaPaso],
    ["Tramo de fibra", reporte.tramoFibra],
    ["Hilos", reporte.cantidadHilos != null ? String(reporte.cantidadHilos) : null],
    [
      "Longitud afectada (m)",
      reporte.longitudAfectadaM != null ? String(reporte.longitudAfectadaM) : null,
    ],
    [
      "Km intervenidos",
      reporte.kmRedIntervenida != null ? String(reporte.kmRedIntervenida) : null,
    ],
  ] as const;
  for (const [label, val] of infra) {
    if (val) doc.text(`${label}: ${val}`);
  }
  if (!infra.some(([, v]) => v)) doc.text("—");

  if (reporte.clientesAfectados.length) {
    section(doc, "Clientes afectados");
    for (const c of reporte.clientesAfectados) {
      doc.text(`• ${c.cliente.nombre} (${c.cliente.cedula})`);
    }
  }

  section(doc, "Descripción del problema");
  doc.text(reporte.descripcion || "—", { align: "justify" });

  section(doc, "Trabajos realizados");
  doc.text(reporte.trabajosRealizados || "—", { align: "justify" });

  if (reporte.equipos.length) {
    section(doc, "Equipos utilizados");
    for (const e of reporte.equipos) {
      doc.text(
        `• ${IR_EQUIPO_LABELS[e.tipo]}${e.detalle ? ` — ${e.detalle}` : ""}`
      );
    }
  }

  if (reporte.materiales.length) {
    section(doc, "Materiales utilizados");
    for (const m of reporte.materiales) {
      doc.text(`• ${m.material}: ${m.cantidad} ${m.unidad}`);
    }
  }

  if (reporte.observaciones) {
    section(doc, "Observaciones");
    doc.text(reporte.observaciones, { align: "justify" });
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
    section(doc, "Firmas");
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
