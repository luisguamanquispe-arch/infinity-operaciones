import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clasificarVistaTecnicoApp } from "./ticket-antiguedad";
import { asignacionEstaCompleta } from "./ticket-asignacion";

const now = new Date("2026-08-15T12:00:00-05:00");
const TEC = "tec-a";

function ticket(diasAtras: number, extra?: { estado?: string; estadoRevision?: string | null; tecnicoId?: string | null; tecnicos?: { tecnicoId: string }[] }) {
  return {
    estado: extra?.estado ?? "PENDIENTE",
    estadoRevision: extra?.estadoRevision ?? null,
    programadoEn: null,
    createdAt: new Date(now.getTime() - diasAtras * 86400000),
    tecnicoId: extra?.tecnicoId === undefined ? TEC : extra.tecnicoId,
    tecnicos: extra?.tecnicos ?? [{ tecnicoId: TEC }],
  };
}

describe("asignación completa TicketTecnico + tecnicoId", () => {
  it("PRUEBA CRÍTICA 4-5: exige ambos", () => {
    const ok = asignacionEstaCompleta(
      { tecnicoId: TEC, tecnicos: [{ tecnicoId: TEC }] },
      [TEC]
    );
    assert.equal(ok.ok, true);

    const sinFila = asignacionEstaCompleta({ tecnicoId: TEC, tecnicos: [] }, [TEC]);
    assert.equal(sinFila.ok, false);
    assert.match(sinFila.error, /TicketTecnico/);

    const sinId = asignacionEstaCompleta(
      { tecnicoId: null, tecnicos: [{ tecnicoId: TEC }] },
      [TEC]
    );
    assert.equal(sinId.ok, false);
    assert.match(sinId.error, /tecnicoId/);

    const vacio = asignacionEstaCompleta({ tecnicoId: null, tecnicos: [] }, []);
    assert.equal(vacio.ok, false);
  });
});

describe("PRUEBA CRÍTICA visibilidad App (regla 4 días)", () => {
  it("1 día → Mis órdenes", () => {
    assert.equal(clasificarVistaTecnicoApp(ticket(1), TEC, now), "mis_ordenes");
  });

  it("3 días → Mis órdenes", () => {
    assert.equal(clasificarVistaTecnicoApp(ticket(3), TEC, now), "mis_ordenes");
  });

  it("4 días → No atendidos (sigue visible)", () => {
    assert.equal(clasificarVistaTecnicoApp(ticket(4), TEC, now), "no_atendidos");
  });

  it("10 días → No atendidos (sigue visible)", () => {
    assert.equal(clasificarVistaTecnicoApp(ticket(10), TEC, now), "no_atendidos");
  });

  it("sin asignación → no_asignado (no aparece)", () => {
    assert.equal(
      clasificarVistaTecnicoApp(
        ticket(1, { tecnicoId: null, tecnicos: [] }),
        TEC,
        now
      ),
      "no_asignado"
    );
  });

  it("FINALIZADO / PENDIENTE_REVISION no está en Mis órdenes", () => {
    assert.equal(
      clasificarVistaTecnicoApp(
        ticket(1, { estado: "FINALIZADO", estadoRevision: "PENDIENTE_REVISION" }),
        TEC,
        now
      ),
      "cerrado"
    );
  });

  it("DEVUELTO_CORRECCION sigue en por_corregir aunque tenga 10 días", () => {
    assert.equal(
      clasificarVistaTecnicoApp(
        ticket(10, { estado: "FINALIZADO", estadoRevision: "DEVUELTO_CORRECCION" }),
        TEC,
        now
      ),
      "por_corregir"
    );
  });
});
