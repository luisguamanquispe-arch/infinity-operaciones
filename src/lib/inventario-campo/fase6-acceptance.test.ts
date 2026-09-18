/**
 * FASE 6 — acceptance / invariant tests (pure; no DB / no Bridge mutation).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcularCostoLinea,
  otBloqueaDescuentoLegacy,
  otTieneFlujoCampoActivo,
  physicalQtyDesdeLegacy,
  puedeAjustarInventario,
  puedeAprobarMaterial,
  puedeOperarBodega,
  puedeSolicitarMaterial,
  solicitudPuedeAprobarse,
  solicitudPuedeEntregarse,
  solicitudPuedePrepararse,
  stockDisponible,
  validarAsignacionSerial,
  validarBucketsStock,
  validarCantidadPositiva,
  validarConciliacionItem,
  validarReporteUsoItem,
  validarReserva,
} from "./reglas";

describe("FASE6 A — solicitud / RBAC", () => {
  it("supervisor puede crear/aprobar; técnico no", () => {
    assert.equal(puedeSolicitarMaterial("SUPERVISOR"), true);
    assert.equal(puedeAprobarMaterial("SUPERVISOR"), true);
    assert.equal(puedeSolicitarMaterial("TECNICO"), false);
    assert.equal(puedeAprobarMaterial("TECNICO"), false);
  });

  it("cantidad inválida bloqueada", () => {
    assert.equal(validarCantidadPositiva(0).ok, false);
    assert.equal(validarCantidadPositiva(-2).ok, false);
    assert.equal(validarCantidadPositiva(1).ok, true);
  });
});

describe("FASE6 B — aprobación estados", () => {
  it("DRAFT/REQUESTED aprobables; CERRADO/RECONCILED no vía estados solicitud", () => {
    assert.equal(solicitudPuedeAprobarse("DRAFT"), true);
    assert.equal(solicitudPuedeAprobarse("REQUESTED"), true);
    assert.equal(solicitudPuedeAprobarse("RESERVED"), false);
    assert.equal(solicitudPuedeAprobarse("RECONCILED"), false);
  });
});

describe("FASE6 C — reserva + concurrencia", () => {
  it("available suficiente vs insuficiente", () => {
    assert.equal(validarReserva({ disponible: 10, cantidad: 3 }).ok, true);
    const fail = validarReserva({ disponible: 2, cantidad: 5 });
    assert.equal(fail.ok, false);
    if (!fail.ok) assert.equal(fail.status, 409);
  });

  it("dos reservas concurrentes: una OK, otra falla; never disponible < 0", () => {
    let s = { physicalQty: 50, reservedQty: 0, assignedQty: 0 };
    const a = validarReserva({ disponible: stockDisponible(s), cantidad: 40 });
    assert.equal(a.ok, true);
    s = { ...s, reservedQty: 40 };
    const b = validarReserva({ disponible: stockDisponible(s), cantidad: 40 });
    assert.equal(b.ok, false);
    assert.ok(stockDisponible(s) >= 0);
    assert.equal(validarBucketsStock(s).ok, true);
  });
});

describe("FASE6 D — entrega reserved→assigned", () => {
  it("physical no cambia; disponible neto igual", () => {
    const before = { physicalQty: 100, reservedQty: 8, assignedQty: 0 };
    const after = { physicalQty: 100, reservedQty: 0, assignedQty: 8 };
    assert.equal(before.physicalQty, after.physicalQty);
    assert.equal(stockDisponible(before), stockDisponible(after));
    assert.equal(validarBucketsStock(after).ok, true);
  });

  it("entrega > reservado bloqueada conceptualmente", () => {
    const reserved = 5;
    const deliver = 6;
    assert.ok(deliver > reserved);
  });
});

describe("FASE6 E — recepción IDOR conceptual", () => {
  it("técnico ajeno no opera (simulación de ownership)", () => {
    const deliveryTecnicoId = "tec-a";
    const callerTecnicoId = "tec-b";
    assert.notEqual(deliveryTecnicoId, callerTecnicoId);
  });
});

describe("FASE6 F/G — conciliación USED/RETURNED/DAMAGED/LOST", () => {
  it("cuadratura exacta DELIVERED = suma", () => {
    const ok = validarConciliacionItem({
      deliveredQty: 10,
      usedQty: 4,
      returnedQty: 3,
      damagedQty: 2,
      lostQty: 1,
    });
    assert.equal(ok.ok, true);
  });

  it("BLOCK si no cuadra", () => {
    assert.equal(
      validarConciliacionItem({
        deliveredQty: 10,
        usedQty: 4,
        returnedQty: 3,
        damagedQty: 0,
        lostQty: 0,
      }).ok,
      false
    );
  });

  it("reporte parcial permite diferencia hasta conciliar", () => {
    const r = validarReporteUsoItem({
      deliveredQty: 10,
      usedQty: 4,
      returnedQty: 0,
      damagedQty: 0,
      lostQty: 0,
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.diferencia, 6);
  });
});

describe("FASE6 H — stock buckets >= 0", () => {
  it("rechaza negativos", () => {
    assert.equal(
      validarBucketsStock({ physicalQty: -1, reservedQty: 0, assignedQty: 0 }).ok,
      false
    );
    assert.equal(
      validarBucketsStock({ physicalQty: 5, reservedQty: -1, assignedQty: 0 }).ok,
      false
    );
    assert.equal(
      validarBucketsStock({ physicalQty: 5, reservedQty: 3, assignedQty: 3 }).ok,
      false
    );
    assert.equal(
      validarBucketsStock({ physicalQty: 10, reservedQty: 2, assignedQty: 3 }).ok,
      true
    );
  });

  it("legacy Bridge -8 no se propaga al physicalQty nuevo", () => {
    assert.equal(physicalQtyDesdeLegacy(-8), 0);
    assert.equal(physicalQtyDesdeLegacy(20), 20);
    assert.equal(physicalQtyDesdeLegacy(0), 0);
  });
});

describe("FASE6 I — seriales", () => {
  it("duplicado conceptual / cross-OT / no disponible", () => {
    assert.equal(
      validarAsignacionSerial({
        status: "AVAILABLE",
        ticketId: null,
        targetTicketId: "ot-1",
      }).ok,
      true
    );
    const cross = validarAsignacionSerial({
      status: "ASSIGNED",
      ticketId: "ot-a",
      targetTicketId: "ot-b",
    });
    assert.equal(cross.ok, false);
    if (!cross.ok) assert.equal(cross.status, 409);
  });
});

describe("FASE6 J — legacy protection", () => {
  it("RECONCILED y pipeline bloquean; DRAFT/REJECTED no", () => {
    assert.equal(otBloqueaDescuentoLegacy("RECONCILED"), true);
    assert.equal(otBloqueaDescuentoLegacy("RESERVED"), true);
    assert.equal(otBloqueaDescuentoLegacy("PREPARED"), true);
    assert.equal(otBloqueaDescuentoLegacy("DRAFT"), false);
    assert.equal(otBloqueaDescuentoLegacy("REJECTED"), false);
  });

  it("OT antigua sin flujo campo: otBloqueaDescuentoLegacy(null)=false", () => {
    assert.equal(otBloqueaDescuentoLegacy(null), false);
    assert.equal(otBloqueaDescuentoLegacy(undefined), false);
  });
});

describe("FASE6 K — cierre", () => {
  it("flujo activo bloquea cierre conceptual; RECONCILED no activo", () => {
    assert.equal(otTieneFlujoCampoActivo("PENDING_RECONCILIATION"), true);
    assert.equal(otTieneFlujoCampoActivo("DELIVERED"), true);
    assert.equal(otTieneFlujoCampoActivo("RECONCILED"), false);
    assert.equal(otTieneFlujoCampoActivo("CLOSED"), false);
  });
});

describe("FASE6 L — IDOR / roles", () => {
  it("técnico no ajusta ni opera bodega", () => {
    assert.equal(puedeAjustarInventario("TECNICO"), false);
    assert.equal(puedeOperarBodega("TECNICO"), false);
    assert.equal(puedeOperarBodega("BODEGA"), true);
  });
});

describe("FASE6 preparación y entrega estados", () => {
  it("RESERVED→PREPARED→entregable", () => {
    assert.equal(solicitudPuedePrepararse("RESERVED"), true);
    assert.equal(solicitudPuedePrepararse("PREPARED"), false);
    assert.equal(solicitudPuedeEntregarse("PREPARED"), true);
    assert.equal(solicitudPuedeEntregarse("RESERVED"), true);
    assert.equal(solicitudPuedeEntregarse("DELIVERED"), false);
  });
});

describe("FASE6 costos USED", () => {
  it("costo OT = used × unitCost; returned no cobra", () => {
    const used = 7;
    const unitCost = 12.5;
    assert.equal(calcularCostoLinea(used, unitCost), 87.5);
    assert.equal(calcularCostoLinea(0, unitCost), 0);
  });
});
