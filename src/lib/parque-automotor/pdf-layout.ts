import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { formatDateTime } from "@/lib/utils";

export const COLOR = {
  navy: "#1e3a8a",
  navyDark: "#172554",
  blue: "#1e40af",
  text: "#0f172a",
  muted: "#475569",
  line: "#cbd5e1",
  headerBg: "#1e3a8a",
  headerFg: "#ffffff",
  altRow: "#f8fafc",
  white: "#ffffff",
  warn: "#9a3412",
  danger: "#991b1b",
  ok: "#166534",
};

const LOGO = path.join(process.cwd(), "public", "brand", "logo-infinity.png");

export type ColumnaPdf = {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
};

export type KpiPdf = { label: string; value: string };

function bufferFromPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export function crearPdfCorporativo(opts: {
  landscape?: boolean;
  titulo: string;
  subtitulo: string;
  filtros?: string[];
  periodo?: string;
}) {
  const doc = new PDFDocument({
    size: "A4",
    layout: opts.landscape ? "landscape" : "portrait",
    margin: 36,
    bufferPages: true,
    info: {
      Title: opts.titulo,
      Author: "INFINITY OPERACIONES",
      Subject: opts.subtitulo,
      Creator: "INFINITY OPERACIONES · Parque Automotor",
    },
  });
  const marginX = 36;
  const contentTop = 96;
  const footerSpace = 40;
  const innerWidth = () => doc.page.width - marginX * 2;
  const bottomLimit = () => doc.page.height - footerSpace;

  const ensureSpace = (h: number) => {
    if (doc.y + h > bottomLimit()) {
      doc.addPage();
      doc.y = contentTop;
    }
  };

  const pintarMembrete = (pageIndex: number, total: number) => {
    const w = doc.page.width;
    doc.save();
    doc.rect(0, 0, w, 6).fill(COLOR.navy);
    doc.rect(0, 6, w, 78).fill(COLOR.white);
    if (fs.existsSync(LOGO)) {
      try {
        doc.image(LOGO, marginX, 14, { fit: [52, 52] });
      } catch {
        /* logo opcional */
      }
    }
    const textX = marginX + 64;
    doc
      .fillColor(COLOR.navy)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("INFINITY OPERACIONES", textX, 16, { width: w - textX - marginX });
    doc
      .fillColor(COLOR.text)
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(opts.titulo, textX, 32, { width: w - textX - marginX });
    doc
      .fillColor(COLOR.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(opts.subtitulo, textX, 50, { width: w - textX - 160 });
    doc.text(`Generado: ${formatDateTime(new Date())}`, w - marginX - 150, 16, {
      width: 150,
      align: "right",
    });
    if (opts.periodo) {
      doc.text(`Período: ${opts.periodo}`, w - marginX - 150, 30, {
        width: 150,
        align: "right",
      });
    }
    if (opts.filtros?.length) {
      doc.text(opts.filtros.join(" · "), textX, 64, {
        width: w - textX - marginX,
      });
    }
    doc
      .moveTo(marginX, 84)
      .lineTo(w - marginX, 84)
      .strokeColor(COLOR.line)
      .lineWidth(0.8)
      .stroke();

    doc
      .moveTo(marginX, doc.page.height - 32)
      .lineTo(w - marginX, doc.page.height - 32)
      .strokeColor(COLOR.line)
      .stroke();
    doc
      .fillColor(COLOR.muted)
      .font("Helvetica")
      .fontSize(7.5)
      .text(
        "INFINITY OPERACIONES  ·  Parque Automotor  ·  Uso interno",
        marginX,
        doc.page.height - 26,
        { width: innerWidth() - 90 }
      );
    doc.text(`Página ${pageIndex + 1} de ${total}`, w - marginX - 90, doc.page.height - 26, {
      width: 90,
      align: "right",
    });
    doc.restore();
  };

  doc.y = contentTop;

  const kpis = (items: KpiPdf[]) => {
    if (!items.length) return;
    const gap = 8;
    const cols = Math.min(4, items.length);
    const boxW = (innerWidth() - gap * (cols - 1)) / cols;
    const boxH = 38;
    let x = marginX;
    let y = doc.y;
    ensureSpace(boxH + 8);
    y = doc.y;
    items.forEach((item, i) => {
      if (i > 0 && i % cols === 0) {
        y += boxH + gap;
        x = marginX;
        ensureSpace(boxH + 8);
        y = doc.y;
      }
      doc.save();
      doc.roundedRect(x, y, boxW, boxH, 4).fillAndStroke(COLOR.altRow, COLOR.line);
      doc
        .fillColor(COLOR.muted)
        .font("Helvetica")
        .fontSize(7)
        .text(item.label.toUpperCase(), x + 8, y + 6, { width: boxW - 16 });
      doc
        .fillColor(COLOR.navy)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(item.value, x + 8, y + 18, { width: boxW - 16 });
      doc.restore();
      x += boxW + gap;
    });
    doc.y = y + boxH + 12;
  };

  const seccion = (titulo: string) => {
    ensureSpace(22);
    doc
      .fillColor(COLOR.navy)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(titulo, marginX, doc.y, { width: innerWidth() });
    doc.y += 4;
  };

  const parrafo = (texto: string, color = COLOR.muted) => {
    ensureSpace(16);
    doc.font("Helvetica").fontSize(8).fillColor(color).text(texto, marginX, doc.y, {
      width: innerWidth(),
    });
    doc.y += 4;
  };

  const tabla = (columnas: ColumnaPdf[], filas: string[][], optsTabla?: { resaltar?: boolean[] }) => {
    const totalW = columnas.reduce((s, c) => s + c.width, 0);
    const scale = innerWidth() / totalW;
    const cols = columnas.map((c) => ({ ...c, width: c.width * scale }));
    const headerH = 18;
    const drawHeader = () => {
      let x = marginX;
      const y = doc.y;
      doc.save();
      doc.rect(marginX, y, innerWidth(), headerH).fill(COLOR.headerBg);
      doc.fillColor(COLOR.headerFg).font("Helvetica-Bold").fontSize(7);
      for (const c of cols) {
        doc.text(c.label, x + 3, y + 5, {
          width: c.width - 6,
          align: c.align ?? "left",
          lineBreak: false,
        });
        x += c.width;
      }
      doc.restore();
      doc.y = y + headerH;
    };

    ensureSpace(headerH + 16);
    drawHeader();

    filas.forEach((fila, i) => {
      doc.font("Helvetica").fontSize(7.5);
      const heights = fila.map((cell, ci) =>
        doc.heightOfString(cell || "—", {
          width: cols[ci].width - 6,
          align: cols[ci].align ?? "left",
        })
      );
      const rowH = Math.max(14, ...heights) + 6;
      if (doc.y + rowH > bottomLimit()) {
        doc.addPage();
        doc.y = contentTop;
        drawHeader();
      }
      const y = doc.y;
      if (i % 2 === 1) {
        doc.save();
        doc.rect(marginX, y, innerWidth(), rowH).fill(COLOR.altRow);
        doc.restore();
      }
      let x = marginX;
      doc.font("Helvetica").fontSize(7.5);
      fila.forEach((cell, ci) => {
        const warn = optsTabla?.resaltar?.[i];
        doc.fillColor(warn ? COLOR.warn : COLOR.text);
        doc.text(cell || "—", x + 3, y + 3, {
          width: cols[ci].width - 6,
          align: cols[ci].align ?? "left",
        });
        x += cols[ci].width;
      });
      doc.y = y + rowH;
    });
    doc
      .moveTo(marginX, doc.y)
      .lineTo(marginX + innerWidth(), doc.y)
      .strokeColor(COLOR.line)
      .lineWidth(0.4)
      .stroke();
    doc.y += 10;
  };

  const finalizar = async () => {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      pintarMembrete(i, range.count);
    }
    doc.end();
    return bufferFromPdf(doc);
  };

  return {
    doc,
    marginX,
    innerWidth,
    contentTop,
    ensureSpace,
    kpis,
    seccion,
    parrafo,
    tabla,
    finalizar,
  };
}
