import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcularDuracionAtencionSegundos,
  derivarEstadoCronometroAtencion,
  formatHHMMSS,
  ticketAdmiteCronometroAtencion,
  UMBRAL_ATENCION_CRITICA_SEG,
  UMBRAL_ATENCION_PROLONGADA_SEG,
} from "./estado";
import {
  autorizarInicioLectura,
  detenerCronometroAtencionEnTx,
  iniciarLecturaAtencion,
  type CronometroAtencionDbLike,
} from "./servicio";

type Row = {
  id: string;
  ticketId: string;
  tecnicoId: string;
  iniciadoPorUsuarioId: string;
  iniciadoEn: Date;
  finalizadoEn: Date | null;
  finalizadoPorUsuarioId: string | null;
  finalizadoPorTecnicoId: string | null;
  duracionSegundos: number | null;
};

function crearDbEnMemoria(opts?: { simularCarreraP2002?: boolean }) {
  const rows = new Map<string, Row>();
  const eventos: { ticketId: string; accion: string }[] = [];
  let seq = 0;

  const db: CronometroAtencionDbLike = {
    ticketCronometroAtencion: {
      async findUnique({ where }) {
        return rows.get(where.ticketId) ?? null;
      },
      async create({ data }) {
        if (rows.has(data.ticketId)) {
          const err = new Error("Unique constraint failed") as Error & { code?: string };
          err.code = "P2002";
          throw err;
        }
        const row: Row = {
          id: `ca_${++seq}`,
          ticketId: data.ticketId,
          tecnicoId: data.tecnicoId,
          iniciadoPorUsuarioId: data.iniciadoPorUsuarioId,
          iniciadoEn: data.iniciadoEn,
          finalizadoEn: null,
          finalizadoPorUsuarioId: null,
          finalizadoPorTecnicoId: null,
          duracionSegundos: null,
        };
        rows.set(data.ticketId, row);
        return row;
      },
      async updateMany({ where, data }) {
        const cur = rows.get(where.ticketId);
        if (!cur || cur.finalizadoEn !== null) return { count: 0 };
        rows.set(where.ticketId, {
          ...cur,
          finalizadoEn: data.finalizadoEn,
          duracionSegundos: data.duracionSegundos,
          finalizadoPorUsuarioId: data.finalizadoPorUsuarioId,
          finalizadoPorTecnicoId: data.finalizadoPorTecnicoId,
        });
        return { count: 1 };
      },
    },
    eventoTicket: {
      async create({ data }) {
        eventos.push({ ticketId: data.ticketId, accion: data.accion });
      },
    },
  };

  if (opts?.simularCarreraP2002) {
    let checks = 0;
    const origFind = db.ticketCronometroAtencion.findUnique;
    db.ticketCronometroAtencion.findUnique = async (args) => {
      checks++;
      // Primeras dos lecturas simultáneas ven vacío antes del insert
      if (checks <= 2) return null;
      return origFind(args);
    };
  }

  return { db, rows, eventos };
}

describe("cronómetro de lectura y atención — inicio y duplicados", () => {
  it("inicia correctamente el cronómetro y registra auditoría", async () => {
    const { db, rows, eventos } = crearDbEnMemoria();
    const t0 = new Date("2026-11-26T15:00:00.000Z");

    const res = await iniciarLecturaAtencion({
      ticketId: "t_1",
      tecnicoId: "tec_1",
      usuarioId: "usr_1",
      ahora: t0,
      db,
    });

    assert.equal(res.creado, true);
    assert.equal(res.yaIniciado, false);
    assert.equal(res.cronometro.estado, "EN_ATENCION");
    assert.equal(res.cronometro.iniciadoEn, t0.toISOString());
    assert.equal(res.cronometro.finalizadoEn, null);
    assert.equal(rows.size, 1);
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].accion, "LECTURA_ATENCION_INICIADA");
  });

  it("evita inicio duplicado en doble clic o refresco", async () => {
    const { db, rows, eventos } = crearDbEnMemoria();
    const t0 = new Date("2026-11-26T15:00:00.000Z");
    const t1 = new Date("2026-11-26T15:05:00.000Z");

    const r1 = await iniciarLecturaAtencion({
      ticketId: "t_dup",
      tecnicoId: "tec_1",
      usuarioId: "usr_1",
      ahora: t0,
      db,
    });
    const r2 = await iniciarLecturaAtencion({
      ticketId: "t_dup",
      tecnicoId: "tec_1",
      usuarioId: "usr_1",
      ahora: t1,
      db,
    });

    assert.equal(r1.creado, true);
    assert.equal(r2.creado, false);
    assert.equal(r2.yaIniciado, true);
    assert.equal(r2.cronometro.iniciadoEn, t0.toISOString());
    assert.equal(r2.cronometro.duracionSegundos, 300);
    assert.equal(rows.size, 1);
    assert.equal(eventos.length, 1);
  });

  it("evita duplicados ante solicitudes concurrentes (P2002)", async () => {
    const { db, rows } = crearDbEnMemoria({ simularCarreraP2002: true });
    const t0 = new Date("2026-11-26T15:00:00.000Z");

    const [a, b] = await Promise.all([
      iniciarLecturaAtencion({
        ticketId: "t_race",
        tecnicoId: "tec_1",
        usuarioId: "usr_1",
        ahora: t0,
        db,
      }),
      iniciarLecturaAtencion({
        ticketId: "t_race",
        tecnicoId: "tec_1",
        usuarioId: "usr_1",
        ahora: t0,
        db,
      }),
    ]);

    assert.equal(rows.size, 1);
    assert.equal([a.creado, b.creado].filter(Boolean).length, 1);
    assert.equal([a.yaIniciado, b.yaIniciado].filter(Boolean).length, 1);
  });
});

describe("persistencia al recargar y cálculo de duración", () => {
  it("calcula el tiempo transcurrido real desde la marca de tiempo del servidor al recargar", () => {
    const inicio = new Date("2026-11-26T14:00:00.000Z");
    const recarga = new Date("2026-11-26T15:23:45.000Z").getTime();

    const vista = derivarEstadoCronometroAtencion(
      {
        iniciadoEn: inicio,
        finalizadoEn: null,
        duracionSegundos: null,
      },
      recarga
    );

    assert.equal(vista.estado, "EN_ATENCION");
    assert.equal(vista.duracionSegundos, 5025);
    assert.equal(formatHHMMSS(vista.duracionSegundos), "01:23:45");
    assert.equal(vista.alerta, "PROLONGADA");
  });

  it("marca alerta visual CRITICA cuando supera el umbral prolongado sin cambiar prioridad", () => {
    const inicio = new Date("2026-11-26T12:00:00.000Z");
    const ahoraMs = inicio.getTime() + (UMBRAL_ATENCION_CRITICA_SEG + 10) * 1000;
    const vista = derivarEstadoCronometroAtencion(
      { iniciadoEn: inicio, finalizadoEn: null, duracionSegundos: null },
      ahoraMs
    );
    assert.equal(vista.alerta, "CRITICA");
    assert.ok(vista.duracionSegundos > UMBRAL_ATENCION_PROLONGADA_SEG);
  });

  it("formatea HH:MM:SS correctamente para 0s, minutos y horas largas", () => {
    assert.equal(formatHHMMSS(0), "00:00:00");
    assert.equal(formatHHMMSS(65), "00:01:05");
    assert.equal(formatHHMMSS(3661), "01:01:01");
    assert.equal(formatHHMMSS(100 * 3600 + 5), "100:00:05");
    assert.equal(
      calcularDuracionAtencionSegundos(
        "2026-11-26T10:00:00.000Z",
        "2026-11-26T10:45:30.000Z"
      ),
      2730
    );
  });
});

describe("detención al guardar informe y resiliencia ante fallos", () => {
  it("detiene el cronómetro al guardar el informe y persiste duración en segundos", async () => {
    const { db, rows } = crearDbEnMemoria();
    const inicio = new Date("2026-11-26T15:00:00.000Z");
    const fin = new Date("2026-11-26T15:37:12.000Z");

    await iniciarLecturaAtencion({
      ticketId: "t_fin",
      tecnicoId: "tec_1",
      usuarioId: "usr_1",
      ahora: inicio,
      db,
    });

    const stop = await detenerCronometroAtencionEnTx(db, {
      ticketId: "t_fin",
      usuarioId: "usr_1",
      tecnicoId: "tec_1",
      ahora: fin,
    });

    assert.equal(stop.detenido, true);
    assert.equal(stop.duracionSegundos, 2232);

    const row = rows.get("t_fin")!;
    const vista = derivarEstadoCronometroAtencion(row, fin.getTime() + 60_000);
    assert.equal(vista.estado, "INFORME_REGISTRADO");
    assert.equal(vista.duracionSegundos, 2232);
    assert.equal(formatHHMMSS(vista.duracionSegundos), "00:37:12");
    assert.equal(vista.alerta, "NORMAL");
  });

  it("mantiene el cronómetro activo si falla el envío del informe (error o rollback)", async () => {
    const { db, rows } = crearDbEnMemoria();
    const inicio = new Date("2026-11-26T15:00:00.000Z");

    await iniciarLecturaAtencion({
      ticketId: "t_fail",
      tecnicoId: "tec_1",
      usuarioId: "usr_1",
      ahora: inicio,
      db,
    });

    // Simula transacción fallida al guardar el informe: se revierte el snapshot
    const snapshotAntes = { ...rows.get("t_fail")! };
    try {
      await detenerCronometroAtencionEnTx(db, {
        ticketId: "t_fail",
        usuarioId: "usr_1",
        tecnicoId: "tec_1",
        ahora: new Date("2026-11-26T15:10:00.000Z"),
      });
      throw new Error("DB write failure saving report");
    } catch {
      rows.set("t_fail", snapshotAntes);
    }

    const after = rows.get("t_fail")!;
    assert.equal(after.finalizadoEn, null);
    assert.equal(after.duracionSegundos, null);
    const vista = derivarEstadoCronometroAtencion(
      after,
      new Date("2026-11-26T15:20:00.000Z").getTime()
    );
    assert.equal(vista.estado, "EN_ATENCION");
    assert.equal(vista.duracionSegundos, 1200);
  });
});

describe("autorización de técnico y compatibilidad con tickets antiguos", () => {
  const ticketSoporte = {
    id: "t_auth",
    tipo: "SOPORTE",
    estado: "PENDIENTE",
    tecnicoId: "tec_1",
    tecnicos: [{ tecnicoId: "tec_1" }],
  };

  it("permite iniciar al técnico asignado y rechaza a otro técnico o usuario no técnico", () => {
    assert.equal(
      autorizarInicioLectura(ticketSoporte, { id: "u1", rol: "TECNICO", tecnicoId: "tec_1" }).ok,
      true
    );

    const otroTec = autorizarInicioLectura(ticketSoporte, {
      id: "u2",
      rol: "TECNICO",
      tecnicoId: "tec_2",
    });
    assert.equal(otroTec.ok, false);
    if (!otroTec.ok) assert.equal(otroTec.status, 403);

    const supervisor = autorizarInicioLectura(ticketSoporte, {
      id: "u3",
      rol: "SUPERVISOR",
      tecnicoId: null,
    });
    assert.equal(supervisor.ok, false);
    if (!supervisor.ok) assert.equal(supervisor.status, 401);
  });

  it("rechaza tickets de infraestructura y tickets cerrados", () => {
    assert.equal(ticketAdmiteCronometroAtencion("INFRAESTRUCTURA"), false);
    assert.equal(ticketAdmiteCronometroAtencion("SOPORTE"), true);
    assert.equal(ticketAdmiteCronometroAtencion("CAMBIO_DOMICILIO"), true);
    assert.equal(ticketAdmiteCronometroAtencion("MIGRACION_SERVICIO_FIBRA"), true);

    const infra = autorizarInicioLectura(
      { ...ticketSoporte, tipo: "INFRAESTRUCTURA" },
      { id: "u1", rol: "TECNICO", tecnicoId: "tec_1" }
    );
    assert.equal(infra.ok, false);

    const cerrado = autorizarInicioLectura(
      { ...ticketSoporte, estado: "FINALIZADO" },
      { id: "u1", rol: "TECNICO", tecnicoId: "tec_1" }
    );
    assert.equal(cerrado.ok, false);
  });

  it("es compatible con tickets antiguos sin registro de cronómetro de atención", async () => {
    const vistaLegacy = derivarEstadoCronometroAtencion(null);
    assert.equal(vistaLegacy.estado, "PENDIENTE_LECTURA");
    assert.equal(vistaLegacy.duracionSegundos, 0);
    assert.equal(vistaLegacy.alerta, "NORMAL");
    assert.equal(formatHHMMSS(vistaLegacy.duracionSegundos), "00:00:00");

    // Cerrar un ticket antiguo sin cronómetro de atención no debe fallar
    const { db } = crearDbEnMemoria();
    const stopLegacy = await detenerCronometroAtencionEnTx(db, {
      ticketId: "t_legacy_sin_cron",
      usuarioId: "usr_1",
      tecnicoId: "tec_1",
    });
    assert.equal(stopLegacy.detenido, false);
    assert.equal(stopLegacy.duracionSegundos, null);
  });
});
