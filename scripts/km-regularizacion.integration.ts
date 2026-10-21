/**
 * Integración PostgreSQL de regularización histórica de km.
 * Conecta SOLO a 127.0.0.1:55433 / infinity_ops_km_itest (Docker infinity-postgres).
 * Nunca carga .env.production.local ni toca Render.
 */
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import {
  diaCalendarioEc,
  type ItemRegularizacionKm,
} from "../src/lib/parque-automotor/reglas";

const HOST = "127.0.0.1";
const PORT = "55433";
const USER = "infinity";
const PASS = "infinity123";
const ITEST_DB = "infinity_ops_km_itest";
const SOURCE_DB = "infinity_ops";
const CONTAINER = "infinity-postgres";
const TEST_URL = `postgresql://${USER}:${PASS}@${HOST}:${PORT}/${ITEST_DB}`;
const USER_ID = "kmitest-user";
const JUST = "Bitácora del responsable de flota";

function assertAllowedUrl(url: string, allowedDb: string) {
  if (/render\.com|dpg-|onrender|neon\.tech|railway\.app|amazonaws|supabase/i.test(url)) {
    throw new Error("BLOQUEADO: la URL parece remota o de producción.");
  }
  const parsed = new URL(url.replace(/^postgresql:/i, "http:"));
  if (parsed.hostname !== HOST) {
    throw new Error(`BLOQUEADO: host ${parsed.hostname} no es ${HOST}.`);
  }
  if (parsed.port !== PORT) {
    throw new Error(`BLOQUEADO: puerto ${parsed.port} no es ${PORT}.`);
  }
  const db = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("?")[0] || "");
  if (db !== allowedDb) {
    throw new Error(`BLOQUEADO: base ${db} no es ${allowedDb}.`);
  }
}

assertAllowedUrl(TEST_URL, ITEST_DB);
process.env.DATABASE_URL = TEST_URL;

type Resultado = {
  id: string;
  ok: boolean;
  detalle: string;
};

const resultados: Resultado[] = [];

function registrar(id: string, ok: boolean, detalle: string) {
  resultados.push({ id, ok, detalle });
  const marca = ok ? "PASS" : "FAIL";
  console.log(`[${marca}] ${id}: ${detalle}`);
}

function psql(db: string, sql: string): string {
  if (db !== "postgres" && db !== SOURCE_DB && db !== ITEST_DB) {
    throw new Error(`BLOQUEADO: psql a base no permitida (${db}).`);
  }
  const r = spawnSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", USER, "-d", db, "-v", "ON_ERROR_STOP=1", "-t", "-A"],
    { input: sql, encoding: "utf8" }
  );
  if (r.status !== 0) {
    throw new Error(`psql ${db} falló:\n${r.stderr || r.stdout}`);
  }
  return (r.stdout || "").trim();
}

function crearBaseAislada() {
  const inspect = spawnSync(
    "docker",
    ["inspect", "-f", "{{.Name}} {{json .NetworkSettings.Ports}} {{.State.Status}}", CONTAINER],
    { encoding: "utf8" }
  );
  if (inspect.status !== 0 || !/55433/.test(inspect.stdout) || !/running/i.test(inspect.stdout)) {
    throw new Error(
      `Contenedor ${CONTAINER} no está en ejecución con puerto 55433. stdout=${inspect.stdout} err=${inspect.stderr}`
    );
  }
  psql("postgres", `DROP DATABASE IF EXISTS ${ITEST_DB} WITH (FORCE);`);
  psql(
    "postgres",
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${SOURCE_DB}' AND pid <> pg_backend_pid();`
  );
  psql("postgres", `CREATE DATABASE ${ITEST_DB} TEMPLATE ${SOURCE_DB};`);
  const ident = psql(
    ITEST_DB,
    `SELECT current_database() || '|' || current_user || '|' || COUNT(*)::text
     FROM information_schema.tables WHERE table_schema='public';`
  );
  const [db, usr] = ident.split("|");
  if (db !== ITEST_DB || usr !== USER) {
    throw new Error(`Identidad inesperada: ${ident}`);
  }
  console.log(`[ident] database=${db} user=${usr} host=${HOST} port=${PORT} container=${CONTAINER}`);
}

function aplicarMigracion() {
  const cli = "node_modules/prisma/build/index.js";
  const r = spawnSync(process.execPath, [cli, "migrate", "deploy"], {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: TEST_URL,
      DOTENV_CONFIG_PATH: "",
    },
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/render\.com|dpg-|infinity_ops_jwhb/i.test(out)) {
    throw new Error("BLOQUEADO: prisma migrate deploy mencionó producción.");
  }
  if (r.status !== 0) {
    throw new Error(`migrate deploy falló:\n${out}`);
  }
  console.log(out.trim());
}

function item(over: Partial<ItemRegularizacionKm> = {}): ItemRegularizacionKm {
  return {
    dia: "2026-10-03",
    kilometraje: 10200,
    tipoLectura: "REAL",
    justificacion: JUST,
    fuente: "itest",
    ...over,
  };
}

async function snapshot(
  prisma: PrismaClient,
  vehiculoId: string
): Promise<{ km: number; lecturas: number; auditorias: number; ids: string[] }> {
  const v = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } });
  const lecturas = await prisma.lecturaKilometraje.findMany({
    where: { vehiculoId },
    select: { id: true },
  });
  const auditorias = await prisma.vehiculoAuditoria.count({
    where: { vehiculoId, accion: "KM_REGULARIZACION" },
  });
  return {
    km: v.kilometrajeActual,
    lecturas: lecturas.length,
    auditorias,
    ids: lecturas.map((l) => l.id).sort(),
  };
}

async function main() {
  crearBaseAislada();

  const preCols = psql(
    ITEST_DB,
    `SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='LecturaKilometraje';`
  );
  registrar(
    "pre-migracion-columnas",
    !preCols.includes("fecha") && !preCols.includes("tipoLectura") && !preCols.includes("fuente"),
    `columnas antes: ${preCols}`
  );

  psql(
    ITEST_DB,
    `
    INSERT INTO "Usuario" (id, email, "passwordHash", nombre, rol, activo, "createdAt")
    VALUES ('${USER_ID}', 'km-itest@local.test', 'x', 'KM ITEST', 'ADMIN', true, NOW());

    INSERT INTO "Vehiculo" (id, placa, marca, modelo, anio, tipo, "kilometrajeInicial", "kilometrajeActual", estado, "createdAt", "updatedAt")
    VALUES
      ('kmitest-v-backfill', 'KMITEST1', 'Prueba', 'Backfill', 2020, 'CAMIONETA', 10000, 10500, 'DISPONIBLE', NOW(), NOW()),
      ('kmitest-v-gap',      'KMITEST2', 'Prueba', 'Hueco',    2020, 'CAMIONETA', 10000, 10400, 'DISPONIBLE', NOW(), NOW()),
      ('kmitest-v-latest',   'KMITEST3', 'Prueba', 'Reciente', 2020, 'CAMIONETA', 10000, 10400, 'DISPONIBLE', NOW(), NOW()),
      ('kmitest-v-fail-aud', 'KMITEST4', 'Prueba', 'FailAud',  2020, 'CAMIONETA', 10000, 10400, 'DISPONIBLE', NOW(), NOW()),
      ('kmitest-v-fail-km',  'KMITEST5', 'Prueba', 'FailKm',   2020, 'CAMIONETA', 10000, 10400, 'DISPONIBLE', NOW(), NOW()),
      ('kmitest-v-valid',    'KMITEST6', 'Prueba', 'Valid',    2020, 'CAMIONETA', 10000, 10400, 'DISPONIBLE', NOW(), NOW()),
      ('kmitest-v-trigger',  'KMITEST7', 'Prueba', 'Trigger',  2020, 'CAMIONETA', 10000, 15000, 'DISPONIBLE', NOW(), NOW()),
      ('kmitest-v-stale',    'KMITEST8', 'Prueba', 'Stale',    2020, 'CAMIONETA', 10000, 10000, 'DISPONIBLE', NOW(), NOW());

    INSERT INTO "LecturaKilometraje" (id, "vehiculoId", kilometraje, origen, "estadoRegistro", "createdAt")
    VALUES
      ('kmitest-l-bf-1', 'kmitest-v-backfill', 10000, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-01 12:00:00'),
      ('kmitest-l-bf-2', 'kmitest-v-backfill', 10400, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-05 12:00:00'),
      ('kmitest-l-bf-3', 'kmitest-v-backfill', 10500, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-06 03:30:00'),
      ('kmitest-l-gap-1', 'kmitest-v-gap', 10000, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-01 12:00:00'),
      ('kmitest-l-gap-2', 'kmitest-v-gap', 10400, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-05 12:00:00'),
      ('kmitest-l-lat-1', 'kmitest-v-latest', 10000, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-01 12:00:00'),
      ('kmitest-l-lat-2', 'kmitest-v-latest', 10400, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-05 12:00:00'),
      ('kmitest-l-fa-1', 'kmitest-v-fail-aud', 10000, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-01 12:00:00'),
      ('kmitest-l-fa-2', 'kmitest-v-fail-aud', 10400, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-05 12:00:00'),
      ('kmitest-l-fk-1', 'kmitest-v-fail-km', 10000, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-01 12:00:00'),
      ('kmitest-l-fk-2', 'kmitest-v-fail-km', 10400, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-05 12:00:00'),
      ('kmitest-l-va-1', 'kmitest-v-valid', 10000, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-01 12:00:00'),
      ('kmitest-l-va-2', 'kmitest-v-valid', 10400, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-05 12:00:00'),
      ('kmitest-l-st-1', 'kmitest-v-stale', 10000, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-01 12:00:00'),
      ('kmitest-l-st-2', 'kmitest-v-stale', 10400, 'MANUAL', 'ACTIVO', TIMESTAMP '2026-10-05 12:00:00');
    `
  );

  const preKm = psql(
    ITEST_DB,
    `SELECT id || '=' || kilometraje::text FROM "LecturaKilometraje" WHERE id LIKE 'kmitest-l-bf-%' ORDER BY id;`
  );
  registrar("pre-migracion-km", preKm.includes("10000") && preKm.includes("10500"), preKm.replace(/\n/g, " | "));

  aplicarMigracion();

  const postCols = psql(
    ITEST_DB,
    `SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='LecturaKilometraje';`
  );
  const enumVals = psql(
    ITEST_DB,
    `SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder)
     FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'TipoLecturaKmVehiculo';`
  );
  const idx = psql(
    ITEST_DB,
    `SELECT indexname FROM pg_indexes
     WHERE tablename='LecturaKilometraje' AND indexname='LecturaKilometraje_vehiculoId_fecha_idx';`
  );
  const mig = psql(
    ITEST_DB,
    `SELECT migration_name FROM "_prisma_migrations"
     WHERE migration_name='20261021180000_lectura_km_fecha_historica' AND finished_at IS NOT NULL;`
  );
  registrar(
    "migracion-columnas-enum-indice",
    postCols.includes("fecha") &&
      postCols.includes("tipoLectura") &&
      postCols.includes("fuente") &&
      enumVals === "REAL,ESTIMADA" &&
      idx === "LecturaKilometraje_vehiculoId_fecha_idx" &&
      mig === "20261021180000_lectura_km_fecha_historica",
    `cols=${postCols} enum=${enumVals} idx=${idx} mig=${mig}`
  );

  const backfill = psql(
    ITEST_DB,
    `SELECT COUNT(*)::text FROM "LecturaKilometraje"
     WHERE id LIKE 'kmitest-%' AND fecha IS NOT DISTINCT FROM "createdAt";`
  );
  const backfillKm = psql(
    ITEST_DB,
    `SELECT id || ' km=' || kilometraje::text || ' created=' || "createdAt"::text || ' fecha=' || fecha::text
     FROM "LecturaKilometraje" WHERE id LIKE 'kmitest-l-bf-%' ORDER BY id;`
  );
  registrar(
    "backfill-fecha-y-km",
    backfill === "15" &&
      backfillKm.includes("km=10000") &&
      backfillKm.includes("km=10400") &&
      backfillKm.includes("km=10500") &&
      backfillKm.includes("2026-10-06 03:30:00") &&
      !backfillKm.includes("km=99999"),
    `iguales createdAt/fecha=${backfill}/15 | ${backfillKm.replace(/\n/g, " || ")}`
  );

  const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
  const identPg = await prisma.$queryRaw<Array<{ db: string; usr: string }>>`
    SELECT current_database() AS db, current_user AS usr
  `;
  if (identPg[0]?.db !== ITEST_DB || identPg[0]?.usr !== USER) {
    throw new Error(`Prisma no está en la base aislada: ${JSON.stringify(identPg)}`);
  }

  const { regularizarKilometrajeHistorico } = await import(
    "../src/lib/parque-automotor/servicio"
  );

  const bfRows = await prisma.lecturaKilometraje.findMany({
    where: { vehiculoId: "kmitest-v-backfill" },
    orderBy: { createdAt: "asc" },
  });
  const diasEc = bfRows.map((r) => `${r.kilometraje}:${diaCalendarioEc(r.fecha)}`);
  registrar(
    "zona-horaria-ecuador",
    diasEc.join(",") === "10000:2026-10-01,10400:2026-10-05,10500:2026-10-05",
    `diaCalendarioEc(fecha)=${diasEc.join(" | ")}. 03:30 UTC cae el 2026-10-05 en Ecuador (UTC−5).`
  );

  const antesExito = await snapshot(prisma, "kmitest-v-latest");
  const exito = await regularizarKilometrajeHistorico({
    vehiculoId: "kmitest-v-latest",
    usuarioId: USER_ID,
    items: [item({ dia: "2026-10-10", kilometraje: 11000 })],
  });
  const despuesExito = await snapshot(prisma, "kmitest-v-latest");
  const audExito = await prisma.vehiculoAuditoria.findFirst({
    where: { vehiculoId: "kmitest-v-latest", accion: "KM_REGULARIZACION" },
  });
  registrar(
    "regularizacion-exito-atomico",
    exito.actualizoKilometrajeActual === true &&
      exito.kilometrajeActual === 11000 &&
      despuesExito.km === 11000 &&
      despuesExito.lecturas === antesExito.lecturas + 1 &&
      despuesExito.auditorias === 1 &&
      audExito?.usuarioId === USER_ID &&
      audExito?.motivo === JUST &&
      (audExito?.valorNuevo || "").includes("11000") &&
      (audExito?.valorNuevo || "").includes("ESTIMADA") === false &&
      (audExito?.valorNuevo || "").includes("REAL") &&
      (audExito?.valorNuevo || "").includes("2026-10-10"),
    `antes km=${antesExito.km} lect=${antesExito.lecturas} aud=${antesExito.auditorias}; ` +
      `después km=${despuesExito.km} lect=${despuesExito.lecturas} aud=${despuesExito.auditorias}`
  );

  const antesGap = await snapshot(prisma, "kmitest-v-gap");
  const gap = await regularizarKilometrajeHistorico({
    vehiculoId: "kmitest-v-gap",
    usuarioId: USER_ID,
    items: [item()],
  });
  const despuesGap = await snapshot(prisma, "kmitest-v-gap");
  registrar(
    "hueco-antiguo-no-cambia-odometro",
    gap.actualizoKilometrajeActual === false &&
      gap.kilometrajeActual === 10400 &&
      despuesGap.km === 10400 &&
      despuesGap.lecturas === antesGap.lecturas + 1 &&
      despuesGap.auditorias === 1,
    `km se mantuvo ${despuesGap.km}; lecturas ${antesGap.lecturas}→${despuesGap.lecturas}`
  );

  const antesStale = await snapshot(prisma, "kmitest-v-stale");
  const stale = await regularizarKilometrajeHistorico({
    vehiculoId: "kmitest-v-stale",
    usuarioId: USER_ID,
    items: [item()],
  });
  const despuesStale = await snapshot(prisma, "kmitest-v-stale");
  registrar(
    "odometro-desfasado-se-conserva",
    stale.actualizoKilometrajeActual === false &&
      despuesStale.km === 10000 &&
      stale.inconsistencia != null &&
      despuesStale.lecturas === antesStale.lecturas + 1,
    `km=${despuesStale.km} inconsistencia=${stale.inconsistencia?.mensaje ?? "null"}`
  );

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION kmitest_fail_audit() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'kmitest forced audit failure';
    END;
    $$ LANGUAGE plpgsql
  `);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS kmitest_fail_audit_trg ON "VehiculoAuditoria"`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER kmitest_fail_audit_trg
      BEFORE INSERT ON "VehiculoAuditoria"
      FOR EACH ROW
      WHEN (NEW."vehiculoId" = 'kmitest-v-fail-aud' AND NEW.accion = 'KM_REGULARIZACION')
      EXECUTE PROCEDURE kmitest_fail_audit()
  `);
  const antesAud = await snapshot(prisma, "kmitest-v-fail-aud");
  let falloAud = "no lanzó";
  try {
    await regularizarKilometrajeHistorico({
      vehiculoId: "kmitest-v-fail-aud",
      usuarioId: USER_ID,
      items: [item({ dia: "2026-10-10", kilometraje: 11000 })],
    });
  } catch (err) {
    falloAud = err instanceof Error ? err.message : String(err);
  }
  const despuesAud = await snapshot(prisma, "kmitest-v-fail-aud");
  registrar(
    "rollback-si-falla-auditoria",
    /kmitest forced audit failure/i.test(falloAud) &&
      despuesAud.km === antesAud.km &&
      despuesAud.lecturas === antesAud.lecturas &&
      despuesAud.auditorias === 0 &&
      despuesAud.ids.join() === antesAud.ids.join(),
    `error=${falloAud} km ${antesAud.km}→${despuesAud.km} lect ${antesAud.lecturas}→${despuesAud.lecturas} aud=${despuesAud.auditorias}`
  );
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS kmitest_fail_audit_trg ON "VehiculoAuditoria";`);

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION kmitest_fail_km() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'kmitest forced odometer failure';
    END;
    $$ LANGUAGE plpgsql
  `);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS kmitest_fail_km_trg ON "Vehiculo"`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER kmitest_fail_km_trg
      BEFORE UPDATE OF "kilometrajeActual" ON "Vehiculo"
      FOR EACH ROW
      WHEN (OLD.id = 'kmitest-v-fail-km')
      EXECUTE PROCEDURE kmitest_fail_km()
  `);
  const antesKm = await snapshot(prisma, "kmitest-v-fail-km");
  let falloKm = "no lanzó";
  try {
    await regularizarKilometrajeHistorico({
      vehiculoId: "kmitest-v-fail-km",
      usuarioId: USER_ID,
      items: [item({ dia: "2026-10-10", kilometraje: 11000 })],
    });
  } catch (err) {
    falloKm = err instanceof Error ? err.message : String(err);
  }
  const despuesKm = await snapshot(prisma, "kmitest-v-fail-km");
  registrar(
    "rollback-si-falla-odometro",
    /kmitest forced odometer failure/i.test(falloKm) &&
      despuesKm.km === 10400 &&
      despuesKm.lecturas === antesKm.lecturas &&
      despuesKm.auditorias === 0,
    `error=${falloKm} km ${antesKm.km}→${despuesKm.km} lect ${antesKm.lecturas}→${despuesKm.lecturas}`
  );
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS kmitest_fail_km_trg ON "Vehiculo";`);

  const antesValid = await snapshot(prisma, "kmitest-v-valid");
  const casos = [
    {
      id: "rechazo-duplicado",
      items: [item({ dia: "2026-10-01", kilometraje: 10050 })],
      expect: /Ya existe una lectura/i,
    },
    {
      id: "rechazo-estimada-sin-justificacion",
      items: [item({ tipoLectura: "ESTIMADA" as const, justificacion: "" })],
      expect: /estimada/i,
    },
    {
      id: "rechazo-secuencia-inconsistente",
      items: [item({ kilometraje: 20000 })],
      expect: /posterior/i,
    },
  ];
  for (const c of casos) {
    let msg = "no lanzó";
    try {
      await regularizarKilometrajeHistorico({
        vehiculoId: "kmitest-v-valid",
        usuarioId: USER_ID,
        items: c.items,
      });
    } catch (err) {
      msg = err instanceof Error ? err.message : String(err);
    }
    const despues = await snapshot(prisma, "kmitest-v-valid");
    registrar(
      c.id,
      c.expect.test(msg) &&
        despues.km === antesValid.km &&
        despues.lecturas === antesValid.lecturas &&
        despues.auditorias === antesValid.auditorias,
      `error=${msg} lect=${despues.lecturas} km=${despues.km}`
    );
  }

  let triggerMsg = "no lanzó";
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Vehiculo" SET "kilometrajeActual" = 1 WHERE id = 'kmitest-v-trigger'`
    );
  } catch (err) {
    triggerMsg = err instanceof Error ? err.message : String(err);
  }
  const trig = await prisma.vehiculo.findUniqueOrThrow({ where: { id: "kmitest-v-trigger" } });
  registrar(
    "disparador-no-retrocede",
    /inferior al último kilometraje/i.test(triggerMsg) && trig.kilometrajeActual === 15000,
    `error=${triggerMsg} km=${trig.kilometrajeActual}`
  );

  const originals = await prisma.lecturaKilometraje.findMany({
    where: { id: { in: ["kmitest-l-gap-1", "kmitest-l-gap-2", "kmitest-l-bf-1"] } },
  });
  registrar(
    "lecturas-originales-intactas",
    originals.length === 3 &&
      originals.every((r) => r.estadoRegistro === "ACTIVO") &&
      originals.some((r) => r.kilometraje === 10000) &&
      originals.some((r) => r.kilometraje === 10400),
    originals.map((r) => `${r.id}:${r.kilometraje}:${r.estadoRegistro}`).join(" | ")
  );

  await prisma.$disconnect();
}

async function cleanup() {
  try {
    psql("postgres", `DROP DATABASE IF EXISTS ${ITEST_DB} WITH (FORCE);`);
    console.log(`[cleanup] base ${ITEST_DB} eliminada`);
  } catch (err) {
    console.error("[cleanup] no se pudo eliminar la base aislada:", err);
  }
}

main()
  .then(async () => {
    const fail = resultados.filter((r) => !r.ok);
    console.log("\n=== RESUMEN INTEGRACIÓN POSTGRESQL ===");
    console.log(
      JSON.stringify(
        {
          host: HOST,
          port: PORT,
          database: ITEST_DB,
          container: CONTAINER,
          produccion: "intacta",
          total: resultados.length,
          pass: resultados.filter((r) => r.ok).length,
          fail: fail.length,
          pruebas: resultados,
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
    resultados.push({ id: "fatal", ok: false, detalle: String(err) });
    await cleanup();
    process.exit(1);
  });
