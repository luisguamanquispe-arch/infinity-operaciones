import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rangoDiaActualEcuador,
  ticketCorrespondeAHoyEcuador,
  ticketVisibleParaTecnicoHoy,
  whereTicketsTecnicoHoyEcuador,
  type TicketVisibilidadTecnicoInput,
} from "./tecnico-fecha-hoy";

const TEC_A = "tec_a";
const TEC_B = "tec_b";

function makeTicket(
  overrides: Partial<TicketVisibilidadTecnicoInput> = {}
): TicketVisibilidadTecnicoInput {
  return {
    estado: "PENDIENTE",
    programadoEn: new Date("2026-11-27T10:00:00-05:00"),
    createdAt: new Date("2026-11-25T09:00:00-05:00"),
    tecnicoId: TEC_A,
    tecnicos: [{ tecnicoId: TEC_A }],
    orden: null,
    ...overrides,
  };
}

describe("filtro de tickets del técnico por fecha actual (America/Guayaquil)", () => {
  const ahoraMediodiaEc = new Date("2026-11-27T12:00:00-05:00");

  it("1) ticket programado para hoy aparece para el técnico asignado", () => {
    const t = makeTicket({
      programadoEn: new Date("2026-11-27T15:30:00-05:00"),
      createdAt: new Date("2026-11-20T10:00:00-05:00"), // creado días antes, programado hoy
    });
    assert.equal(ticketVisibleParaTecnicoHoy(t, TEC_A, ahoraMediodiaEc), true);

    // También funciona para ticket sin programadoEn creado hoy
    const sinProgHoy = makeTicket({
      programadoEn: null,
      createdAt: new Date("2026-11-27T08:15:00-05:00"),
    });
    assert.equal(ticketVisibleParaTecnicoHoy(sinProgHoy, TEC_A, ahoraMediodiaEc), true);
  });

  it("2) ticket programado para mañana no aparece", () => {
    const tManana = makeTicket({
      programadoEn: new Date("2026-11-28T08:00:00-05:00"),
      createdAt: new Date("2026-11-27T09:00:00-05:00"), // creado hoy, pero programado mañana
    });
    assert.equal(ticketVisibleParaTecnicoHoy(tManana, TEC_A, ahoraMediodiaEc), false);
    assert.equal(ticketCorrespondeAHoyEcuador(tManana, ahoraMediodiaEc), false);
  });

  it("3) ticket programado para ayer no aparece", () => {
    const tAyer = makeTicket({
      programadoEn: new Date("2026-11-26T17:00:00-05:00"),
      createdAt: new Date("2026-11-26T09:00:00-05:00"),
    });
    assert.equal(ticketVisibleParaTecnicoHoy(tAyer, TEC_A, ahoraMediodiaEc), false);

    // Sin programadoEn creado ayer tampoco aparece
    const sinProgAyer = makeTicket({
      programadoEn: null,
      createdAt: new Date("2026-11-26T18:00:00-05:00"),
    });
    assert.equal(ticketVisibleParaTecnicoHoy(sinProgAyer, TEC_A, ahoraMediodiaEc), false);
  });

  it("4) ticket asignado a otro técnico no aparece", () => {
    const tOtro = makeTicket({
      programadoEn: new Date("2026-11-27T11:00:00-05:00"),
      tecnicoId: TEC_B,
      tecnicos: [{ tecnicoId: TEC_B }],
    });
    assert.equal(ticketVisibleParaTecnicoHoy(tOtro, TEC_A, ahoraMediodiaEc), false);
    assert.equal(ticketVisibleParaTecnicoHoy(tOtro, TEC_B, ahoraMediodiaEc), true);

    // Multi-técnico: si TEC_A está en `tecnicos`, sí aparece
    const tMulti = makeTicket({
      programadoEn: new Date("2026-11-27T11:00:00-05:00"),
      tecnicoId: TEC_B,
      tecnicos: [{ tecnicoId: TEC_B }, { tecnicoId: TEC_A }],
    });
    assert.equal(ticketVisibleParaTecnicoHoy(tMulti, TEC_A, ahoraMediodiaEc), true);
  });

  it("5) cambio de día en Ecuador actualiza correctamente los tickets visibles", () => {
    const ticketDia26 = makeTicket({
      programadoEn: new Date("2026-11-26T16:00:00-05:00"),
    });
    const ticketDia27 = makeTicket({
      programadoEn: new Date("2026-11-27T09:00:00-05:00"),
    });

    const antesMedianocheEc = new Date("2026-11-26T23:59:59-05:00");
    assert.equal(ticketVisibleParaTecnicoHoy(ticketDia26, TEC_A, antesMedianocheEc), true);
    assert.equal(ticketVisibleParaTecnicoHoy(ticketDia27, TEC_A, antesMedianocheEc), false);

    const despuesMedianocheEc = new Date("2026-11-27T00:00:00-05:00");
    assert.equal(ticketVisibleParaTecnicoHoy(ticketDia26, TEC_A, despuesMedianocheEc), false);
    assert.equal(ticketVisibleParaTecnicoHoy(ticketDia27, TEC_A, despuesMedianocheEc), true);
  });

  it("6) cerca de medianoche local no confunde la fecha de Ecuador con UTC", () => {
    // 2026-11-27T04:30:00.000Z es 2026-11-26 23:30:00 en Ecuador (UTC-5),
    // aunque en UTC ya sea 2026-11-27.
    const ahoraUtcSiguienteDia = new Date("2026-11-27T04:30:00.000Z");
    const rango = rangoDiaActualEcuador(ahoraUtcSiguienteDia);

    assert.equal(rango.fechaLocal, "2026-11-26");
    assert.equal(rango.inicio.toISOString(), "2026-11-26T05:00:00.000Z");
    assert.equal(rango.finExclusivo.toISOString(), "2026-11-27T05:00:00.000Z");

    const ticketHoyEc2345 = makeTicket({
      // 23:45 Ecuador del 26 nov = 04:45Z del 27 nov
      programadoEn: new Date("2026-11-27T04:45:00.000Z"),
    });
    const ticketMananaEc0005 = makeTicket({
      // 00:05 Ecuador del 27 nov = 05:05Z del 27 nov
      programadoEn: new Date("2026-11-27T05:05:00.000Z"),
    });

    assert.equal(ticketVisibleParaTecnicoHoy(ticketHoyEc2345, TEC_A, ahoraUtcSiguienteDia), true);
    assert.equal(ticketVisibleParaTecnicoHoy(ticketMananaEc0005, TEC_A, ahoraUtcSiguienteDia), false);
  });

  it("7) el filtro no modifica datos ni estados de tickets y genera WHERE correcto para Prisma", () => {
    const ticketCongelado = Object.freeze(
      makeTicket({
        estado: "EN_PROCESO",
        programadoEn: new Date("2026-11-27T14:00:00-05:00"),
      })
    );
    const snapshotAntes = JSON.stringify(ticketCongelado);

    const visible = ticketVisibleParaTecnicoHoy(ticketCongelado, TEC_A, ahoraMediodiaEc);
    assert.equal(visible, true);
    assert.equal(JSON.stringify(ticketCongelado), snapshotAntes);

    // Verifica que whereTicketsTecnicoHoyEcuador construye rango exacto [inicio, finExclusivo)
    const where = whereTicketsTecnicoHoyEcuador(TEC_A, ahoraMediodiaEc);
    assert.ok(Array.isArray(where.AND));
    const serializado = JSON.stringify(where);
    assert.match(serializado, /2026-11-27T05:00:00\.000Z/);
    assert.match(serializado, /2026-11-28T05:00:00\.000Z/);
    assert.match(serializado, /tec_a/);
  });
});
