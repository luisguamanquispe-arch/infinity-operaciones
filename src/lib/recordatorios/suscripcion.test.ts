import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decidirAccionSuscripcionPush } from "./suscripcion";

describe("suscripciones push", () => {
  it("crea cuando el endpoint no existe", () => {
    assert.equal(decidirAccionSuscripcionPush(null, "tec-a"), "crear");
  });

  it("actualiza si el endpoint ya es del técnico autenticado", () => {
    assert.equal(
      decidirAccionSuscripcionPush({ id: "s1", tecnicoId: "tec-a" }, "tec-a"),
      "actualizar"
    );
  });

  it("desvincula al dueño anterior antes de registrar al técnico actual", () => {
    assert.equal(
      decidirAccionSuscripcionPush({ id: "s1", tecnicoId: "tec-a" }, "tec-b"),
      "desvincular_y_crear"
    );
  });

  it("un técnico no hereda el identificador del otro", () => {
    const accion = decidirAccionSuscripcionPush({ id: "s1", tecnicoId: "tec-a" }, "tec-b");
    assert.notEqual(accion, "actualizar");
  });
});
