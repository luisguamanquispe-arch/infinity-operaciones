import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bodyIntentaMutarRiesgo,
  resolverMotivoEnPatch,
  rolPuedeGestionarRiesgoBaja,
  ticketTieneMotivoEstructurado,
  validarObservacionesRecuperacion,
  validarPrioridadConRiesgoActivo,
  type TicketMotivoSnapshot,
} from "./reglas-patch";

function ticketBase(
  overrides: Partial<TicketMotivoSnapshot> = {}
): TicketMotivoSnapshot {
  return {
    motivo: "MOTIVO LEGACY",
    descripcion: "DESC",
    motivoCategoria: null,
    motivoCategoriaOtro: null,
    motivoProblema: null,
    motivoProblemaOtro: null,
    motivoDetalle: null,
    motivoImpacto: null,
    motivoObservaciones: null,
    clienteRiesgoBaja: false,
    clienteRiesgoBajaResueltoEn: null,
    prioridad: "MEDIA",
    ...overrides,
  };
}

const estructuradoOk = {
  motivoCategoria: "INTERNET_SIN_SERVICIO",
  motivoProblema: "SIN_SENAL_OPTICA",
  motivoDetalle: "Cliente sin conexion desde las 08:30, ONU sin luz PON",
  motivoImpacto: "TOTAL_DOMICILIO",
  motivoObservaciones: "",
};

describe("rolPuedeGestionarRiesgoBaja", () => {
  it("permite SUPERVISOR y ADMIN; rechaza TECNICO y HELP_DESK", () => {
    assert.equal(rolPuedeGestionarRiesgoBaja("SUPERVISOR"), true);
    assert.equal(rolPuedeGestionarRiesgoBaja("ADMIN"), true);
    assert.equal(rolPuedeGestionarRiesgoBaja("TECNICO"), false);
    assert.equal(rolPuedeGestionarRiesgoBaja("HELP_DESK"), false);
    assert.equal(rolPuedeGestionarRiesgoBaja(null), false);
  });
});

describe("PATCH motivo estructurado / legacy", () => {
  it("acepta PATCH con motivo estructurado válido y regenera motivo", () => {
    const ticket = ticketBase({
      motivoCategoria: "WIFI",
      motivoProblema: "COBERTURA_WIFI",
      motivoDetalle: "Cobertura debil en segundo piso desde ayer",
      motivoImpacto: "PARCIAL",
    });
    assert.equal(ticketTieneMotivoEstructurado(ticket), true);
    const r = resolverMotivoEnPatch(ticket, estructuradoOk);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.match(String(r.update.motivo), /INTERNET SIN SERVICIO|Internet/i);
      assert.equal(r.update.motivoCategoria, "INTERNET_SIN_SERVICIO");
      assert.equal(r.update.motivoProblema, "SIN_SENAL_OPTICA");
    }
  });

  it("rechaza PATCH con detalle genérico en ticket estructurado", () => {
    const ticket = ticketBase({
      motivoCategoria: "WIFI",
      motivoProblema: "COBERTURA_WIFI",
      motivoDetalle: "Cobertura debil en segundo piso desde ayer",
      motivoImpacto: "PARCIAL",
    });
    const r = resolverMotivoEnPatch(ticket, {
      ...estructuradoOk,
      motivoDetalle: "internet",
    });
    assert.equal(r.ok, false);
  });

  it("ignora motivo libre en ticket estructurado (no desincroniza)", () => {
    const ticket = ticketBase({
      motivo: "GENERADO ORIGINAL",
      motivoCategoria: "WIFI",
      motivoProblema: "COBERTURA_WIFI",
      motivoDetalle: "Cobertura debil en segundo piso desde ayer",
      motivoImpacto: "PARCIAL",
    });
    const r = resolverMotivoEnPatch(ticket, { motivo: "texto generico malo" });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.update.motivo, undefined);
      assert.equal(Object.keys(r.update).length, 0);
    }
  });

  it("edición legacy: no toca motivo si el body no lo envía", () => {
    const ticket = ticketBase();
    const r = resolverMotivoEnPatch(ticket, { descripcion: "Nueva descripcion concreta" });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.update.motivo, undefined);
      assert.ok(r.update.descripcion);
    }
  });

  it("edición legacy: permite actualizar motivo solo si viene en body", () => {
    const ticket = ticketBase();
    const r = resolverMotivoEnPatch(ticket, { motivo: "Cable cortado en acometida externa" });
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(r.update.motivo);
  });
});

describe("prioridad con riesgo activo", () => {
  it("rechaza bajar prioridad con riesgo activo", () => {
    const r = validarPrioridadConRiesgoActivo({
      ticket: {
        clienteRiesgoBaja: true,
        clienteRiesgoBajaResueltoEn: null,
        prioridad: "ALTA",
      },
      prioridadNueva: "MEDIA",
    });
    assert.equal(r.ok, false);
  });

  it("permite cambio de prioridad si riesgo resuelto o inexistente", () => {
    const sinRiesgo = validarPrioridadConRiesgoActivo({
      ticket: {
        clienteRiesgoBaja: false,
        clienteRiesgoBajaResueltoEn: null,
        prioridad: "MEDIA",
      },
      prioridadNueva: "BAJA",
    });
    assert.equal(sinRiesgo.ok, true);

    const resuelto = validarPrioridadConRiesgoActivo({
      ticket: {
        clienteRiesgoBaja: true,
        clienteRiesgoBajaResueltoEn: new Date().toISOString(),
        prioridad: "ALTA",
      },
      prioridadNueva: "MEDIA",
    });
    assert.equal(resuelto.ok, true);
  });
});

describe("gestión recuperación y campos prohibidos", () => {
  it("exige observaciones para RECUPERADO", () => {
    assert.equal(validarObservacionesRecuperacion("ok").ok, false);
    assert.equal(
      validarObservacionesRecuperacion("Cliente acepta visita y queda conforme").ok,
      true
    );
  });

  it("detecta intento de mutar riesgo por PATCH", () => {
    assert.equal(bodyIntentaMutarRiesgo({ prioridad: "ALTA" }), false);
    assert.equal(bodyIntentaMutarRiesgo({ clienteRiesgoBaja: false }), true);
    assert.equal(bodyIntentaMutarRiesgo({ clienteSituacion: "CONFORME" }), true);
  });
});
