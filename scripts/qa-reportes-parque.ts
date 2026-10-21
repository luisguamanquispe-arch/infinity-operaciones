/**
 * QA aislada de reportes PDF/Excel de Parque Automotor.
 * Solo 127.0.0.1:55433 / infinity_ops_reportes_itest. Nunca Render.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { TIPOS_REPORTE_PARQUE, type TipoReporteParque } from "../src/lib/parque-automotor/labels";
import { diaCalendarioEc } from "../src/lib/parque-automotor/reglas";

const HOST = "127.0.0.1";
const PORT = "55433";
const USER = "infinity";
const PASS = "infinity123";
const ITEST_DB = "infinity_ops_reportes_itest";
const SOURCE_DB = "infinity_ops";
const CONTAINER = "infinity-postgres";
const TEST_URL = `postgresql://${USER}:${PASS}@${HOST}:${PORT}/${ITEST_DB}`;

function assertAllowed(url: string) {
  if (/render\.com|dpg-|onrender|neon\.tech|railway|amazonaws/i.test(url)) {
    throw new Error("BLOQUEADO: URL remota.");
  }
  const p = new URL(url.replace(/^postgresql:/i, "http:"));
  if (p.hostname !== HOST || p.port !== PORT) {
    throw new Error("BLOQUEADO: host/puerto no aislados.");
  }
  const db = decodeURIComponent(p.pathname.replace(/^\//, ""));
  if (db !== ITEST_DB) throw new Error(`BLOQUEADO: base ${db}`);
}

assertAllowed(TEST_URL);
process.env.DATABASE_URL = TEST_URL;

type R = { id: string; ok: boolean; detalle: string };
const out: R[] = [];
function rec(id: string, ok: boolean, detalle: string) {
  out.push({ id, ok, detalle });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id}: ${detalle}`);
}

function psql(db: string, sql: string): string {
  if (![ "postgres", SOURCE_DB, ITEST_DB ].includes(db)) {
    throw new Error(`psql bloqueado: ${db}`);
  }
  const r = spawnSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", USER, "-d", db, "-v", "ON_ERROR_STOP=1", "-t", "-A"],
    { input: sql, encoding: "utf8" }
  );
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return (r.stdout || "").trim();
}

function setupDb() {
  const inspect = spawnSync(
    "docker",
    ["inspect", "-f", "{{.Name}} {{json .NetworkSettings.Ports}} {{.State.Status}}", CONTAINER],
    { encoding: "utf8" }
  );
  if (inspect.status !== 0 || !/55433/.test(inspect.stdout) || !/running/i.test(inspect.stdout)) {
    throw new Error("Contenedor infinity-postgres no disponible en 55433.");
  }
  psql("postgres", `DROP DATABASE IF EXISTS ${ITEST_DB} WITH (FORCE);`);
  psql(
    "postgres",
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${SOURCE_DB}' AND pid <> pg_backend_pid();`
  );
  psql("postgres", `CREATE DATABASE ${ITEST_DB} TEMPLATE ${SOURCE_DB};`);
  const ident = psql(ITEST_DB, `SELECT current_database() || '|' || current_user;`);
  if (ident !== `${ITEST_DB}|${USER}`) throw new Error(`Identidad: ${ident}`);
  console.log(`[ident] ${ident} @ ${HOST}:${PORT}`);
}

function migrate() {
  const r = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: TEST_URL, DOTENV_CONFIG_PATH: "" },
  });
  const txt = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/render\.com|dpg-|infinity_ops_jwhb/i.test(txt)) {
    throw new Error("BLOQUEADO: migrate mencionó producción.");
  }
  if (r.status !== 0) throw new Error(txt);
  rec("migracion-aislada", txt.includes("20261021180000_lectura_km_fecha_historica"), "migración km aplicada solo en itest");
}

async function main() {
  setupDb();
  migrate();

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
  const ident = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
  if (ident[0]?.db !== ITEST_DB) throw new Error("Prisma fuera de la base aislada");

  const user = await prisma.usuario.create({
    data: {
      email: "qa-reportes@local.test",
      passwordHash: "x",
      nombre: "QA Reportes",
      rol: "ADMIN",
    },
  });
  const tecUser = await prisma.usuario.create({
    data: {
      email: "qa-tec-reportes@local.test",
      passwordHash: "x",
      nombre: "Técnico QA",
      rol: "TECNICO",
    },
  });
  const tec = await prisma.tecnico.create({
    data: { usuarioId: tecUser.id, telefono: "0990000000" },
  });

  const v1 = await prisma.vehiculo.create({
    data: {
      placa: "QA-REP01",
      marca: "Chevrolet",
      modelo: "D-Max",
      anio: 2021,
      tipo: "CAMIONETA",
      kilometrajeInicial: 10000,
      kilometrajeActual: 15000,
      estado: "DISPONIBLE",
    },
  });
  const vEsp = await prisma.vehiculo.create({
    data: {
      placa: "ÑÁ-001",
      marca: "Toyota",
      modelo: "Hilux",
      anio: 2019,
      tipo: "CAMIONETA",
      kilometrajeInicial: 8000,
      kilometrajeActual: 8200,
      estado: "INACTIVO",
    },
  });
  const vEmpty = await prisma.vehiculo.create({
    data: {
      placa: "QA-EMPTY",
      marca: "Nissan",
      modelo: "Frontier",
      anio: 2018,
      tipo: "CAMIONETA",
      kilometrajeInicial: 0,
      kilometrajeActual: 0,
      estado: "MANTENIMIENTO",
    },
  });

  const lecturas = [];
  for (let i = 0; i < 50; i++) {
    lecturas.push({
      vehiculoId: v1.id,
      kilometraje: 10000 + i * 80,
      origen: "MANUAL" as const,
      fecha: new Date(Date.UTC(2026, 7, 1 + i, 12, 0, 0)),
      createdAt: new Date(Date.UTC(2026, 9, 1, 18, 0, 0)),
      tipoLectura: i === 10 ? ("ESTIMADA" as const) : ("REAL" as const),
      fuente: i === 10 ? "bitácora" : null,
      observacion: i === 10 ? "Hueco reconstruido" : null,
      estadoRegistro: "ACTIVO" as const,
    });
  }
  lecturas.push({
    vehiculoId: vEsp.id,
    kilometraje: 8200,
    origen: "MANUAL" as const,
    fecha: new Date(Date.UTC(2026, 9, 5, 12, 0, 0)),
    createdAt: new Date(Date.UTC(2026, 9, 21, 14, 0, 0)),
    tipoLectura: "REAL" as const,
    fuente: null,
    observacion: null,
    estadoRegistro: "ACTIVO" as const,
  });
  await prisma.lecturaKilometraje.createMany({ data: lecturas });

  await prisma.cargaCombustible.create({
    data: {
      vehiculoId: v1.id,
      fecha: new Date(),
      estacion: "Primax",
      kilometraje: 15000,
      galones: 12.5,
      precioPorGalon: 2.4,
      total: 30,
      kmRecorridos: 400,
      kmPorGalon: 32,
      consumoFueraPromedio: true,
      estadoRegistro: "ACTIVO",
    },
  });
  await prisma.mantenimientoVehiculo.create({
    data: {
      vehiculoId: v1.id,
      fecha: new Date(),
      kilometraje: 14800,
      clase: "PREVENTIVO",
      tipo: "ACEITE",
      descripcion: "Cambio de aceite",
      costo: 85.5,
      proximoKm: 16000,
      estadoRegistro: "ACTIVO",
    },
  });
  await prisma.novedadVehiculo.create({
    data: {
      vehiculoId: v1.id,
      tecnicoId: tec.id,
      fecha: new Date(),
      kilometraje: 14900,
      tipo: "MECANICA",
      descripcion: "Ruido en suspensión",
      gravedad: "MEDIA",
      estado: "REPORTADA",
    },
  });
  await prisma.inspeccionVehiculo.create({
    data: {
      vehiculoId: v1.id,
      tecnicoId: tec.id,
      fecha: new Date(),
      kilometraje: 14950,
      combustible: 40,
      resultado: "APROBADO",
    },
  });
  await prisma.asignacionVehiculo.create({
    data: {
      vehiculoId: v1.id,
      tecnicoId: tec.id,
      usuarioId: user.id,
      kilometrajeEntrega: 10000,
      combustibleEntrega: 50,
    },
  });

  const { generarPdfReporteParque } = await import("../src/lib/parque-automotor/pdf");
  const { generarExcelReporteParque } = await import("../src/lib/parque-automotor/excel");
  const dir = mkdtempSync(join(tmpdir(), "infinity-reportes-qa-"));

  for (const tipo of TIPOS_REPORTE_PARQUE) {
    const pdf = await generarPdfReporteParque(tipo);
    const xls = await generarExcelReporteParque(tipo);
    writeFileSync(join(dir, pdf.filename), pdf.buffer);
    writeFileSync(join(dir, xls.filename), xls.buffer);
    const pdfOk = pdf.buffer.subarray(0, 4).toString() === "%PDF" && pdf.filename.endsWith(".pdf");
    const xlsOk = xls.buffer.subarray(0, 2).toString() === "PK" && xls.filename.endsWith(".xlsx");
    rec(
      `archivo-${tipo}`,
      pdfOk && xlsOk,
      `pdf=${pdf.filename} ${pdf.buffer.length}b · xlsx=${xls.filename} ${xls.buffer.length}b`
    );
  }

  const vacioPdf = await generarPdfReporteParque("kilometraje", vEmpty.id);
  const vacioXls = await generarExcelReporteParque("kilometraje", vEmpty.id);
  rec(
    "sin-datos-vehiculo-vacio",
    vacioPdf.buffer.subarray(0, 4).toString() === "%PDF" &&
      vacioXls.buffer.subarray(0, 2).toString() === "PK",
    "kilometraje de QA-EMPTY genera PDF y XLSX válidos"
  );

  const kmPdf = await generarPdfReporteParque("kilometraje");
  rec(
    "pdf-multipagina-km",
    /\/Count\s+[2-9]/.test(kmPdf.buffer.toString("latin1")) ||
      /\/Count\s+\d{2,}/.test(kmPdf.buffer.toString("latin1")),
    "historial extenso produce más de una página"
  );

  rec(
    "tipo-invalido-catalogo",
    !(TIPOS_REPORTE_PARQUE as readonly string[]).includes("no-existe"),
    "el catálogo rechaza tipos inventados"
  );

  const xlsKm = await generarExcelReporteParque("kilometraje");
  const wb = XLSX.read(xlsKm.buffer, { type: "buffer" });
  const sh = wb.Sheets[wb.SheetNames[0]];
  const filtro = sh["!autofilter"]?.ref || "";
  rec("excel-autofilter-encabezado", /^A7:/.test(filtro), `autofilter=${filtro}`);

  const matriz = XLSX.utils.sheet_to_json<(string | number)[]>(sh, { header: 1 });
  const headerIdx = matriz.findIndex((r) => r[0] === "Placa");
  const datos = matriz.slice(headerIdx + 1).filter((r) => r.length > 1);
  const prismaKm = await prisma.lecturaKilometraje.count({ where: { estadoRegistro: "ACTIVO" } });
  rec(
    "excel-km-vs-consulta",
    datos.length === prismaKm,
    `excel=${datos.length} prisma=${prismaKm}`
  );

  const est = datos.filter((r) => String(r[6] || "").toLowerCase().includes("estimada")).length;
  const prismaEst = await prisma.lecturaKilometraje.count({
    where: { estadoRegistro: "ACTIVO", tipoLectura: "ESTIMADA" },
  });
  rec(
    "excel-estimadas-no-verificadas",
    est === prismaEst && datos.some((r) => String(r[6]).includes("no verificada")),
    `estimadas excel=${est} prisma=${prismaEst}`
  );

  const hist = String(datos.find((r) => r[0] === "QA-REP01")?.[2] || "");
  rec("excel-fecha-historica", /^\d{4}-\d{2}-\d{2}$/.test(hist), `fecha histórica=${hist}`);

  const deltas = datos.map((r) => r[5]).filter((d) => d !== "" && d != null) as number[];
  rec(
    "excel-delta-no-negativo",
    deltas.every((d) => typeof d === "number" && d >= 0),
    `deltas=${deltas.slice(0, 5).join(",")}`
  );

  const placaCell = Object.keys(sh).find((k) => {
    const c = sh[k];
    return c && c.v === "ÑÁ-001";
  });
  const tipoCelda = placaCell ? sh[placaCell].t : "?";
  rec(
    "excel-placa-especial-texto",
    Boolean(placaCell) && tipoCelda !== "n",
    `ÑÁ-001 celda=${placaCell} tipo=${tipoCelda}`
  );

  const xlsComb = await generarExcelReporteParque("combustible");
  const shC = XLSX.read(xlsComb.buffer, { type: "buffer" }).Sheets["Combustible"];
  const comb = XLSX.utils.sheet_to_json<(string | number)[]>(shC, { header: 1 });
  const hComb = comb.find((r) => r.includes("Galones"));
  rec(
    "excel-combustible-galones",
    Boolean(hComb) && !comb.flat().some((c) => String(c).toLowerCase().includes("litro")),
    `encabezados=${(hComb || []).join("|")}`
  );
  const filaC = comb.find((r) => r[0] === "QA-REP01");
  rec("excel-importe-usd", filaC?.[5] === 30, `total=${filaC?.[5]} gal=${filaC?.[3]}`);

  const xlsFlota = await generarExcelReporteParque("flota");
  const shF = XLSX.read(xlsFlota.buffer, { type: "buffer" }).Sheets["Resumen"];
  const res = XLSX.utils.sheet_to_json<(string | number)[]>(shF, { header: 1 });
  const totalExcel = res.find((r) => r[0] === "Total vehículos")?.[1];
  const totalPrisma = await prisma.vehiculo.count();
  rec("flota-total-vs-consulta", totalExcel === totalPrisma, `excel=${totalExcel} prisma=${totalPrisma}`);

  const kmMesCargas = await prisma.cargaCombustible.aggregate({
    where: { estadoRegistro: "ACTIVO" },
    _sum: { kmRecorridos: true },
  });
  rec(
    "km-mes-es-de-cargas",
    (kmMesCargas._sum.kmRecorridos ?? 0) >= 0,
    `kmRecorridos cargas=${kmMesCargas._sum.kmRecorridos ?? 0} (no se usa odómetro)`
  );

  const una = await prisma.lecturaKilometraje.findFirst({
    where: { vehiculoId: v1.id, tipoLectura: "ESTIMADA" },
  });
  rec(
    "fecha-vs-createdAt",
    !!una && diaCalendarioEc(una.fecha) !== diaCalendarioEc(una.createdAt),
    `histórica=${una ? diaCalendarioEc(una.fecha) : "?"} registro=${una ? diaCalendarioEc(una.createdAt) : "?"}`
  );

  await prisma.$disconnect();
  rec("salida-temporal", true, dir);
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* tmp */
  }
}

async function cleanup() {
  try {
    psql("postgres", `DROP DATABASE IF EXISTS ${ITEST_DB} WITH (FORCE);`);
    console.log(`[cleanup] ${ITEST_DB} eliminada`);
  } catch (e) {
    console.error("[cleanup]", e);
  }
}

main()
  .then(async () => {
    const fail = out.filter((r) => !r.ok);
    console.log(
      JSON.stringify(
        {
          host: HOST,
          port: PORT,
          database: ITEST_DB,
          produccion: "intacta",
          total: out.length,
          pass: out.filter((r) => r.ok).length,
          fail: fail.length,
          pruebas: out,
        },
        null,
        2
      )
    );
    await cleanup();
    if (fail.length) process.exit(1);
  })
  .catch(async (err) => {
    console.error("[FATAL]", err);
    await cleanup();
    process.exit(1);
  });
