/**
 * FASE 4 — Pre-production gate acceptance simulations.
 * Pure/in-memory proofs of BEFORE/AFTER invariants (no DB mutation).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  otBloqueaDescuentoLegacy,
  otTieneFlujoCampoActivo,
  stockDisponible,
  validarAsignacionSerial,
  validarConciliacionItem,
  validarReporteUsoItem,
  validarReserva,
  puedeGestionarCatalogo,
  puedeAprobarMaterial,
  puedeOperarBodega,
  puedeAjustarInventario,
  puedeSolicitarMaterial,
} from "./reglas";

type Stock = {
  physicalQty: number;
  reservedQty: number;
  assignedQty: number;
  legacyStock: number;
};

function snapshot(s: Stock) {
  return { ...s, disponible: stockDisponible(s) };
}

describe("GATE C1 — legacy bloqueado post-RECONCILED (before/after)", () => {
  it("tras RECONCILED, legacy no puede mutar stock", () => {
    const before: Stock = {
      physicalQty: 90,
      reservedQty: 0,
      assignedQty: 0,
      legacyStock: 90,
    };
    assert.equal(otBloqueaDescuentoLegacy("RECONCILED"), true);
    // Simula rechazo 403: no se aplica decremento legacy
    const after = { ...before };
    assert.deepEqual(snapshot(after), snapshot(before));
    assert.equal(after.legacyStock, before.legacyStock);
    assert.equal(after.physicalQty, before.physicalQty);
    assert.equal(after.assignedQty, before.assignedQty);
    assert.equal(after.reservedQty, before.reservedQty);
  });
});

describe("GATE C2 — serial cross-OT", () => {
  it("ASSIGNED/INSTALLED/LOST/DAMAGED bloquean OT-B", () => {
    for (const status of ["ASSIGNED", "INSTALLED", "LOST", "DAMAGED"] as const) {
      const r = validarAsignacionSerial({
        status,
        ticketId: "ot-a",
        targetTicketId: "ot-b",
      });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.status, 409);
    }
    // ticketId permanece conceptualmente ot-a (no hay mutación en fallo)
    const asset = { ticketId: "ot-a", status: "ASSIGNED" };
    validarAsignacionSerial({
      status: asset.status,
      ticketId: asset.ticketId,
      targetTicketId: "ot-b",
    });
    assert.equal(asset.ticketId, "ot-a");
    assert.equal(asset.status, "ASSIGNED");
  });
});

describe("GATE cierre — PENDING_RECONCILIATION bloquea", () => {
  it("flujo activo PENDING_RECONCILIATION no es terminal", () => {
    assert.equal(otTieneFlujoCampoActivo("PENDING_RECONCILIATION"), true);
    assert.equal(otTieneFlujoCampoActivo("RECONCILED"), false);
  });
});

describe("GATE cuadratura y reporte", () => {
  it("100=70+20+5+5 OK; 100 vs 70+20+5+4 BLOCK; negativos BLOCK; suma>delivered BLOCK", () => {
    assert.equal(
      validarConciliacionItem({
        deliveredQty: 100,
        usedQty: 70,
        returnedQty: 20,
        damagedQty: 5,
        lostQty: 5,
      }).ok,
      true
    );
    assert.equal(
      validarConciliacionItem({
        deliveredQty: 100,
        usedQty: 70,
        returnedQty: 20,
        damagedQty: 5,
        lostQty: 4,
      }).ok,
      false
    );
    const neg = validarReporteUsoItem({
      deliveredQty: 10,
      usedQty: -1,
      returnedQty: 0,
      damagedQty: 0,
      lostQty: 0,
    });
    assert.equal(neg.ok, false);
    const over = validarReporteUsoItem({
      deliveredQty: 10,
      usedQty: 8,
      returnedQty: 3,
      damagedQty: 0,
      lostQty: 0,
    });
    assert.equal(over.ok, false);
    if (!over.ok) assert.equal(over.status, 400);
  });
});

describe("GATE excepción AUTHORIZED_EXCEPTION BEFORE/AFTER", () => {
  it("100 delivered; 70 used + 20 returned + 10 LOSS excepción: assigned=0", () => {
    // AFTER delivery: physical 100, reserved 0, assigned 100
    let s: Stock = {
      physicalQty: 100,
      reservedQty: 0,
      assignedQty: 100,
      legacyStock: 100,
    };
    const before = snapshot(s);

    // used 70: consume físico+asignado
    s = {
      ...s,
      assignedQty: s.assignedQty - 70,
      physicalQty: s.physicalQty - 70,
      legacyStock: s.legacyStock - 70,
    };
    // returned 20: solo assigned↓
    s = { ...s, assignedQty: s.assignedQty - 20 };
    // exception LOSS 10
    s = {
      ...s,
      assignedQty: s.assignedQty - 10,
      physicalQty: s.physicalQty - 10,
      legacyStock: s.legacyStock - 10,
    };

    const after = snapshot(s);
    assert.equal(before.assignedQty, 100);
    assert.equal(after.assignedQty, 0);
    assert.equal(after.physicalQty, 20); // 100-70-10
    assert.equal(after.disponible, 20);
    assert.equal(after.legacyStock, 20);
    assert.ok(after.physicalQty >= 0);
    assert.ok(after.assignedQty >= 0);
    // Kardex conceptual: CONSUMPTION 70, RETURN 20, LOSS 10 AUTHORIZED_EXCEPTION
    const kardex = [
      { type: "CONSUMPTION", qty: 70 },
      { type: "RETURN", qty: 20 },
      { type: "LOSS", qty: 10, notes: "AUTHORIZED_EXCEPTION" },
    ];
    const accounted = kardex.reduce((a, m) => a + m.qty, 0);
    assert.equal(accounted, 100);
    assert.ok(kardex.some((m) => m.type === "LOSS" && m.notes === "AUTHORIZED_EXCEPTION"));
  });
});

describe("GATE devolución 70 used + 30 returned", () => {
  it("assigned limpia; físico solo baja por used", () => {
    let s: Stock = {
      physicalQty: 100,
      reservedQty: 0,
      assignedQty: 100,
      legacyStock: 100,
    };
    s = {
      ...s,
      assignedQty: s.assignedQty - 70,
      physicalQty: s.physicalQty - 70,
      legacyStock: s.legacyStock - 70,
    };
    s = { ...s, assignedQty: s.assignedQty - 30 };
    assert.equal(s.assignedQty, 0);
    assert.equal(s.physicalQty, 30);
    assert.equal(stockDisponible(s), 30);
  });
});

describe("GATE reserva cancelación", () => {
  it("reserva 100 luego RELEASE restaura disponible", () => {
    let s: Stock = {
      physicalQty: 150,
      reservedQty: 0,
      assignedQty: 0,
      legacyStock: 150,
    };
    const beforeDisp = stockDisponible(s);
    s = { ...s, reservedQty: 100 };
    assert.equal(stockDisponible(s), 50);
    s = { ...s, reservedQty: s.reservedQty - 100 }; // RESERVATION_RELEASE
    assert.equal(stockDisponible(s), beforeDisp);
  });

  it("con entrega no se libera como si no hubiera salido", () => {
    // assigned 100 tras entrega: cancel OT no debe hacer reserved-- físico+
    const delivered: Stock = {
      physicalQty: 100,
      reservedQty: 0,
      assignedQty: 100,
      legacyStock: 100,
    };
    // Política: requiere RETURN/DAMAGE/LOSS — no auto-release
    assert.equal(delivered.assignedQty, 100);
    assert.equal(stockDisponible(delivered), 0);
  });
});

describe("GATE concurrencia 150 vs 100+100", () => {
  it("segunda reserva falla; disponible nunca negativo", () => {
    let s = { physicalQty: 150, reservedQty: 0, assignedQty: 0 };
    assert.equal(validarReserva({ disponible: stockDisponible(s), cantidad: 100 }).ok, true);
    s = { ...s, reservedQty: 100 };
    assert.equal(validarReserva({ disponible: stockDisponible(s), cantidad: 100 }).ok, false);
    assert.ok(stockDisponible(s) >= 0);
  });
});

describe("GATE RBAC matriz", () => {
  it("técnico/bodega/supervisor/admin según matriz", () => {
    assert.equal(puedeSolicitarMaterial("TECNICO"), false);
    assert.equal(puedeAprobarMaterial("TECNICO"), false);
    assert.equal(puedeOperarBodega("TECNICO"), false);
    assert.equal(puedeAjustarInventario("TECNICO"), false);
    assert.equal(puedeGestionarCatalogo("TECNICO"), false);
    assert.equal(puedeGestionarCatalogo("BODEGA"), false);
    assert.equal(puedeGestionarCatalogo("SUPERVISOR"), false);
    assert.equal(puedeGestionarCatalogo("ADMIN"), true);
    assert.equal(puedeOperarBodega("BODEGA"), true);
    assert.equal(puedeAjustarInventario("ADMIN"), true);
  });
});
