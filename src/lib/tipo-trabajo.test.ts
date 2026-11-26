import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TipoTrabajo } from "@prisma/client";
import { TIPO_LABELS } from "./utils";
import { ticketEliminableEnGerencia } from "./ticket-gerencia";

describe("TipoTrabajo — Cambio de domicilio y Migración de servicio a fibra", () => {
  it("expone ambos valores en el enum TipoTrabajo de Prisma", () => {
    assert.equal(TipoTrabajo.CAMBIO_DOMICILIO, "CAMBIO_DOMICILIO");
    assert.equal(TipoTrabajo.MIGRACION_SERVICIO_FIBRA, "MIGRACION_SERVICIO_FIBRA");
  });

  it("mantiene las etiquetas existentes y agrega las dos nuevas en TIPO_LABELS", () => {
    assert.equal(TIPO_LABELS.SOPORTE, "Soporte");
    assert.equal(TIPO_LABELS.INSTALACION, "Instalación");
    assert.equal(TIPO_LABELS.RECONEXION, "Reconexión");
    assert.equal(TIPO_LABELS.CORTE, "Corte");
    assert.equal(TIPO_LABELS.MIGRACION, "Migración");
    assert.equal(TIPO_LABELS.RETIRO, "Retiro de equipo");
    assert.equal(TIPO_LABELS.CAMBIO_DOMICILIO, "Cambio de domicilio");
    assert.equal(
      TIPO_LABELS.MIGRACION_SERVICIO_FIBRA,
      "Migración de servicio a fibra"
    );
  });

  it("permite gestión en gerencia para ambos tipos de cliente", () => {
    assert.equal(ticketEliminableEnGerencia(TipoTrabajo.CAMBIO_DOMICILIO), true);
    assert.equal(
      ticketEliminableEnGerencia(TipoTrabajo.MIGRACION_SERVICIO_FIBRA),
      true
    );
  });
});
