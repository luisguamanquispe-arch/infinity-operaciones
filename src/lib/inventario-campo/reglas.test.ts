import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcularCostoLinea,
  mapTipoTrabajoTicket,
  otBloqueaDescuentoLegacy,
  otTieneFlujoCampoActivo,
  puedeAjustarInventario,
  puedeAprobarMaterial,
  puedeGestionarCatalogo,
  puedeOperarBodega,
  puedeSolicitarMaterial,
  stockDisponible,
  validarAsignacionSerial,
  validarBucketsStock,
  validarCantidadPositiva,
  validarConciliacionItem,
  validarReporteUsoItem,
  validarReserva,
  physicalQtyDesdeLegacy,
  solicitudPuedePrepararse,
} from "./reglas";
import { BACKUP_TABLE_ORDER } from "@/lib/backup";
import { INVENTARIO_CAMPO_BACKUP_TABLES } from "./backup-tablas";

describe("stockDisponible", () => {
  it("físico − reservado − asignado", () => {
    assert.equal(
      stockDisponible({ physicalQty: 100, reservedQty: 20, assignedQty: 10 }),
      70
    );
    assert.equal(
      stockDisponible({ physicalQty: 5, reservedQty: 5, assignedQty: 0 }),
      0
    );
  });
});

describe("RBAC inventario campo", () => {
  it("técnico no solicita ni aprueba ni ajusta ni gestiona catálogo", () => {
    assert.equal(puedeSolicitarMaterial("TECNICO"), false);
    assert.equal(puedeAprobarMaterial("TECNICO"), false);
    assert.equal(puedeAjustarInventario("TECNICO"), false);
    assert.equal(puedeOperarBodega("TECNICO"), false);
    assert.equal(puedeGestionarCatalogo("TECNICO"), false);
  });

  it("bodega opera almacén; solo admin catálogo/ajuste", () => {
    assert.equal(puedeOperarBodega("BODEGA"), true);
    assert.equal(puedeOperarBodega("SUPERVISOR"), true);
    assert.equal(puedeAjustarInventario("ADMIN"), true);
    assert.equal(puedeAjustarInventario("BODEGA"), false);
    assert.equal(puedeGestionarCatalogo("ADMIN"), true);
    assert.equal(puedeGestionarCatalogo("BODEGA"), false);
    assert.equal(puedeGestionarCatalogo("SUPERVISOR"), false);
    assert.equal(puedeSolicitarMaterial("SUPERVISOR"), true);
  });
});

describe("reserva y conciliación", () => {
  it("valida cantidad y stock insuficiente", () => {
    assert.equal(validarCantidadPositiva(0).ok, false);
    assert.equal(validarCantidadPositiva(-1).ok, false);
    assert.equal(validarReserva({ disponible: 5, cantidad: 3 }).ok, true);
    const fail = validarReserva({ disponible: 2, cantidad: 5 });
    assert.equal(fail.ok, false);
    if (!fail.ok) assert.equal(fail.status, 409);
  });

  it("exige cuadratura exacta en conciliación", () => {
    const ok = validarConciliacionItem({
      deliveredQty: 10,
      usedQty: 7,
      returnedQty: 2,
      damagedQty: 1,
      lostQty: 0,
    });
    assert.equal(ok.ok, true);

    const diff = validarConciliacionItem({
      deliveredQty: 100,
      usedQty: 70,
      returnedQty: 20,
      damagedQty: 0,
      lostQty: 0,
    });
    assert.equal(diff.ok, false);
    if (!diff.ok) assert.equal(diff.diferencia, 10);
  });

  it("PASS 100=70+30; BLOCK 100 vs 70+20; BLOCK used>delivered", () => {
    assert.equal(
      validarConciliacionItem({
        deliveredQty: 100,
        usedQty: 70,
        returnedQty: 30,
        damagedQty: 0,
        lostQty: 0,
      }).ok,
      true
    );
    assert.equal(
      validarConciliacionItem({
        deliveredQty: 100,
        usedQty: 70,
        returnedQty: 20,
        damagedQty: 0,
        lostQty: 0,
      }).ok,
      false
    );
    assert.equal(
      validarConciliacionItem({
        deliveredQty: 100,
        usedQty: 110,
        returnedQty: 0,
        damagedQty: 0,
        lostQty: 0,
      }).ok,
      false
    );
  });

  it("reporte permite suma ≤ entregado; rechaza negativos y exceso", () => {
    const partial = validarReporteUsoItem({
      deliveredQty: 100,
      usedQty: 70,
      returnedQty: 20,
      damagedQty: 0,
      lostQty: 0,
    });
    assert.equal(partial.ok, true);
    if (partial.ok) assert.equal(partial.diferencia, 10);

    const neg = validarReporteUsoItem({
      deliveredQty: 10,
      usedQty: -1,
      returnedQty: 0,
      damagedQty: 0,
      lostQty: 0,
    });
    assert.equal(neg.ok, false);
    if (!neg.ok) assert.equal(neg.status, 400);

    const over = validarReporteUsoItem({
      deliveredQty: 10,
      usedQty: 6,
      returnedQty: 3,
      damagedQty: 2,
      lostQty: 0,
    });
    assert.equal(over.ok, false);
    if (!over.ok) assert.equal(over.status, 400);
  });

  it("excepción autorizada liquida residual: 70+20+10 LOSS = 100", () => {
    const base = { deliveredQty: 100, usedQty: 70, returnedQty: 20, damagedQty: 0, lostQty: 0 };
    assert.equal(validarConciliacionItem(base).ok, false);
    const conExcepcion = validarConciliacionItem({
      ...base,
      lostQty: 10,
    });
    assert.equal(conExcepcion.ok, true);
  });
});

describe("serial asignación entre OT", () => {
  it("AVAILABLE/RETURNED permiten; ASSIGNED/INSTALLED a otra OT = 409", () => {
    assert.equal(
      validarAsignacionSerial({
        status: "AVAILABLE",
        ticketId: null,
        targetTicketId: "ot-b",
      }).ok,
      true
    );
    assert.equal(
      validarAsignacionSerial({
        status: "RETURNED",
        ticketId: null,
        targetTicketId: "ot-b",
      }).ok,
      true
    );
    const assigned = validarAsignacionSerial({
      status: "ASSIGNED",
      ticketId: "ot-a",
      targetTicketId: "ot-b",
    });
    assert.equal(assigned.ok, false);
    if (!assigned.ok) {
      assert.equal(assigned.status, 409);
      assert.match(assigned.error, /otra orden de trabajo/i);
    }
    const installed = validarAsignacionSerial({
      status: "INSTALLED",
      ticketId: "ot-a",
      targetTicketId: "ot-b",
    });
    assert.equal(installed.ok, false);
    if (!installed.ok) assert.equal(installed.status, 409);
  });
});

describe("legacy post-RECONCILED", () => {
  it("bloquea descuento libre tras RECONCILED y estados de pipeline", () => {
    assert.equal(otBloqueaDescuentoLegacy("RECONCILED"), true);
    assert.equal(otBloqueaDescuentoLegacy("DELIVERED"), true);
    assert.equal(otBloqueaDescuentoLegacy("PENDING_RECONCILIATION"), true);
    assert.equal(otBloqueaDescuentoLegacy("REJECTED"), false);
    assert.equal(otBloqueaDescuentoLegacy("DRAFT"), false);
    assert.equal(otTieneFlujoCampoActivo("RECONCILED"), false);
    assert.equal(otTieneFlujoCampoActivo("PENDING_RECONCILIATION"), true);
  });
});

describe("costos y mapeo OT", () => {
  it("calcula costo de línea", () => {
    assert.equal(calcularCostoLinea(2.5, 4), 10);
  });

  it("mapea TipoTrabajo de ticket", () => {
    assert.equal(mapTipoTrabajoTicket("INSTALACION"), "DOMICILIARY_INSTALLATION");
    assert.equal(mapTipoTrabajoTicket("SOPORTE"), "DOMICILIARY_REPAIR");
    assert.equal(mapTipoTrabajoTicket("INFRAESTRUCTURA"), "INFRASTRUCTURE_MAINTENANCE");
  });
});

describe("invariante entrega sin doble conteo", () => {
  it("reserved→assigned no cambia disponible neto de forma doble", () => {
    const antes = stockDisponible({
      physicalQty: 100,
      reservedQty: 10,
      assignedQty: 0,
    });
    assert.equal(antes, 90);
    const despues = stockDisponible({
      physicalQty: 100,
      reservedQty: 0,
      assignedQty: 10,
    });
    assert.equal(despues, 90);
  });
});

describe("concurrencia lógica de reserva", () => {
  it("150 disponible: 100+100 → segunda falla; nunca disponible negativo", () => {
    let stock = { physicalQty: 150, reservedQty: 0, assignedQty: 0 };
    const r1 = validarReserva({
      disponible: stockDisponible(stock),
      cantidad: 100,
    });
    assert.equal(r1.ok, true);
    stock = { ...stock, reservedQty: stock.reservedQty + 100 };
    assert.equal(stockDisponible(stock), 50);

    const r2 = validarReserva({
      disponible: stockDisponible(stock),
      cantidad: 100,
    });
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.equal(r2.status, 409);
    assert.ok(stockDisponible(stock) >= 0);
  });
});

describe("backup inventario campo", () => {
  it("tablas incluidas en orden de backup", () => {
    for (const t of INVENTARIO_CAMPO_BACKUP_TABLES) {
      assert.ok(
        BACKUP_TABLE_ORDER.includes(t),
        `Falta ${t} en BACKUP_TABLE_ORDER`
      );
    }
    const cat = BACKUP_TABLE_ORDER.indexOf("MaterialCategory");
    const wh = BACKUP_TABLE_ORDER.indexOf("Warehouse");
    const stock = BACKUP_TABLE_ORDER.indexOf("WarehouseStock");
    const mov = BACKUP_TABLE_ORDER.indexOf("InventoryMovement");
    assert.ok(cat < wh && wh < stock && stock < mov);
  });
});

describe("buckets y legacy seed", () => {
  it("validarBucketsStock y physicalQtyDesdeLegacy", () => {
    assert.equal(
      validarBucketsStock({ physicalQty: 1, reservedQty: 0, assignedQty: 0 }).ok,
      true
    );
    assert.equal(
      validarBucketsStock({ physicalQty: -8, reservedQty: 0, assignedQty: 0 }).ok,
      false
    );
    assert.equal(physicalQtyDesdeLegacy(-8), 0);
    assert.equal(solicitudPuedePrepararse("RESERVED"), true);
  });
});
