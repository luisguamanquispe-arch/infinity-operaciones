import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lockAdquirido, RecordatorioLockError } from "./lock";

describe("lock transaccional de recordatorios", () => {
  it("solo considera adquirido un true explícito", () => {
    assert.equal(lockAdquirido([{ locked: true }]), true);
    assert.equal(lockAdquirido([{ locked: "t" }]), true);
  });

  it("falla cerrado si no hay fila, es false o el driver no responde", () => {
    assert.equal(lockAdquirido(null), false);
    assert.equal(lockAdquirido([]), false);
    assert.equal(lockAdquirido([{ locked: false }]), false);
    assert.equal(lockAdquirido([{ locked: null }]), false);
    assert.equal(lockAdquirido([{}]), false);
  });

  it("un error de adquisición no se interpreta como lock concedido", () => {
    const err = new RecordatorioLockError("No se pudo adquirir el lock de recordatorios: sql");
    assert.equal(err.name, "RecordatorioLockError");
    assert.doesNotMatch(err.message, /omitido|continuar/i);
  });
});
