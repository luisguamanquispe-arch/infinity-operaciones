import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Simula el claim atómico de updateMany(where: clienteRiesgoBaja=false).
 * No requiere PostgreSQL: modela la semántica usada por activarRiesgoBaja /
 * registrarGestionRiesgoBaja.
 */
function createTicketStore(initial: {
  clienteRiesgoBaja: boolean;
  clienteRiesgoBajaResueltoEn: string | null;
  prioridad: string;
}) {
  const state = { ...initial, alertas: 0, resoluciones: 0, gestiones: 0 };
  let claimLock = Promise.resolve();

  async function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    const prev = claimLock;
    let release!: () => void;
    claimLock = new Promise<void>((r) => {
      release = r;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  return {
    state,
    async activar() {
      return withLock(async () => {
        if (state.clienteRiesgoBaja) {
          return { yaActivo: true as const };
        }
        state.clienteRiesgoBaja = true;
        state.prioridad = "ALTA";
        if (state.alertas === 0) state.alertas = 1;
        return { yaActivo: false as const };
      });
    },
    async recuperar(obs: string) {
      return withLock(async () => {
        if (!state.clienteRiesgoBaja) {
          throw new Error("sin riesgo");
        }
        if (state.clienteRiesgoBajaResueltoEn) {
          throw new Error("ya resuelto");
        }
        if (!obs || obs.trim().length < 8) {
          throw new Error("obs");
        }
        // claim resolución
        if (state.clienteRiesgoBajaResueltoEn) {
          throw new Error("ya resuelto");
        }
        state.clienteRiesgoBajaResueltoEn = new Date().toISOString();
        state.gestiones += 1;
        state.resoluciones += 1;
        return { resuelto: true as const };
      });
    },
    async gestionarSinResolver() {
      return withLock(async () => {
        if (!state.clienteRiesgoBaja) throw new Error("sin riesgo");
        if (state.clienteRiesgoBajaResueltoEn) throw new Error("ya resuelto");
        state.gestiones += 1;
        return { resuelto: false as const };
      });
    },
  };
}

describe("concurrencia simulada — activación riesgo", () => {
  it("dos activaciones simultáneas → una sola alerta y prioridad ALTA", async () => {
    const store = createTicketStore({
      clienteRiesgoBaja: false,
      clienteRiesgoBajaResueltoEn: null,
      prioridad: "MEDIA",
    });
    const [a, b] = await Promise.all([store.activar(), store.activar()]);
    const winners = [a, b].filter((x) => !x.yaActivo);
    assert.equal(winners.length, 1);
    assert.equal(store.state.alertas, 1);
    assert.equal(store.state.prioridad, "ALTA");
    assert.equal(store.state.clienteRiesgoBaja, true);
  });
});

describe("concurrencia simulada — RECUPERADO", () => {
  it("dos gestiones RECUPERADO simultáneas → una sola resolución", async () => {
    const store = createTicketStore({
      clienteRiesgoBaja: true,
      clienteRiesgoBajaResueltoEn: null,
      prioridad: "ALTA",
    });
    const results = await Promise.allSettled([
      store.recuperar("Cliente conforme tras visita técnica"),
      store.recuperar("Cliente conforme tras visita técnica"),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(fail.length, 1);
    assert.equal(store.state.resoluciones, 1);
    assert.ok(store.state.clienteRiesgoBajaResueltoEn);
  });

  it("gestión posterior a resolución → rechazada", async () => {
    const store = createTicketStore({
      clienteRiesgoBaja: true,
      clienteRiesgoBajaResueltoEn: null,
      prioridad: "ALTA",
    });
    await store.recuperar("Documentacion de recuperacion del cliente");
    await assert.rejects(() => store.gestionarSinResolver(), /ya resuelto/);
  });
});

describe("rollback de creación con riesgo (contrato de orquestación)", () => {
  it("si la activación falla, el estado transaccional simulado queda vacío", async () => {
    const ops: string[] = [];
    async function crearConRiesgo(activarOk: boolean) {
      const pending: string[] = [];
      try {
        pending.push("ticket");
        pending.push("TICKET_CREADO");
        if (!activarOk) throw new Error("activar falló");
        pending.push("ALERTA_CLIENTE_RIESGO_BAJA");
        ops.push(...pending);
      } catch {
        // rollback: no se confirman ops
        return { committed: false as const, ops: [] as string[] };
      }
      return { committed: true as const, ops: [...ops] };
    }

    const fail = await crearConRiesgo(false);
    assert.equal(fail.committed, false);
    assert.deepEqual(fail.ops, []);

    const ok = await crearConRiesgo(true);
    assert.equal(ok.committed, true);
    assert.deepEqual(ok.ops, [
      "ticket",
      "TICKET_CREADO",
      "ALERTA_CLIENTE_RIESGO_BAJA",
    ]);
  });
});
