import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { importClientesFromCsv } from "@/lib/clientes-import-wispro";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Envíe el archivo como multipart/form-data (campo file)" },
        { status: 400 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo CSV (campo file)" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".txt")) {
      return NextResponse.json(
        { error: "Solo se aceptan archivos .csv (o .txt con formato CSV)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Archivo demasiado grande (máx. 10 MB)" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    let text = buf.toString("utf8");
    // Si parece Latin-1 / Windows-1252 con mojibake mínimo, dejamos UTF-8;
    // Wispro suele exportar UTF-8.
    if (text.includes("\u0000")) {
      text = buf.toString("latin1");
    }

    const result = await importClientesFromCsv(text, session.id);

    return NextResponse.json({
      ok: true,
      archivo: file.name,
      ...result,
      mensaje: `Importación lista: ${result.creados} creados, ${result.actualizados} actualizados, ${result.omitidos} omitidos/con error.`,
    });
  } catch (err) {
    console.error("[clientes/import]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al importar" },
      { status: 500 }
    );
  }
}
