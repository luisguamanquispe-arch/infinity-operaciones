import { NextResponse } from "next/server";
import { filtrosDesdeUrl, sesionSatisfaccion } from "@/lib/satisfaccion/http";
import { datosExportacion } from "@/lib/satisfaccion/consultas";
import { exportarCsv, exportarExcelHtml, exportarPdf } from "@/lib/satisfaccion/exportar";

export async function GET(request: Request) {
  const acceso = await sesionSatisfaccion("consulta");
  if (!acceso.ok) return acceso.response;
  const url = new URL(request.url);
  const formato = url.searchParams.get("formato") || "csv";
  const paquete = await datosExportacion(filtrosDesdeUrl(url));
  if (formato === "pdf") {
    const pdf = await exportarPdf(paquete);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=satisfaccion.pdf",
      },
    });
  }
  if (formato === "xlsx") {
    const html = exportarExcelHtml(paquete);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": "attachment; filename=satisfaccion.xls",
      },
    });
  }
  return new NextResponse(exportarCsv(paquete), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=satisfaccion.csv",
    },
  });
}
