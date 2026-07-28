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
};

/** Aliases CSV (normalizados) → campo ClienteInput */
const HEADER_ALIASES: Record<string, keyof ClienteInput> = {
  cedula: "cedula",
  identification: "cedula",
  identificacion: "cedula",
  dni: "cedula",
  ci: "cedula",
  documento: "cedula",
  nombre: "nombre",
  name: "nombre",
  client_name: "nombre",
  cliente: "nombre",
  nombre_cliente: "nombre",
  telefono: "telefono",
  phone: "telefono",
  mobile: "telefono",
  celular: "telefono",
  tel: "telefono",
  plan: "plan",
  plan_name: "plan",
  nombre_plan: "plan",
  direccion: "direccion",
  address: "direccion",
  domicilio: "direccion",
  sector: "sector",
  neighborhood: "sector",
  barrio: "sector",
  zona: "sector",
  referencia: "referencia",
  reference: "referencia",
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
  lat: "lat",
  latitude: "lat",
  latitud: "lat",
  lng: "lng",
  lon: "lng",
  longitude: "lng",
  longitud: "lng",
  activo: "activo",
  active: "activo",
  status: "activo",
  estado: "activo",
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function detectDelimiter(firstLine: string): "," | ";" {
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

/** Parse CSV simple con comillas y salto de línea entre comillas. */
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
  if (["1", "true", "si", "sí", "yes", "activo", "active", "enabled"].includes(v)) return true;
  if (["0", "false", "no", "inactivo", "inactive", "disabled", "suspendido", "suspended"].includes(v))
    return false;
  return undefined;
}

function parseNumber(raw: string | undefined): number | null | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(String(raw).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function buildFieldMap(headers: string[]): Map<number, keyof ClienteInput> {
  const map = new Map<number, keyof ClienteInput>();
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[normalizeHeader(h)];
    if (key) map.set(i, key);
  });
  return map;
}

function rowToInput(
  cells: string[],
  fieldMap: Map<number, keyof ClienteInput>
): Partial<ClienteInput> {
  const out: Partial<ClienteInput> = {};
  for (const [idx, field] of fieldMap) {
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
    (out as Record<string, unknown>)[field] = raw.trim();
  }
  return out;
}

export async function importClientesFromCsv(
  csvText: string,
  usuarioId?: string
): Promise<ImportResult> {
  const { headers, rows } = parseCsv(csvText);
  if (headers.length === 0) {
    return {
      totalFilas: 0,
      creados: 0,
      actualizados: 0,
      omitidos: 0,
      errores: [{ fila: 0, motivo: "CSV vacío o sin encabezados" }],
    };
  }

  const fieldMap = buildFieldMap(headers);
  const mapped = new Set(fieldMap.values());
  const required: (keyof ClienteInput)[] = ["cedula", "nombre", "telefono", "direccion", "sector"];
  const missingHeaders = required.filter((r) => !mapped.has(r));
  if (missingHeaders.length > 0) {
    return {
      totalFilas: rows.length,
      creados: 0,
      actualizados: 0,
      omitidos: rows.length,
      errores: [
        {
          fila: 1,
          motivo: `Faltan columnas obligatorias en el encabezado: ${missingHeaders.join(", ")}. Descargue la plantilla o renombre las columnas.`,
        },
      ],
    };
  }

  let creados = 0;
  let actualizados = 0;
  let omitidos = 0;
  const errores: ImportError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const fila = i + 2; // 1 = header
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
      if (esClienteInfraestructura(cedulaNorm)) {
        errores.push({
          fila,
          cedula: cedulaNorm,
          motivo: "Cédula reservada de infraestructura",
        });
        omitidos++;
        continue;
      }

      const existente = await prisma.cliente.findUnique({ where: { cedula: cedulaNorm } });
      if (existente) {
        await actualizarCliente(existente.id, input, usuarioId);
        actualizados++;
      } else {
        await crearCliente(input, usuarioId);
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
  };
}
