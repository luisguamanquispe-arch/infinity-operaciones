import { prisma } from "@/lib/prisma";
import {
  actualizarCliente,
  crearCliente,
  type ClienteInput,
} from "@/lib/cliente-crud";
import { esClienteInfraestructura } from "@/lib/cliente-infraestructura";
import { normalizarCedula } from "@/lib/cedula-ec";

export type ImportError = { fila: number; motivo: string; cedula?: string };
export type ImportResult = {
  totalFilas: number;
  creados: number;
  actualizados: number;
  omitidos: number;
  errores: ImportError[];
  columnasDetectadas: string[];
  columnasMapeadas: string[];
};

/**
 * Aliases → campo ClienteInput.
 * Incluye encabezados reales del export Wispro Cloud (CSV/Excel).
 * @see https://doc.cloud.wispro.co/docs/exportar-clientes
 */
const HEADER_ALIASES: Record<string, keyof ClienteInput | "_ignore"> = {
  // Cédula / documento
  cedula: "cedula",
  identification: "cedula",
  identificacion: "cedula",
  national_identification_number: "cedula",
  nationalidentificationnumber: "cedula",
  dni: "cedula",
  ci: "cedula",
  documento: "cedula",
  documentocedula: "cedula",
  documentodeidentidad: "cedula",
  nrodocumento: "cedula",
  numero_de_documento: "cedula",
  numerodedocumento: "cedula",
  // Nombre
  nombre: "nombre",
  name: "nombre",
  client_name: "nombre",
  cliente: "nombre",
  nombre_cliente: "nombre",
  nombreycliente: "nombre",
  nombresyapellidos: "nombre",
  // Teléfono
  telefono: "telefono",
  phone: "telefono",
  phone_number: "telefono",
  mobile: "telefono",
  celular: "telefono",
  phone_mobile: "telefono",
  phonemobile: "telefono",
  tel: "telefono",
  telefonofijo: "telefono",
  // Plan
  plan: "plan",
  plan_name: "plan",
  nombre_plan: "plan",
  nombreplan: "plan",
  // Dirección
  direccion: "direccion",
  address: "direccion",
  domicilio: "direccion",
  direccionpostal: "direccion",
  // Sector / barrio / zona / ciudad (Wispro)
  sector: "sector",
  neighborhood: "sector",
  barrio: "sector",
  zona: "sector",
  zone: "sector",
  zone_name: "sector",
  ciudad: "sector",
  city: "sector",
  // Referencia
  referencia: "referencia",
  reference: "referencia",
  observaciones: "referencia",
  details: "referencia",
  datoadicional: "referencia",
  dato_adicional: "referencia",
  // Infra
  nodo: "nodo",
  node: "nodo",
  caja_nap: "cajaNap",
  cajanap: "cajaNap",
  nap: "cajaNap",
  caja: "cajaNap",
  puerto: "puerto",
  port: "puerto",
  onu: "onuSerial",
  serial_onu: "onuSerial",
  onu_serial: "onuSerial",
  serialonu: "onuSerial",
  potencia: "potencia",
  rx: "potencia",
  optical_power: "potencia",
  potencia_optica: "potencia",
  // Geo Wispro
  lat: "lat",
  latitude: "lat",
  latitud: "lat",
  lng: "lng",
  lon: "lng",
  longitude: "lng",
  longitud: "lng",
  // Estado
  activo: "activo",
  active: "activo",
  status: "activo",
  estado: "activo",
  // Columnas Wispro a ignorar (no error)
  iddecliente: "_ignore",
  id: "_ignore",
  idpersonalizable: "_ignore",
  custom_id: "_ignore",
  public_id: "_ignore",
  email: "_ignore",
  correo: "_ignore",
  facturacionhabilitada: "_ignore",
  tipodefactura: "_ignore",
  condicionimpositiva: "_ignore",
  numerodeidentificaciontributaria: "_ignore",
  numerodefacturasimpagas: "_ignore",
  balancedefacturasimpagas: "_ignore",
  informaciondepasareladepago: "_ignore",
  fechadecreacion: "_ignore",
  ultimamodificacion: "_ignore",
  provinciasestadoregion: "_ignore",
  state: "_ignore",
};

export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function detectDelimiter(firstLine: string): "," | ";" | "\t" {
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return "\t";
  return semis > commas ? ";" : ",";
}

/** Parse CSV con comillas, BOM y separador , ; o tab. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  let raw = text;
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  const lines: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (inQuotes && raw[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && raw[i + 1] === "\n") i++;
      lines.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.length > 0 || raw.endsWith("\n")) lines.push(cur);

  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const delim = detectDelimiter(nonEmpty[0]);

  function splitLine(line: string): string[] {
    const cells: string[] = [];
    let cell = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          q = !q;
        }
        continue;
      }
      if (ch === delim && !q) {
        cells.push(cell.trim());
        cell = "";
        continue;
      }
      cell += ch;
    }
    cells.push(cell.trim());
    return cells;
  }

  const headers = splitLine(nonEmpty[0]).map((h) => h.trim());
  const rows = nonEmpty.slice(1).map(splitLine);
  return { headers, rows };
}

function parseActivo(raw: string | undefined): boolean | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "si", "sí", "yes", "activo", "active", "enabled", "habilitado"].includes(v))
    return true;
  if (
    ["0", "false", "no", "inactivo", "inactive", "disabled", "suspendido", "suspended", "deshabilitado"].includes(
      v
    )
  )
    return false;
  return undefined;
}

function parseNumber(raw: string | undefined): number | null | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(String(raw).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function buildFieldMap(headers: string[]): {
  map: Map<number, keyof ClienteInput>;
  mappedLabels: string[];
} {
  const map = new Map<number, keyof ClienteInput>();
  const mappedLabels: string[] = [];
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    const key = HEADER_ALIASES[norm];
    if (key && key !== "_ignore") {
      map.set(i, key);
      mappedLabels.push(`${h} → ${key}`);
    }
  });
  return { map, mappedLabels };
}

function rowToInput(
  cells: string[],
  fieldMap: Map<number, keyof ClienteInput>
): Partial<ClienteInput> {
  const out: Partial<ClienteInput> = {};
  // Preferir celular sobre teléfono fijo si ambos existen: recorrer por índice
  const entries = [...fieldMap.entries()].sort((a, b) => a[0] - b[0]);
  for (const [idx, field] of entries) {
    const raw = cells[idx] ?? "";
    if (field === "activo") {
      const a = parseActivo(raw);
      if (a !== undefined) out.activo = a;
      continue;
    }
    if (field === "potencia" || field === "lat" || field === "lng") {
      const n = parseNumber(raw);
      if (n !== undefined) out[field] = n;
      continue;
    }
    if (raw.trim() === "") continue;
    // Si ya hay teléfono y esta celda es más corta (fijo vacío), no pisar
    if (field === "telefono" && out.telefono && raw.trim().length < out.telefono.length) {
      continue;
    }
    (out as Record<string, unknown>)[field] = raw.trim();
  }
  return out;
}

/** Detecta Excel binario (ZIP/XLSX o OLE/XLS). */
export function looksLikeExcel(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  if (buf[0] === 0x50 && buf[1] === 0x4b) return true;
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return true;
  return false;
}

export function decodeCsvBuffer(buf: Buffer): string {
  // UTF-8 con BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString("utf8");
  }
  let text = buf.toString("utf8");
  const bad = (text.match(/\uFFFD/g) || []).length;
  if (bad > 3 || text.includes("\u0000")) {
    text = buf.toString("latin1");
  }
  return text;
}

/** Lee la primera hoja de un .xlsx / .xls a encabezados + filas de texto. */
export function parseExcelBuffer(buf: Buffer): { headers: string[]; rows: string[][] } {
  // Import dinámico tipado mínimo (SheetJS)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as {
    read: (data: Buffer, opts: { type: string; cellDates?: boolean }) => {
      SheetNames: string[];
      Sheets: Record<string, unknown>;
    };
    utils: {
      sheet_to_json: (
        sheet: unknown,
        opts: { header: number; defval: string; raw: boolean }
      ) => string[][];
    };
  };

  const workbook = XLSX.read(buf, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];

  const nonEmpty = matrix.filter((row) =>
    row.some((cell) => String(cell ?? "").trim().length > 0)
  );
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => String(h ?? "").trim());
  const rows = nonEmpty.slice(1).map((row) =>
    headers.map((_, i) => String(row[i] ?? "").trim())
  );
  return { headers, rows };
}

export async function importClientesFromRows(
  headers: string[],
  rows: string[][],
  usuarioId?: string
): Promise<ImportResult> {
  if (headers.length === 0) {
    return {
      totalFilas: 0,
      creados: 0,
      actualizados: 0,
      omitidos: 0,
      errores: [{ fila: 0, motivo: "Archivo vacío o sin encabezados" }],
      columnasDetectadas: [],
      columnasMapeadas: [],
    };
  }

  const { map: fieldMap, mappedLabels } = buildFieldMap(headers);
  const mapped = new Set(fieldMap.values());
  const required: (keyof ClienteInput)[] = ["cedula", "nombre", "telefono", "direccion", "sector"];
  const missingHeaders = required.filter((r) => !mapped.has(r));
  if (missingHeaders.length > 0) {
    return {
      totalFilas: rows.length,
      creados: 0,
      actualizados: 0,
      omitidos: rows.length,
      columnasDetectadas: headers,
      columnasMapeadas: mappedLabels,
      errores: [
        {
          fila: 1,
          motivo:
            `Faltan columnas obligatorias: ${missingHeaders.join(", ")}. ` +
            `Encabezados detectados: ${headers.join(" | ")}. ` +
            `En Wispro: Clientes → Exportar → CSV o Excel. Columnas típicas: Documento/Cédula, Nombre, Teléfono o Celular, Dirección, Barrio o Zona.`,
        },
      ],
    };
  }

  let creados = 0;
  let actualizados = 0;
  let omitidos = 0;
  const errores: ImportError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const fila = i + 2;
    const partial = rowToInput(rows[i], fieldMap);

    if (
      !partial.cedula &&
      !partial.nombre &&
      !partial.telefono &&
      !partial.direccion &&
      !partial.sector
    ) {
      omitidos++;
      continue;
    }

    const input: ClienteInput = {
      cedula: partial.cedula || "",
      nombre: partial.nombre || "",
      telefono: partial.telefono || "",
      plan: partial.plan || "Sin plan",
      direccion: partial.direccion || "",
      sector: partial.sector || "",
      referencia: partial.referencia ?? null,
      nodo: partial.nodo ?? null,
      lat: partial.lat ?? null,
      lng: partial.lng ?? null,
      cajaNap: partial.cajaNap ?? null,
      puerto: partial.puerto ?? null,
      onuSerial: partial.onuSerial ?? null,
      potencia: partial.potencia ?? null,
      activo: partial.activo !== false,
    };

    try {
      const cedulaNorm = normalizarCedula(input.cedula);
      let cedulaUsar = cedulaNorm;
      if (cedulaNorm.length === 13 && cedulaNorm.endsWith("001")) {
        cedulaUsar = cedulaNorm.slice(0, 10);
        input.cedula = cedulaUsar;
      }

      if (esClienteInfraestructura(cedulaUsar)) {
        errores.push({
          fila,
          cedula: cedulaUsar,
          motivo: "Cédula reservada de infraestructura",
        });
        omitidos++;
        continue;
      }

      const existente = await prisma.cliente.findUnique({ where: { cedula: cedulaUsar } });
      if (existente) {
        await actualizarCliente(existente.id, { ...input, cedula: cedulaUsar }, usuarioId);
        actualizados++;
      } else {
        await crearCliente({ ...input, cedula: cedulaUsar }, usuarioId);
        creados++;
      }
    } catch (err) {
      omitidos++;
      errores.push({
        fila,
        cedula: partial.cedula,
        motivo: err instanceof Error ? err.message : "Error al importar fila",
      });
    }
  }

  return {
    totalFilas: rows.length,
    creados,
    actualizados,
    omitidos,
    errores,
    columnasDetectadas: headers,
    columnasMapeadas: mappedLabels,
  };
}

export async function importClientesFromCsv(
  csvText: string,
  usuarioId?: string
): Promise<ImportResult> {
  const { headers, rows } = parseCsv(csvText);
  return importClientesFromRows(headers, rows, usuarioId);
}

/** CSV o Excel (.xlsx / .xls) exportado desde Wispro. */
export async function importClientesFromBuffer(
  buf: Buffer,
  fileName: string,
  usuarioId?: string
): Promise<ImportResult> {
  const name = fileName.toLowerCase();
  const isExcelExt =
    name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".ods");

  if (isExcelExt || looksLikeExcel(buf)) {
    if (name.endsWith(".ods")) {
      throw new Error("No se admite ODS. Exporte desde Wispro en CSV o Excel (.xlsx).");
    }
    const { headers, rows } = parseExcelBuffer(buf);
    return importClientesFromRows(headers, rows, usuarioId);
  }

  const text = decodeCsvBuffer(buf);
  return importClientesFromCsv(text, usuarioId);
}
