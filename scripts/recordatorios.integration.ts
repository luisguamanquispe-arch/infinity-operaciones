/**
 * Integración PostgreSQL de recordatorios de técnicos.
 * Conecta SOLO a 127.0.0.1:55433 / infinity_ops_rec_itest (Docker infinity-postgres).
 * Nunca carga .env.production.local ni toca Render.
 */
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { withRecordatorioLock } from "../src/lib/recordatorios/lock";
import {
  CONFIG_RECORDATORIO_DEFAULT,
  horaEnGuayaquil,
  planificarRecordatorios,
  textoNotificacion,
} from "../src/lib/recordatorios/reglas";
import { registrarSuscripcionPush } from "../src/lib/recordatorios/suscripcion";

const HOST = "127.0.0.1";
const PORT = "55433";
const USER = "infinity";
const PASS = "infinity123";
const ITEST_DB = "infinity_ops_rec_itest";
const CONTAINER = "infinity-postgres";
const TEST_URL = `postgresql://${USER}:${PASS}@${HOST}:${PORT}/${ITEST_DB}`;

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

type Resultado = { id: string; ok: boolean; detalle: string };
const resultados: Resultado[] = [];

function registrar(id: string, ok: boolean, detalle: string) {
  resultados.push({ id, ok, detalle });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id}: ${detalle}`);
}

function psql(db: string, sql: string): string {
  if (db !== "postgres" && db !== ITEST_DB) {
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
      `Contenedor ${CONTAINER} no está en ejecución con puerto 55433. stdout=${inspect.stdout}`
    );
  }
  psql("postgres", `DROP DATABASE IF EXISTS ${ITEST_DB} WITH (FORCE);`);
  psql("postgres", `CREATE DATABASE ${ITEST_DB};`);
  const ident = psql(ITEST_DB, `SELECT current_database() || '|' || current_user`);
  const [db, usr] = ident.split("|");
  if (db !== ITEST_DB || usr !== USER) {
    throw new Error(`Identidad inesperada: ${ident}`);
  }
  console.log(`[ident] database=${db} user=${usr} host=${HOST} port=${PORT}`);
}

function aplicarMigraciones() {
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

async function sembrar(prisma: PrismaClient) {
  await prisma.usuario.create({
    data: {
      id: "u-tec-a",
      email: "tec-a-rec@itest.local",
      passwordHash: "x",
      nombre: "Técnico A",
      rol: "TECNICO",
      tecnico: { create: { id: "tec-a" } },
    },
  });
  await prisma.usuario.create({
    data: {
      id: "u-tec-b",
      email: "tec-b-rec@itest.local",
      passwordHash: "x",
      nombre: "Técnico B",
      rol: "TECNICO",
      tecnico: { create: { id: "tec-b" } },
    },
  });
  await prisma.cliente.create({
    data: {
      id: "cli-rec",
      cedula: "0999999999",
      nombre: "Cliente ITest",
      telefono: "0990000000",
      plan: "TEST",
      direccion: "N/A",
      sector: "N/A",
    },
  });
  const asignadoEn = new Date("2026-10-24T15:00:00.000Z");
  await prisma.ticket.create({
    data: {
      id: "t-rec-1",
      codigo: "TCK-REC-1",
      clienteId: "cli-rec",
      tipo: "SOPORTE",
      prioridad: "ALTA",
      estado: "PENDIENTE",
      motivo: "Prueba recordatorio",
      programadoEn: new Date("2026-10-24T18:00:00.000Z"),
      slaVenceEn: new Date("2026-10-24T20:00:00.000Z"),
      tecnicos: { create: { tecnicoId: "tec-a", asignadoEn } },
    },
  });
  await prisma.ticket.create({
    data: {
      id: "t-rec-2",
      codigo: "TCK-REC-2",
      clienteId: "cli-rec",
      tipo: "SOPORTE",
      prioridad: "MEDIA",
      estado: "PENDIENTE",
      motivo: "Sin fecha",
      tecnicos: { create: { tecnicoId: "tec-b", asignadoEn } },
    },
  });
}

async function main() {
  crearBaseAislada();
  aplicarMigraciones();
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
  try {
    await sembrar(prisma);

    const cfg = { ...CONFIG_RECORDATORIO_DEFAULT, respetarHorario: false };
    const asignadoEn = new Date("2026-10-24T15:00:00.000Z");
    const ticketA = {
      id: "t-rec-1",
      codigo: "TCK-REC-1",
      estado: "PENDIENTE",
      estadoRevision: null,
      prioridad: "ALTA",
      programadoEn: new Date("2026-10-24T18:00:00.000Z"),
      slaVenceEn: new Date("2026-10-24T20:00:00.000Z"),
      asignaciones: [{ tecnicoId: "tec-a", asignadoEn }],
      orden: { finalizadoEn: null },
    };
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T16:00:00.000Z"),
      config: cfg,
      tickets: [ticketA],
      clavesExistentes: new Set(),
    });
    registrar("it-asignacion", plan.some((p) => p.tipo === "ASIGNACION"), `plan=${plan.map((p) => p.tipo).join(",")}`);

    const item = plan.find((p) => p.tipo === "ASIGNACION");
    if (!item) throw new Error("sin plan de asignación");
    const txt = textoNotificacion(item.tipo, item.codigoTicket, item.prioridad);
    const creado = await prisma.notificacionTecnico.create({
      data: {
        tecnicoId: item.tecnicoId,
        ticketId: item.ticketId,
        tipo: item.tipo,
        titulo: txt.titulo,
        cuerpo: txt.cuerpo,
        claveIdem: item.claveIdem,
        prioridad: "ALTA",
        codigoTicket: item.codigoTicket,
        vencimientoEn: item.vencimientoEn,
        entregas: {
          create: { canal: "INTERNO", estado: "ENVIADO", intentos: 1, enviadoEn: new Date() },
        },
      },
    });
    registrar("it-persistencia", !!creado.id, creado.claveIdem);

    const claveNueva = "ASIGNACION:t-rec-1:tec-a:concurrent";
    const dup = await Promise.allSettled([
      prisma.notificacionTecnico.create({
        data: {
          tecnicoId: "tec-a",
          ticketId: "t-rec-1",
          tipo: "ASIGNACION",
          titulo: "x",
          cuerpo: "x",
          claveIdem: claveNueva,
        },
      }),
      prisma.notificacionTecnico.create({
        data: {
          tecnicoId: "tec-a",
          ticketId: "t-rec-1",
          tipo: "ASIGNACION",
          titulo: "y",
          cuerpo: "y",
          claveIdem: claveNueva,
        },
      }),
    ]);
    const okDup = dup.filter((d) => d.status === "fulfilled").length;
    const failDup = dup.filter((d) => d.status === "rejected").length;
    registrar("it-concurrencia", okDup === 1 && failDup === 1, `fulfilled=${okDup} rejected=${failDup}`);

    await prisma.$disconnect();
    await prisma.$connect();
    const trasReinicio = await prisma.notificacionTecnico.count({ where: { claveIdem: item.claveIdem } });
    registrar("it-reinicio", trasReinicio === 1, `count=${trasReinicio}`);

    const deA = await prisma.notificacionTecnico.findMany({ where: { tecnicoId: "tec-a" } });
    const deB = await prisma.notificacionTecnico.findMany({ where: { tecnicoId: "tec-b" } });
    registrar(
      "it-aislamiento",
      deA.length >= 1 && deB.length === 0 && deA.every((n) => n.tecnicoId === "tec-a"),
      `A=${deA.length} B=${deB.length}`
    );

    const planB = planificarRecordatorios({
      now: new Date("2026-10-24T16:00:00.000Z"),
      config: cfg,
      tickets: [
        {
          id: "t-rec-2",
          codigo: "TCK-REC-2",
          estado: "PENDIENTE",
          prioridad: "MEDIA",
          programadoEn: null,
          slaVenceEn: null,
          asignaciones: [{ tecnicoId: "tec-b", asignadoEn }],
        },
      ],
      clavesExistentes: new Set(),
    });
    registrar(
      "it-sin-limite",
      planB.length === 1 && planB[0].tipo === "ASIGNACION" && planB[0].tecnicoId === "tec-b",
      planB.map((p) => p.tipo).join(",")
    );

    const planCerrado = planificarRecordatorios({
      now: new Date("2026-10-24T18:01:00.000Z"),
      config: cfg,
      tickets: [{ ...ticketA, estado: "CANCELADO" }],
      clavesExistentes: new Set(),
    });
    registrar("it-cierre", planCerrado.length === 0, `n=${planCerrado.length}`);

    const tz = horaEnGuayaquil(new Date("2026-10-24T17:00:00.000Z"));
    registrar("it-timezone", tz === 12, `hora=${tz}`);

    const c1 = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
    const c2 = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
    try {
      let hold!: () => void;
      const holding = new Promise<void>((r) => {
        hold = r;
      });
      let lockedSignal!: () => void;
      const locked = new Promise<void>((r) => {
        lockedSignal = r;
      });
      const p1 = withRecordatorioLock(
        c1,
        async () => {
          lockedSignal();
          await holding;
          return "a";
        },
        { timeout: 20_000 }
      );
      await locked;
      const p2 = await withRecordatorioLock(c2, async () => "b", { timeout: 8_000 });
      registrar("it-lock-concurrencia", p2.acquired === false, `p2.acquired=${p2.acquired}`);
      hold();
      const r1 = await p1;
      registrar(
        "it-lock-titular",
        r1.acquired === true && r1.value === "a",
        JSON.stringify(r1)
      );

      let fallo = "";
      try {
        await withRecordatorioLock(c1, async () => {
          throw new Error("boom-lock");
        });
      } catch (err) {
        fallo = err instanceof Error ? err.message : String(err);
      }
      registrar("it-lock-error", fallo.includes("boom-lock"), fallo.slice(0, 80));

      const despues = await withRecordatorioLock(c2, async () => "ok", { timeout: 8_000 });
      registrar(
        "it-lock-tras-fallo",
        despues.acquired === true && despues.value === "ok",
        JSON.stringify(despues)
      );
    } finally {
      await c1.$disconnect();
      await c2.$disconnect();
    }

    const endpoint = "https://push.example.com/ep-itest-1";
    const keys = { p256dh: "p".repeat(24), auth: "a".repeat(16) };
    const altaA = await registrarSuscripcionPush(prisma, {
      tecnicoId: "tec-a",
      endpoint,
      ...keys,
    });
    const altaB = await registrarSuscripcionPush(prisma, {
      tecnicoId: "tec-b",
      endpoint,
      p256dh: "q".repeat(24),
      auth: "b".repeat(16),
    });
    const subA = await prisma.tecnicoPushSubscription.findMany({ where: { tecnicoId: "tec-a" } });
    const subB = await prisma.tecnicoPushSubscription.findMany({ where: { tecnicoId: "tec-b" } });
    const inboxA = await prisma.notificacionTecnico.findMany({ where: { tecnicoId: "tec-a" } });
    registrar(
      "it-push-reasignar",
      altaA.accion === "crear" &&
        altaB.accion === "desvincular_y_crear" &&
        subA.length === 0 &&
        subB.length === 1 &&
        inboxA.every((n) => n.tecnicoId === "tec-a"),
      `A.subs=${subA.length} B.subs=${subB.length} inboxA=${inboxA.length}`
    );

    const cfgRow = await prisma.recordatorioTareaConfig.findUnique({ where: { id: "default" } });
    registrar("it-config", !!cfgRow && cfgRow.minutosAnticipacion === 30, JSON.stringify(cfgRow?.minutosAnticipacion));

    const pushOff = planificarRecordatorios({
      now: new Date("2026-10-24T17:35:00.000Z"),
      config: { ...cfg, pushHabilitado: false },
      tickets: [ticketA],
      clavesExistentes: new Set(),
    });
    registrar(
      "it-interno-sin-push",
      pushOff.some((p) => p.tipo === "ASIGNACION") && pushOff.some((p) => p.tipo === "PREVIO_VENCIMIENTO"),
      pushOff.map((p) => p.tipo).join(",")
    );
  } finally {
    await prisma.$disconnect();
    psql("postgres", `DROP DATABASE IF EXISTS ${ITEST_DB} WITH (FORCE);`);
  }

  const fallos = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - fallos.length}/${resultados.length} PASS`);
  if (fallos.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  try {
    psql("postgres", `DROP DATABASE IF EXISTS ${ITEST_DB} WITH (FORCE);`);
  } catch {
    /* ignore */
  }
  process.exit(1);
});
