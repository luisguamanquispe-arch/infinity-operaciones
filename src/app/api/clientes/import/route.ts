import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { importClientesFromBuffer } from "@/lib/clientes-import-wispro";
import {
  MSG_SOLO_ADMIN_IMPORTAR_WISPRO,
  puedeImportarWispro,
} from "@/lib/cliente-permisos";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number"
  );
}

export async function POST(request: Request) {
  const session = await getFullSession();
  if (!session || !puedeImportarWispro(session.rol)) {
    return NextResponse.json({ error: MSG_SOLO_ADMIN_IMPORTAR_WISPRO }, { status: 403 });
  }

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "No se pudo leer el archivo (cuerpo demasiado grande o no es multipart). Máximo 25 MB.",
        },
        { status: 400 }
      );
    }

    const raw = form.get("file") ?? form.get("csv") ?? form.get("archivo");
    if (!isUploadFile(raw)) {
      return NextResponse.json(
        {
          error:
            "Falta el archivo. Envíe el campo file con un CSV o Excel exportado desde Wispro.",
        },
        { status: 400 }
      );
    }

    const fileName = raw.name || "clientes-wispro.csv";
    const nameLower = fileName.toLowerCase();

    const okExt =
      !nameLower ||
      nameLower.endsWith(".csv") ||
      nameLower.endsWith(".txt") ||
      nameLower.endsWith(".tsv") ||
      nameLower.endsWith(".xlsx") ||
      nameLower.endsWith(".xls");

    if (!okExt) {
      return NextResponse.json(
        {
          error:
            "Formato no admitido. Use CSV (.csv) o Excel (.xlsx / .xls) exportado desde Wispro.",
        },
        { status: 400 }
      );
    }

    if (raw.size > MAX_BYTES) {
      return NextResponse.json({ error: "Archivo demasiado grande (máx. 25 MB)" }, { status: 400 });
    }

    const buf = Buffer.from(await raw.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }

    const result = await importClientesFromBuffer(buf, fileName, session.id);

    return NextResponse.json({
      ok: true,
      archivo: fileName,
      formato: nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls") ? "excel" : "csv",
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
