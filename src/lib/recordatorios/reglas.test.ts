import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONFIG_RECORDATORIO_DEFAULT,
  claveAsignacion,
  clasificarFalloPush,
  clasificarTarea,
  dentroDeHorarioOperativo,
  destinatariosActuales,
  fechaLimiteTicket,
  horaEnGuayaquil,
  planificarRecordatorios,
  slotRepeticionVencida,
  tareaSigueAbierta,
  textoNotificacion,
  type TicketParaRecordatorio,
} from "./reglas";

function ticket(over: Partial<TicketParaRecordatorio> = {}): TicketParaRecordatorio {
  return {
    id: "t1",
    codigo: "TCK-1",
    estado: "PENDIENTE",
    estadoRevision: null,
    prioridad: "ALTA",
    programadoEn: new Date("2026-10-24T18:00:00.000Z"),
    slaVenceEn: new Date("2026-10-24T20:00:00.000Z"),
    asignaciones: [{ tecnicoId: "tec-a", asignadoEn: new Date("2026-10-24T15:00:00.000Z") }],
    orden: { finalizadoEn: null },
    ...over,
  };
}

const cfg = { ...CONFIG_RECORDATORIO_DEFAULT, respetarHorario: false };

describe("fecha límite de recordatorios", () => {
  it("usa programadoEn y no inventa vencimiento si no hay fechas", () => {
    assert.equal(
      fechaLimiteTicket({
        programadoEn: new Date("2026-10-24T18:00:00.000Z"),
        slaVenceEn: new Date("2026-10-24T20:00:00.000Z"),
      })?.toISOString(),
      "2026-10-24T18:00:00.000Z"
    );
    assert.equal(fechaLimiteTicket({ programadoEn: null, slaVenceEn: null }), null);
  });
});

describe("asignación", () => {
  it("notifica al asignar una tarea", () => {
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T16:00:00.000Z"),
      config: cfg,
      tickets: [ticket()],
      clavesExistentes: new Set(),
    });
    assert.equal(plan.filter((p) => p.tipo === "ASIGNACION").length, 1);
    assert.equal(plan[0].tecnicoId, "tec-a");
  });
});

describe("previo al vencimiento", () => {
  it("emite recordatorio 30 minutos antes", () => {
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T17:35:00.000Z"),
      config: cfg,
      tickets: [ticket()],
      clavesExistentes: new Set(),
    });
    assert.ok(plan.some((p) => p.tipo === "PREVIO_VENCIMIENTO"));
  });
});

describe("vencimiento", () => {
  it("alerta si sigue pendiente al vencer", () => {
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T18:01:00.000Z"),
      config: cfg,
      tickets: [ticket()],
      clavesExistentes: new Set(),
    });
    assert.ok(plan.some((p) => p.tipo === "VENCIMIENTO"));
  });
});

describe("repetición controlada", () => {
  it("repite cada 60 minutos hasta el máximo y no más", () => {
    const due = new Date("2026-10-24T18:00:00.000Z");
    assert.equal(slotRepeticionVencida(new Date("2026-10-24T19:00:00.000Z"), due, 60), 1);
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T19:05:00.000Z"),
      config: { ...cfg, maxRepeticiones: 2 },
      tickets: [ticket()],
      clavesExistentes: new Set(),
    });
    assert.ok(plan.some((p) => p.tipo === "VENCIDO_REPETICION"));
    const tarde = planificarRecordatorios({
      now: new Date("2026-10-25T18:00:00.000Z"),
      config: { ...cfg, maxRepeticiones: 2 },
      tickets: [ticket()],
      clavesExistentes: new Set(),
    });
    assert.equal(tarde.filter((p) => p.tipo === "VENCIDO_REPETICION").length, 0);
  });
});

describe("idempotencia concurrente", () => {
  it("no duplica si la clave ya existe", () => {
    const now = new Date("2026-10-24T16:00:00.000Z");
    const t = ticket();
    const a = planificarRecordatorios({
      now,
      config: cfg,
      tickets: [t],
      clavesExistentes: new Set(),
    });
    const claves = new Set(a.map((p) => p.claveIdem));
    const b = planificarRecordatorios({
      now,
      config: cfg,
      tickets: [t],
      clavesExistentes: claves,
    });
    assert.ok(a.length > 0);
    assert.equal(b.length, 0);
    assert.equal(new Set(a.map((p) => p.claveIdem)).size, a.length);
  });
});

describe("estados operativos abiertos", () => {
  it("PENDIENTE, LEIDO y EN_PROCESO siguen generando avisos", () => {
    for (const estado of ["PENDIENTE", "LEIDO", "EN_PROCESO"] as const) {
      const plan = planificarRecordatorios({
        now: new Date("2026-10-24T16:00:00.000Z"),
        config: cfg,
        tickets: [ticket({ estado })],
        clavesExistentes: new Set(),
      });
      assert.ok(plan.some((p) => p.tipo === "ASIGNACION"), estado);
    }
  });
});

describe("cierre y cancelación", () => {
  it("detiene recordatorios al finalizar o cancelar", () => {
    assert.equal(
      tareaSigueAbierta({ estado: "FINALIZADO", estadoRevision: "PENDIENTE_REVISION" }),
      false
    );
    assert.equal(tareaSigueAbierta({ estado: "CANCELADO" }), false);
    assert.equal(tareaSigueAbierta({ estado: "CERRADO" }), false);
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T18:01:00.000Z"),
      config: cfg,
      tickets: [ticket({ estado: "CERRADO" })],
      clavesExistentes: new Set(),
    });
    assert.equal(plan.length, 0);
  });
});

describe("reasignación", () => {
  it("cambia el destinatario y no avisa al técnico anterior", () => {
    const t = ticket({
      asignaciones: [{ tecnicoId: "tec-b", asignadoEn: new Date("2026-10-24T16:00:00.000Z") }],
    });
    assert.deepEqual(destinatariosActuales(t), ["tec-b"]);
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T16:10:00.000Z"),
      config: cfg,
      tickets: [t],
      clavesExistentes: new Set([
        claveAsignacion("t1", "tec-a", new Date("2026-10-24T15:00:00.000Z")),
      ]),
    });
    assert.ok(plan.every((p) => p.tecnicoId === "tec-b"));
    assert.ok(!plan.some((p) => p.tecnicoId === "tec-a"));
  });
});

describe("sin fecha límite", () => {
  it("notifica la asignación y no inventa vencimiento", () => {
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T16:00:00.000Z"),
      config: cfg,
      tickets: [ticket({ programadoEn: null, slaVenceEn: null })],
      clavesExistentes: new Set(),
    });
    assert.deepEqual(
      plan.map((p) => p.tipo),
      ["ASIGNACION"]
    );
    assert.equal(clasificarTarea(ticket({ programadoEn: null, slaVenceEn: null }), new Date(), 30), "sin_limite");
  });
});

describe("permisos entre técnicos", () => {
  it("un plan nunca mezcla destinatarios de otro técnico", () => {
    const t = ticket({
      asignaciones: [
        { tecnicoId: "tec-a", asignadoEn: new Date("2026-10-24T15:00:00.000Z") },
        { tecnicoId: "tec-c", asignadoEn: new Date("2026-10-24T15:01:00.000Z") },
      ],
    });
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T16:00:00.000Z"),
      config: cfg,
      tickets: [t],
      clavesExistentes: new Set(),
    });
    const deA = plan.filter((p) => p.tecnicoId === "tec-a");
    const deC = plan.filter((p) => p.tecnicoId === "tec-c");
    assert.equal(deA.length, deC.length);
    assert.ok(deA.every((p) => p.claveIdem.includes("tec-a")));
    assert.ok(deC.every((p) => p.claveIdem.includes("tec-c")));
  });
});

describe("zona horaria Ecuador", () => {
  it("calcula la hora civil de America/Guayaquil", () => {
    const mediodiaEc = new Date("2026-10-24T17:00:00.000Z");
    assert.equal(horaEnGuayaquil(mediodiaEc), 12);
    assert.equal(
      dentroDeHorarioOperativo(mediodiaEc, {
        respetarHorario: true,
        horaInicio: 7,
        horaFin: 21,
      }),
      true
    );
    const madrugada = new Date("2026-10-24T07:00:00.000Z");
    assert.equal(horaEnGuayaquil(madrugada), 2);
    assert.equal(
      dentroDeHorarioOperativo(madrugada, {
        respetarHorario: true,
        horaInicio: 7,
        horaFin: 21,
      }),
      false
    );
  });
});

describe("fallos del canal push", () => {
  it("invalida suscripciones 404/410 y reintenta el resto", () => {
    assert.equal(clasificarFalloPush(410), "invalidar");
    assert.equal(clasificarFalloPush(404), "invalidar");
    assert.equal(clasificarFalloPush(500), "reintentar");
    assert.equal(clasificarFalloPush(0), "reintentar");
  });
});

describe("push desactivado y textos", () => {
  it("el canal interno sigue planificando si push está apagado", () => {
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T16:00:00.000Z"),
      config: { ...cfg, pushHabilitado: false },
      tickets: [ticket()],
      clavesExistentes: new Set(),
    });
    assert.ok(plan.length > 0);
    const txt = textoNotificacion("ASIGNACION", "TCK-1", "ALTA");
    assert.doesNotMatch(txt.cuerpo, /cliente|cedula|dirección/i);
  });

  it("fuera de horario no emite previo ni vencido, sí asignación", () => {
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T07:00:00.000Z"),
      config: { ...CONFIG_RECORDATORIO_DEFAULT, respetarHorario: true, horaInicio: 7, horaFin: 21 },
      tickets: [ticket({ programadoEn: new Date("2026-10-24T06:00:00.000Z") })],
      clavesExistentes: new Set(),
    });
    assert.ok(plan.some((p) => p.tipo === "ASIGNACION"));
    assert.ok(!plan.some((p) => p.tipo !== "ASIGNACION"));
  });
});

describe("volumen representativo", () => {
  it("planifica miles de tareas en un solo paso", () => {
    const tickets = Array.from({ length: 400 }, (_, i) =>
      ticket({
        id: `t-${i}`,
        codigo: `TCK-${i}`,
        asignaciones: [
          { tecnicoId: `tec-${i % 20}`, asignadoEn: new Date("2026-10-24T15:00:00.000Z") },
        ],
      })
    );
    const t0 = Date.now();
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T16:00:00.000Z"),
      config: cfg,
      tickets,
      clavesExistentes: new Set(),
    });
    const ms = Date.now() - t0;
    assert.equal(plan.length, 400);
    assert.ok(ms < 500, `tardó ${ms}ms`);
  });
});

describe("persistencia lógica tras reinicio", () => {
  it("reutiliza claves ya guardadas como si el proceso hubiera arrancado de nuevo", () => {
    const store = new Set<string>();
    const now = new Date("2026-10-24T16:00:00.000Z");
    const t = ticket();
    const primera = planificarRecordatorios({
      now,
      config: cfg,
      tickets: [t],
      clavesExistentes: store,
    });
    for (const p of primera) store.add(p.claveIdem);
    const trasReinicio = planificarRecordatorios({
      now,
      config: cfg,
      tickets: [t],
      clavesExistentes: store,
    });
    assert.ok(primera.length > 0);
    assert.equal(trasReinicio.length, 0);
  });
});

describe("DEVUELTO_CORRECCION sigue abierta", () => {
  it("un reporte devuelto genera avisos", () => {
    const plan = planificarRecordatorios({
      now: new Date("2026-10-24T18:01:00.000Z"),
      config: cfg,
      tickets: [
        ticket({
          estado: "FINALIZADO",
          estadoRevision: "DEVUELTO_CORRECCION",
        }),
      ],
      clavesExistentes: new Set(),
    });
    assert.ok(plan.some((p) => p.tipo === "VENCIMIENTO"));
  });
});
