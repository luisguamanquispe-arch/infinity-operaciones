import type {
  EstadoSolicitudMaterial,
  PrioridadMaterial,
  TipoMovimientoInventario,
  TipoTrabajoMaterial,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAuditoriaInventario } from "./auditoria";
import {
  calcularCostoLinea,
  otBloqueaDescuentoLegacy,
  otTieneFlujoCampoActivo,
  physicalQtyDesdeLegacy,
  solicitudPuedeAprobarse,
  solicitudPuedeEntregarse,
  solicitudPuedePrepararse,
  stockDisponible,
  validarBucketsStock,
  validarCantidadPositiva,
  validarAsignacionSerial,
  validarConciliacionItem,
  validarReporteUsoItem,
  validarReserva,
} from "./reglas";

export class InventarioCampoError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
  }
}

type DbTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function nextNumber(prefix: string, count: number): Promise<string> {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count + 1).padStart(6, "0")}`;
}

async function lockStock(
  tx: DbTx,
  warehouseId: string,
  inventarioId: string
) {
  await tx.$queryRaw`
    SELECT id FROM "WarehouseStock"
    WHERE "warehouseId" = ${warehouseId} AND "inventarioId" = ${inventarioId}
    FOR UPDATE`;
  let row = await tx.warehouseStock.findUnique({
    where: {
      warehouseId_inventarioId: { warehouseId, inventarioId },
    },
  });
  if (!row) {
    row = await tx.warehouseStock.create({
      data: {
        warehouseId,
        inventarioId,
        physicalQty: 0,
        reservedQty: 0,
        assignedQty: 0,
      },
    });
  }
  return row;
}

function assertBucketsOk(stock: {
  physicalQty: number;
  reservedQty: number;
  assignedQty: number;
}) {
  const v = validarBucketsStock(stock);
  if (!v.ok) throw new InventarioCampoError(v.error, 409);
}

async function crearMovimiento(
  tx: DbTx,
  opts: {
    inventarioId: string;
    warehouseId: string;
    movementType: TipoMovimientoInventario;
    quantity: number;
    unitCost?: number;
    ticketId?: string | null;
    tecnicoId?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    performedById?: string | null;
    serialId?: string | null;
    notes?: string | null;
  }
) {
  const count = await tx.inventoryMovement.count();
  const movementNumber = await nextNumber("MOV", count);
  const unitCost = opts.unitCost ?? 0;
  return tx.inventoryMovement.create({
    data: {
      movementNumber,
      inventarioId: opts.inventarioId,
      warehouseId: opts.warehouseId,
      movementType: opts.movementType,
      quantity: opts.quantity,
      unitCost,
      totalCost: calcularCostoLinea(opts.quantity, unitCost),
      ticketId: opts.ticketId ?? null,
      tecnicoId: opts.tecnicoId ?? null,
      referenceType: opts.referenceType ?? null,
      referenceId: opts.referenceId ?? null,
      performedById: opts.performedById ?? null,
      serialId: opts.serialId ?? null,
      notes: opts.notes ?? null,
    },
  });
}

export async function asegurarBodegaCentral() {
  let wh = await prisma.warehouse.findFirst({
    where: { code: "CENTRAL" },
  });
  if (!wh) {
    wh = await prisma.warehouse.create({
      data: {
        code: "CENTRAL",
        name: "BODEGA CENTRAL",
        description: "Bodega principal Infinity",
      },
    });
  }
  return wh;
}

export async function sincronizarStockDesdeLegacy(warehouseId: string) {
  const items = await prisma.inventario.findMany({ select: { id: true, stock: true } });
  for (const i of items) {
    await prisma.warehouseStock.upsert({
      where: {
        warehouseId_inventarioId: { warehouseId, inventarioId: i.id },
      },
      create: {
        warehouseId,
        inventarioId: i.id,
        // No propagar saldos legacy negativos (p.ej. Bridge -8) al módulo nuevo.
        physicalQty: physicalQtyDesdeLegacy(i.stock),
        reservedQty: 0,
        assignedQty: 0,
      },
      update: {},
    });
  }
}

export async function listarStock(warehouseId?: string) {
  const wh = warehouseId
    ? await prisma.warehouse.findUnique({ where: { id: warehouseId } })
    : await asegurarBodegaCentral();
  if (!wh) throw new InventarioCampoError("Bodega no encontrada.", 404);
  const rows = await prisma.warehouseStock.findMany({
    where: { warehouseId: wh.id },
    include: {
      inventario: {
        include: { category: true },
      },
    },
    orderBy: { inventario: { nombre: "asc" } },
  });
  return {
    warehouse: wh,
    items: rows.map((r) => ({
      ...r,
      disponible: stockDisponible(r),
      critico: r.physicalQty <= r.inventario.stockMin,
      legacyNegativo:
        r.inventario.stock < -1e-9 || r.physicalQty < -1e-9,
    })),
  };
}

export async function dashboardInventario() {
  const wh = await asegurarBodegaCentral();
  await sincronizarStockDesdeLegacy(wh.id);
  const stocks = await prisma.warehouseStock.findMany({
    where: { warehouseId: wh.id },
    include: { inventario: true },
  });
  const pendientes = await prisma.materialRequest.count({
    where: {
      status: {
        in: ["DELIVERED", "IN_USE", "PENDING_RECONCILIATION"],
      },
    },
  });
  let fisico = 0;
  let reservado = 0;
  let asignado = 0;
  let critico = 0;
  let sinStock = 0;
  for (const s of stocks) {
    fisico += s.physicalQty;
    reservado += s.reservedQty;
    asignado += s.assignedQty;
    if (s.physicalQty <= 0) sinStock += 1;
    if (s.physicalQty <= s.inventario.stockMin) critico += 1;
  }
  const consumosMes = await prisma.inventoryMovement.findMany({
    where: {
      movementType: "CONSUMPTION",
      createdAt: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
    select: { totalCost: true, quantity: true },
  });
  const costoMes = consumosMes.reduce((a, m) => a + m.totalCost, 0);
  const legacyNegativos = stocks.filter(
    (s) => s.inventario.stock < -1e-9 || s.physicalQty < -1e-9
  );
  const otsBloqueadas = await prisma.materialRequest.count({
    where: {
      status: {
        in: [
          "REQUESTED",
          "APPROVED",
          "RESERVED",
          "PREPARED",
          "DELIVERED",
          "IN_USE",
          "PENDING_RECONCILIATION",
        ],
      },
    },
  });
  const serialesAsignados = await prisma.serializedAsset.count({
    where: { status: { in: ["ASSIGNED", "RESERVED"] } },
  });
  return {
    warehouseId: wh.id,
    stockTotalItems: stocks.length,
    fisico,
    reservado,
    asignado,
    disponible: fisico - reservado - asignado,
    critico,
    sinStock,
    pendienteConciliacion: pendientes,
    costoConsumoMes: Number(costoMes.toFixed(2)),
    otsBloqueadasInventario: otsBloqueadas,
    serialesAsignados,
    legacyNegativos: legacyNegativos.map((s) => ({
      inventarioId: s.inventarioId,
      nombre: s.inventario.nombre,
      stockLegacy: s.inventario.stock,
      physicalQty: s.physicalQty,
      nota: "Dato histórico legacy; no habilita operaciones negativas en el flujo de campo.",
    })),
  };
}

export async function crearSolicitud(opts: {
  ticketId: string;
  tecnicoId: string;
  warehouseId?: string;
  requestedById: string;
  workType?: TipoTrabajoMaterial;
  priority?: PrioridadMaterial;
  justification?: string | null;
  items: { inventarioId: string; requestedQty: number; notes?: string }[];
  enviar?: boolean;
}) {
  if (!opts.items.length) {
    throw new InventarioCampoError("Agregue al menos un material.");
  }
  for (const it of opts.items) {
    const v = validarCantidadPositiva(it.requestedQty);
    if (!v.ok) throw new InventarioCampoError(v.error);
  }
  const ticket = await prisma.ticket.findUnique({
    where: { id: opts.ticketId },
    select: { id: true, estado: true, codigo: true },
  });
  if (!ticket) throw new InventarioCampoError("OT no encontrada.", 404);
  if (ticket.estado === "CERRADO" || ticket.estado === "CANCELADO") {
    throw new InventarioCampoError("La OT está cerrada o cancelada.", 409);
  }
  const tecnico = await prisma.tecnico.findUnique({ where: { id: opts.tecnicoId } });
  if (!tecnico) throw new InventarioCampoError("Técnico no encontrado.", 404);
  const wh = opts.warehouseId
    ? await prisma.warehouse.findUnique({ where: { id: opts.warehouseId } })
    : await asegurarBodegaCentral();
  if (!wh) throw new InventarioCampoError("Bodega no encontrada.", 404);

  const count = await prisma.materialRequest.count();
  const requestNumber = await nextNumber("SOL", count);
  const status: EstadoSolicitudMaterial = opts.enviar ? "REQUESTED" : "DRAFT";
  const req = await prisma.materialRequest.create({
    data: {
      requestNumber,
      ticketId: opts.ticketId,
      requestedById: opts.requestedById,
      tecnicoId: opts.tecnicoId,
      warehouseId: wh.id,
      workType: opts.workType ?? "OTHER",
      priority: opts.priority ?? "MEDIA",
      status,
      justification: opts.justification ?? null,
      requestedAt: opts.enviar ? new Date() : null,
      items: {
        create: opts.items.map((it) => ({
          inventarioId: it.inventarioId,
          requestedQty: it.requestedQty,
          notes: it.notes ?? null,
        })),
      },
    },
    include: { items: { include: { inventario: true } }, ticket: true, tecnico: { include: { usuario: true } } },
  });
  await registrarAuditoriaInventario({
    entidad: "MaterialRequest",
    registroId: req.id,
    usuarioId: opts.requestedById,
    accion: "REQUEST_CREATED",
    ticketId: opts.ticketId,
    valorNuevo: { requestNumber, status, items: opts.items.length },
  });
  return req;
}

export async function aprobarSolicitud(opts: {
  requestId: string;
  approvedById: string;
  items?: { itemId: string; approvedQty: number }[];
  reject?: boolean;
  rejectionReason?: string | null;
}) {
  const prev = await prisma.materialRequest.findUnique({
    where: { id: opts.requestId },
    include: { items: true },
  });
  if (!prev) throw new InventarioCampoError("Solicitud no encontrada.", 404);
  if (!solicitudPuedeAprobarse(prev.status)) {
    throw new InventarioCampoError("La solicitud no puede aprobarse en este estado.", 409);
  }
  const ticketEstado = await prisma.ticket.findUnique({
    where: { id: prev.ticketId },
    select: { estado: true },
  });
  if (
    ticketEstado &&
    (ticketEstado.estado === "CERRADO" || ticketEstado.estado === "CANCELADO")
  ) {
    throw new InventarioCampoError("La OT está cerrada o cancelada.", 409);
  }
  if (opts.reject) {
    const rej = await prisma.materialRequest.update({
      where: { id: opts.requestId },
      data: {
        status: "REJECTED",
        rejectionReason: opts.rejectionReason ?? "Rechazada",
        approvedById: opts.approvedById,
        approvedAt: new Date(),
      },
    });
    await registrarAuditoriaInventario({
      entidad: "MaterialRequest",
      registroId: rej.id,
      usuarioId: opts.approvedById,
      accion: "REQUEST_REJECTED",
      ticketId: prev.ticketId,
      motivo: opts.rejectionReason,
      valorAnterior: { status: prev.status },
      valorNuevo: { status: "REJECTED" },
    });
    return rej;
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM "MaterialRequest" WHERE id = ${opts.requestId} FOR UPDATE`;
    const locked = await tx.materialRequest.findUnique({
      where: { id: opts.requestId },
      include: { items: true },
    });
    if (!locked || !solicitudPuedeAprobarse(locked.status)) {
      throw new InventarioCampoError("La solicitud no puede aprobarse en este estado.", 409);
    }

    for (const item of locked.items) {
      const override = opts.items?.find((i) => i.itemId === item.id);
      const approvedQty = override?.approvedQty ?? item.requestedQty;
      const v = validarCantidadPositiva(approvedQty);
      if (!v.ok) throw new InventarioCampoError(v.error);
      const stock = await lockStock(tx, locked.warehouseId, item.inventarioId);
      const disp = stockDisponible(stock);
      const r = validarReserva({ disponible: disp, cantidad: approvedQty });
      if (!r.ok) throw new InventarioCampoError(r.error, r.status);
      await tx.materialRequestItem.update({
        where: { id: item.id },
        data: { approvedQty },
      });
      await tx.warehouseStock.update({
        where: { id: stock.id },
        data: { reservedQty: { increment: approvedQty } },
      });
      const afterReserve = await tx.warehouseStock.findUniqueOrThrow({
        where: { id: stock.id },
      });
      assertBucketsOk(afterReserve);
      const inv = await tx.inventario.findUnique({
        where: { id: item.inventarioId },
        select: { unitCost: true },
      });
      await crearMovimiento(tx, {
        inventarioId: item.inventarioId,
        warehouseId: locked.warehouseId,
        movementType: "RESERVATION",
        quantity: approvedQty,
        unitCost: inv?.unitCost ?? 0,
        ticketId: locked.ticketId,
        tecnicoId: locked.tecnicoId,
        referenceType: "MaterialRequest",
        referenceId: locked.id,
        performedById: opts.approvedById,
      });
    }
    const updated = await tx.materialRequest.update({
      where: { id: opts.requestId },
      data: {
        status: "RESERVED",
        approvedById: opts.approvedById,
        approvedAt: new Date(),
      },
      include: { items: { include: { inventario: true } } },
    });
    await registrarAuditoriaInventario({
      entidad: "MaterialRequest",
      registroId: updated.id,
      usuarioId: opts.approvedById,
      accion: "REQUEST_APPROVED",
      ticketId: locked.ticketId,
      valorAnterior: { status: locked.status },
      valorNuevo: { status: "RESERVED" },
    });
    await registrarAuditoriaInventario({
      entidad: "MaterialRequest",
      registroId: updated.id,
      usuarioId: opts.approvedById,
      accion: "STOCK_RESERVED",
      ticketId: locked.ticketId,
      valorNuevo: { items: updated.items.map((i) => ({ id: i.id, approvedQty: i.approvedQty })) },
    });
    return updated;
  });
}

/** Bodega marca materiales listos; no altera stock (la reserva permanece). */
export async function prepararSolicitud(opts: {
  requestId: string;
  preparedById: string;
  notes?: string | null;
}) {
  const prev = await prisma.materialRequest.findUnique({
    where: { id: opts.requestId },
    include: { items: { include: { inventario: true } } },
  });
  if (!prev) throw new InventarioCampoError("Solicitud no encontrada.", 404);
  if (!solicitudPuedePrepararse(prev.status)) {
    throw new InventarioCampoError(
      "La solicitud no está en estado reservado para preparación.",
      409
    );
  }
  const updated = await prisma.materialRequest.update({
    where: { id: opts.requestId },
    data: { status: "PREPARED" },
    include: { items: { include: { inventario: true } } },
  });
  await registrarAuditoriaInventario({
    entidad: "MaterialRequest",
    registroId: updated.id,
    usuarioId: opts.preparedById,
    accion: "REQUEST_PREPARED",
    ticketId: prev.ticketId,
    motivo: opts.notes ?? null,
    valorAnterior: { status: prev.status },
    valorNuevo: { status: "PREPARED" },
  });
  return updated;
}

export async function entregarSolicitud(opts: {
  requestId: string;
  deliveredById: string;
  notes?: string | null;
  items?: {
    inventarioId: string;
    deliveredQty: number;
    lotNumber?: string | null;
    serialNumber?: string | null;
    macAddress?: string | null;
  }[];
}) {
  const prev = await prisma.materialRequest.findUnique({
    where: { id: opts.requestId },
    include: {
      items: { include: { inventario: true } },
      ticket: { select: { id: true, clienteId: true } },
    },
  });
  if (!prev) throw new InventarioCampoError("Solicitud no encontrada.", 404);
  if (!solicitudPuedeEntregarse(prev.status)) {
    throw new InventarioCampoError("La solicitud no está lista para entregar.", 409);
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM "MaterialRequest" WHERE id = ${opts.requestId} FOR UPDATE`;
    const locked = await tx.materialRequest.findUnique({
      where: { id: opts.requestId },
      include: {
        items: { include: { inventario: true } },
        ticket: { select: { id: true, clienteId: true } },
      },
    });
    if (!locked || !solicitudPuedeEntregarse(locked.status)) {
      throw new InventarioCampoError("La solicitud no está lista para entregar.", 409);
    }

    const count = await tx.materialDelivery.count();
    const deliveryNumber = await nextNumber("ENT", count);
    const lines =
      opts.items ??
      locked.items.map((i) => ({
        inventarioId: i.inventarioId,
        deliveredQty: i.approvedQty ?? i.requestedQty,
        lotNumber: null as string | null,
        serialNumber: null as string | null,
        macAddress: null as string | null,
      }));

    const delivery = await tx.materialDelivery.create({
      data: {
        deliveryNumber,
        requestId: locked.id,
        ticketId: locked.ticketId,
        tecnicoId: locked.tecnicoId,
        warehouseId: locked.warehouseId,
        deliveredById: opts.deliveredById,
        notes: opts.notes ?? null,
      },
    });

    for (const line of lines) {
      const reqItem = locked.items.find((i) => i.inventarioId === line.inventarioId);
      if (!reqItem) {
        throw new InventarioCampoError("Material no pertenece a la solicitud.");
      }
      const approved = reqItem.approvedQty ?? reqItem.requestedQty;
      const qty = line.deliveredQty;
      const v = validarCantidadPositiva(qty);
      if (!v.ok) throw new InventarioCampoError(v.error);
      if (qty > approved + 1e-9) {
        throw new InventarioCampoError(
          `No puede entregar más de lo aprobado (${approved}).`
        );
      }
      const stock = await lockStock(tx, locked.warehouseId, line.inventarioId);
      if (stock.reservedQty + 1e-9 < qty) {
        throw new InventarioCampoError("Reserva insuficiente para entregar.", 409);
      }
      // Físico no baja en entrega: reserved → assigned (disponible = físico−reservado−asignado).
      await tx.warehouseStock.update({
        where: { id: stock.id },
        data: {
          reservedQty: { decrement: qty },
          assignedQty: { increment: qty },
        },
      });
      assertBucketsOk(
        await tx.warehouseStock.findUniqueOrThrow({ where: { id: stock.id } })
      );

      const noEntregado = approved - qty;
      if (noEntregado > 1e-9) {
        const stock2 = await lockStock(tx, locked.warehouseId, line.inventarioId);
        if (stock2.reservedQty + 1e-9 < noEntregado) {
          throw new InventarioCampoError("Reserva residual inconsistente.", 409);
        }
        await tx.warehouseStock.update({
          where: { id: stock2.id },
          data: { reservedQty: { decrement: noEntregado } },
        });
        await crearMovimiento(tx, {
          inventarioId: line.inventarioId,
          warehouseId: locked.warehouseId,
          movementType: "RESERVATION_RELEASE",
          quantity: noEntregado,
          unitCost: reqItem.inventario.unitCost,
          ticketId: locked.ticketId,
          tecnicoId: locked.tecnicoId,
          referenceType: "MaterialDelivery",
          referenceId: delivery.id,
          performedById: opts.deliveredById,
          notes: "Liberación de reserva no entregada",
        });
      }

      let serialAssetId: string | null = null;
      if (line.serialNumber) {
        const serial = line.serialNumber.trim();
        const existing = await tx.serializedAsset.findUnique({
          where: {
            inventarioId_serialNumber: {
              inventarioId: line.inventarioId,
              serialNumber: serial,
            },
          },
        });
        if (existing) {
          const asig = validarAsignacionSerial({
            status: existing.status,
            ticketId: existing.ticketId,
            targetTicketId: locked.ticketId,
          });
          if (!asig.ok) {
            throw new InventarioCampoError(asig.error, asig.status);
          }
          const asset = await tx.serializedAsset.update({
            where: { id: existing.id },
            data: {
              status: "ASSIGNED",
              macAddress: line.macAddress?.trim() || existing.macAddress,
              warehouseId: locked.warehouseId,
              assignedTechnicianId: locked.tecnicoId,
              ticketId: locked.ticketId,
              assignedAt: new Date(),
            },
          });
          serialAssetId = asset.id;
          await tx.serializedAssetHistorial.create({
            data: {
              assetId: asset.id,
              fromStatus: existing.status,
              toStatus: "ASSIGNED",
              usuarioId: opts.deliveredById,
              notes: `Entrega ${deliveryNumber}`,
            },
          });
        } else {
          if (line.macAddress?.trim()) {
            const macDup = await tx.serializedAsset.findFirst({
              where: { macAddress: line.macAddress.trim() },
              select: { id: true },
            });
            if (macDup) {
              throw new InventarioCampoError(
                "Ya existe un equipo con esa dirección MAC.",
                409
              );
            }
          }
          const asset = await tx.serializedAsset.create({
            data: {
              inventarioId: line.inventarioId,
              serialNumber: serial,
              macAddress: line.macAddress?.trim() || null,
              status: "ASSIGNED",
              warehouseId: locked.warehouseId,
              assignedTechnicianId: locked.tecnicoId,
              ticketId: locked.ticketId,
              assignedAt: new Date(),
            },
          });
          serialAssetId = asset.id;
          await tx.serializedAssetHistorial.create({
            data: {
              assetId: asset.id,
              fromStatus: "AVAILABLE",
              toStatus: "ASSIGNED",
              usuarioId: opts.deliveredById,
              notes: `Entrega ${deliveryNumber}`,
            },
          });
        }
      }

      await tx.materialDeliveryItem.create({
        data: {
          deliveryId: delivery.id,
          inventarioId: line.inventarioId,
          deliveredQty: qty,
          lotNumber: line.lotNumber ?? null,
          serialAssetId,
        },
      });
      await crearMovimiento(tx, {
        inventarioId: line.inventarioId,
        warehouseId: locked.warehouseId,
        movementType: "DELIVERY",
        quantity: qty,
        unitCost: reqItem.inventario.unitCost,
        ticketId: locked.ticketId,
        tecnicoId: locked.tecnicoId,
        referenceType: "MaterialDelivery",
        referenceId: delivery.id,
        performedById: opts.deliveredById,
        serialId: serialAssetId,
      });
    }

    await tx.materialRequest.update({
      where: { id: locked.id },
      data: { status: "DELIVERED" },
    });

    await registrarAuditoriaInventario({
      entidad: "MaterialDelivery",
      registroId: delivery.id,
      usuarioId: opts.deliveredById,
      accion: "DELIVERY_CREATED",
      ticketId: locked.ticketId,
      valorNuevo: { deliveryNumber },
    });

    return tx.materialDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
      include: {
        items: { include: { inventario: true, serialAsset: true } },
        request: true,
        tecnico: { include: { usuario: true } },
      },
    });
  });
}

export async function confirmarRecepcion(opts: {
  deliveryId: string;
  tecnicoId: string;
  notes?: string | null;
  differenceReported?: boolean;
}) {
  const del = await prisma.materialDelivery.findUnique({
    where: { id: opts.deliveryId },
  });
  if (!del) throw new InventarioCampoError("Entrega no encontrada.", 404);
  if (del.tecnicoId !== opts.tecnicoId) {
    throw new InventarioCampoError("No autorizado.", 403);
  }
  if (del.confirmedAt) {
    throw new InventarioCampoError("La recepción ya fue confirmada.", 409);
  }
  const updated = await prisma.materialDelivery.update({
    where: { id: opts.deliveryId },
    data: {
      confirmedAt: new Date(),
      confirmationNotes: opts.notes ?? null,
      differenceReported: Boolean(opts.differenceReported),
    },
  });
  await prisma.materialRequest.update({
    where: { id: del.requestId },
    data: { status: "IN_USE" },
  });
  await registrarAuditoriaInventario({
    entidad: "MaterialDelivery",
    registroId: del.id,
    accion: "DELIVERY_CONFIRMED",
    ticketId: del.ticketId,
    valorNuevo: { differenceReported: opts.differenceReported },
  });
  return updated;
}

export async function reportarUsoEntrega(opts: {
  deliveryId: string;
  tecnicoId: string;
  ticketId?: string;
  items: {
    itemId: string;
    usedQty: number;
    returnedQty: number;
    damagedQty: number;
    lostQty?: number;
  }[];
}) {
  const del = await prisma.materialDelivery.findUnique({
    where: { id: opts.deliveryId },
    include: { items: true },
  });
  if (!del) throw new InventarioCampoError("Entrega no encontrada.", 404);
  if (opts.ticketId && del.ticketId !== opts.ticketId) {
    throw new InventarioCampoError("La entrega no pertenece a esta OT.", 403);
  }
  if (del.tecnicoId !== opts.tecnicoId) {
    throw new InventarioCampoError("No autorizado.", 403);
  }
  if (!del.confirmedAt) {
    throw new InventarioCampoError("Confirme la recepción antes de reportar uso.", 409);
  }
  for (const it of opts.items) {
    const row = del.items.find((i) => i.id === it.itemId);
    if (!row) throw new InventarioCampoError("Ítem no encontrado.");
    const check = validarReporteUsoItem({
      deliveredQty: row.deliveredQty,
      usedQty: it.usedQty,
      returnedQty: it.returnedQty,
      damagedQty: it.damagedQty,
      lostQty: it.lostQty ?? 0,
    });
    if (!check.ok) {
      throw new InventarioCampoError(check.error, check.status);
    }
    await prisma.materialDeliveryItem.update({
      where: { id: it.itemId },
      data: {
        usedQty: it.usedQty,
        returnedQty: it.returnedQty,
        damagedQty: it.damagedQty,
        lostQty: it.lostQty ?? 0,
      },
    });
  }
  const itemsAfter = await prisma.materialDeliveryItem.findMany({
    where: { deliveryId: opts.deliveryId },
  });
  const cuadrado = itemsAfter.every((row) => {
    const c = validarConciliacionItem({
      deliveredQty: row.deliveredQty,
      usedQty: row.usedQty,
      returnedQty: row.returnedQty,
      damagedQty: row.damagedQty,
      lostQty: row.lostQty,
    });
    return c.ok;
  });
  await prisma.materialRequest.update({
    where: { id: del.requestId },
    data: { status: cuadrado ? "PENDING_RECONCILIATION" : "IN_USE" },
  });
  await registrarAuditoriaInventario({
    entidad: "MaterialDelivery",
    registroId: del.id,
    accion: "CONSUMPTION_REPORTED",
    ticketId: del.ticketId,
    valorNuevo: { items: opts.items },
  });
  return prisma.materialDelivery.findUniqueOrThrow({
    where: { id: opts.deliveryId },
    include: { items: { include: { inventario: true } } },
  });
}

export async function reportarDano(opts: {
  ticketId: string;
  tecnicoId: string;
  inventarioId: string;
  quantity: number;
  reason: string;
  description?: string | null;
  deliveryId?: string | null;
  deliveryItemId?: string | null;
  photoData?: string | null;
}) {
  const v = validarCantidadPositiva(opts.quantity);
  if (!v.ok) throw new InventarioCampoError(v.error, 400);

  if (!opts.deliveryId && !opts.deliveryItemId) {
    throw new InventarioCampoError(
      "Indique la entrega o el ítem de entrega del material dañado.",
      400
    );
  }

  let deliveryId = opts.deliveryId ?? null;
  let inventarioId = opts.inventarioId;

  if (opts.deliveryItemId) {
    const item = await prisma.materialDeliveryItem.findUnique({
      where: { id: opts.deliveryItemId },
      include: { delivery: true },
    });
    if (!item) throw new InventarioCampoError("Ítem de entrega no encontrado.", 404);
    if (item.delivery.ticketId !== opts.ticketId) {
      throw new InventarioCampoError("El ítem no pertenece a esta OT.", 403);
    }
    if (item.delivery.tecnicoId !== opts.tecnicoId) {
      throw new InventarioCampoError("No autorizado.", 403);
    }
    if (item.inventarioId !== opts.inventarioId && opts.inventarioId) {
      // Prefer delivery item as source of truth
    }
    inventarioId = item.inventarioId;
    deliveryId = item.deliveryId;
    const yaLiquidado =
      item.usedQty + item.returnedQty + item.damagedQty + item.lostQty;
    const pendiente = item.deliveredQty - yaLiquidado;
    if (opts.quantity > pendiente + 1e-9) {
      throw new InventarioCampoError(
        `La cantidad dañada supera lo pendiente de liquidar (${pendiente}).`,
        409
      );
    }
  } else if (deliveryId) {
    const del = await prisma.materialDelivery.findUnique({
      where: { id: deliveryId },
      include: { items: true },
    });
    if (!del) throw new InventarioCampoError("Entrega no encontrada.", 404);
    if (del.ticketId !== opts.ticketId) {
      throw new InventarioCampoError("La entrega no pertenece a esta OT.", 403);
    }
    if (del.tecnicoId !== opts.tecnicoId) {
      throw new InventarioCampoError("No autorizado.", 403);
    }
    const item = del.items.find((i) => i.inventarioId === inventarioId);
    if (!item) {
      throw new InventarioCampoError(
        "El material no pertenece a la entrega de esta OT.",
        409
      );
    }
    const yaLiquidado =
      item.usedQty + item.returnedQty + item.damagedQty + item.lostQty;
    const pendiente = item.deliveredQty - yaLiquidado;
    if (opts.quantity > pendiente + 1e-9) {
      throw new InventarioCampoError(
        `La cantidad dañada supera lo pendiente de liquidar (${pendiente}).`,
        409
      );
    }
  }

  const report = await prisma.materialDamageReport.create({
    data: {
      ticketId: opts.ticketId,
      tecnicoId: opts.tecnicoId,
      inventarioId,
      quantity: opts.quantity,
      reason: opts.reason,
      description: opts.description ?? null,
      deliveryId,
      photoData: opts.photoData ?? null,
      photoUrl: opts.photoData
        ? `/api/inventario/damage-photo/pending`
        : null,
    },
  });
  await registrarAuditoriaInventario({
    entidad: "MaterialDamageReport",
    registroId: report.id,
    accion: "DAMAGE_REPORTED",
    ticketId: opts.ticketId,
    valorNuevo: { quantity: opts.quantity, reason: opts.reason, deliveryId },
  });
  return report;
}

export async function conciliarSolicitud(opts: {
  requestId: string;
  reconciledById: string;
  exceptionAuthorized?: boolean;
  exceptionReason?: string | null;
  notes?: string | null;
}) {
  const req = await prisma.materialRequest.findUnique({
    where: { id: opts.requestId },
    include: {
      deliveries: {
        include: {
          items: { include: { inventario: true, serialAsset: true } },
        },
      },
    },
  });
  if (!req) throw new InventarioCampoError("Solicitud no encontrada.", 404);
  if (req.status === "RECONCILED" || req.status === "CLOSED") {
    throw new InventarioCampoError("Ya está conciliada.", 409);
  }
  const delivery = req.deliveries[0];
  if (!delivery) {
    throw new InventarioCampoError("No hay entrega para conciliar.", 409);
  }

  let totalCost = 0;
  const diffs: { itemId: string; error: string; diferencia: number }[] = [];
  for (const item of delivery.items) {
    const check = validarConciliacionItem(item);
    if (!check.ok) {
      diffs.push({
        itemId: item.id,
        error: check.error,
        diferencia: check.diferencia,
      });
    }
  }
  if (diffs.length && !opts.exceptionAuthorized) {
    throw new InventarioCampoError(
      diffs.map((d) => d.error).join(" | "),
      409
    );
  }
  if (diffs.length && opts.exceptionAuthorized && !opts.exceptionReason?.trim()) {
    throw new InventarioCampoError("Indique el motivo de la excepción.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM "MaterialRequest" WHERE id = ${opts.requestId} FOR UPDATE`;
    const locked = await tx.materialRequest.findUnique({
      where: { id: opts.requestId },
      select: { status: true },
    });
    if (!locked || locked.status === "RECONCILED" || locked.status === "CLOSED") {
      throw new InventarioCampoError("Ya está conciliada.", 409);
    }

    for (const item of delivery.items) {
      const unitCost = item.inventario.unitCost;
      totalCost += calcularCostoLinea(item.usedQty, unitCost);

      const consumirFisico = async (qty: number) => {
        if (qty <= 1e-9) return;
        const stock = await lockStock(tx, req.warehouseId, item.inventarioId);
        if (stock.assignedQty + 1e-9 < qty) {
          throw new InventarioCampoError("Asignado insuficiente al conciliar.", 409);
        }
        if (stock.physicalQty + 1e-9 < qty) {
          throw new InventarioCampoError("Físico insuficiente al conciliar.", 409);
        }
        await tx.warehouseStock.update({
          where: { id: stock.id },
          data: {
            assignedQty: { decrement: qty },
            physicalQty: { decrement: qty },
          },
        });
        assertBucketsOk(
          await tx.warehouseStock.findUniqueOrThrow({ where: { id: stock.id } })
        );
        await tx.inventario.update({
          where: { id: item.inventarioId },
          data: { stock: { decrement: qty } },
        });
      };

      if (item.usedQty > 0) {
        await consumirFisico(item.usedQty);
        await crearMovimiento(tx, {
          inventarioId: item.inventarioId,
          warehouseId: req.warehouseId,
          movementType: "CONSUMPTION",
          quantity: item.usedQty,
          unitCost,
          ticketId: req.ticketId,
          tecnicoId: req.tecnicoId,
          referenceType: "InventoryReconciliation",
          referenceId: req.id,
          performedById: opts.reconciledById,
          serialId: item.serialAssetId,
        });
        if (item.serialAssetId) {
          await tx.serializedAsset.update({
            where: { id: item.serialAssetId },
            data: {
              status: "INSTALLED",
              installedAt: new Date(),
              clienteId: (
                await tx.ticket.findUnique({
                  where: { id: req.ticketId },
                  select: { clienteId: true },
                })
              )?.clienteId,
            },
          });
          await tx.serializedAssetHistorial.create({
            data: {
              assetId: item.serialAssetId,
              fromStatus: "ASSIGNED",
              toStatus: "INSTALLED",
              usuarioId: opts.reconciledById,
            },
          });
          await crearMovimiento(tx, {
            inventarioId: item.inventarioId,
            warehouseId: req.warehouseId,
            movementType: "INSTALLATION",
            quantity: 1,
            unitCost,
            ticketId: req.ticketId,
            referenceType: "SerializedAsset",
            referenceId: item.serialAssetId,
            performedById: opts.reconciledById,
            serialId: item.serialAssetId,
          });
        }
      }
      if (item.returnedQty > 0) {
        const stock = await lockStock(tx, req.warehouseId, item.inventarioId);
        if (stock.assignedQty + 1e-9 < item.returnedQty) {
          throw new InventarioCampoError("Asignado insuficiente en devolución.", 409);
        }
        // Devuelto: sale de asignado; físico ya lo contenía.
        await tx.warehouseStock.update({
          where: { id: stock.id },
          data: { assignedQty: { decrement: item.returnedQty } },
        });
        assertBucketsOk(
          await tx.warehouseStock.findUniqueOrThrow({ where: { id: stock.id } })
        );
        await crearMovimiento(tx, {
          inventarioId: item.inventarioId,
          warehouseId: req.warehouseId,
          movementType: "RETURN",
          quantity: item.returnedQty,
          unitCost,
          ticketId: req.ticketId,
          referenceType: "InventoryReconciliation",
          referenceId: req.id,
          performedById: opts.reconciledById,
        });
        if (item.serialAssetId) {
          await tx.serializedAsset.update({
            where: { id: item.serialAssetId },
            data: {
              status: "RETURNED",
              returnedAt: new Date(),
              assignedTechnicianId: null,
              ticketId: null,
            },
          });
          await tx.serializedAssetHistorial.create({
            data: {
              assetId: item.serialAssetId,
              fromStatus: "ASSIGNED",
              toStatus: "RETURNED",
              usuarioId: opts.reconciledById,
            },
          });
        }
      }
      if (item.damagedQty > 0) {
        await consumirFisico(item.damagedQty);
        await crearMovimiento(tx, {
          inventarioId: item.inventarioId,
          warehouseId: req.warehouseId,
          movementType: "DAMAGE",
          quantity: item.damagedQty,
          unitCost,
          ticketId: req.ticketId,
          referenceType: "InventoryReconciliation",
          referenceId: req.id,
          performedById: opts.reconciledById,
        });
        if (item.serialAssetId) {
          await tx.serializedAsset.update({
            where: { id: item.serialAssetId },
            data: { status: "DAMAGED" },
          });
          await tx.serializedAssetHistorial.create({
            data: {
              assetId: item.serialAssetId,
              fromStatus: "ASSIGNED",
              toStatus: "DAMAGED",
              usuarioId: opts.reconciledById,
            },
          });
        }
      }
      if (item.lostQty > 0) {
        await consumirFisico(item.lostQty);
        await crearMovimiento(tx, {
          inventarioId: item.inventarioId,
          warehouseId: req.warehouseId,
          movementType: "LOSS",
          quantity: item.lostQty,
          unitCost,
          ticketId: req.ticketId,
          referenceType: "InventoryReconciliation",
          referenceId: req.id,
          performedById: opts.reconciledById,
        });
        if (item.serialAssetId) {
          await tx.serializedAsset.update({
            where: { id: item.serialAssetId },
            data: { status: "LOST" },
          });
          await tx.serializedAssetHistorial.create({
            data: {
              assetId: item.serialAssetId,
              fromStatus: "ASSIGNED",
              toStatus: "LOST",
              usuarioId: opts.reconciledById,
            },
          });
        }
      }

      // Excepción: liquidar residual como LOSS para no dejar assignedQty huérfano.
      const contabilizado =
        item.usedQty + item.returnedQty + item.damagedQty + item.lostQty;
      const residual = item.deliveredQty - contabilizado;
      if (residual > 1e-9 && opts.exceptionAuthorized) {
        await consumirFisico(residual);
        await crearMovimiento(tx, {
          inventarioId: item.inventarioId,
          warehouseId: req.warehouseId,
          movementType: "LOSS",
          quantity: residual,
          unitCost,
          ticketId: req.ticketId,
          referenceType: "InventoryReconciliation",
          referenceId: req.id,
          performedById: opts.reconciledById,
          notes: `AUTHORIZED_EXCEPTION: ${opts.exceptionReason}`,
        });
      }
    }

    const rec = await tx.inventoryReconciliation.create({
      data: {
        requestId: req.id,
        ticketId: req.ticketId,
        reconciledById: opts.reconciledById,
        exceptionAuthorized: Boolean(opts.exceptionAuthorized),
        exceptionReason: opts.exceptionReason ?? null,
        totalCost,
        notes: opts.notes ?? null,
      },
    });
    await tx.materialRequest.update({
      where: { id: req.id },
      data: { status: "RECONCILED" },
    });
    await registrarAuditoriaInventario({
      entidad: "InventoryReconciliation",
      registroId: rec.id,
      usuarioId: opts.reconciledById,
      accion: "RECONCILIATION_APPROVED",
      ticketId: req.ticketId,
      valorNuevo: {
        totalCost,
        exception: opts.exceptionAuthorized,
      },
    });
    return rec;
  });
}

export async function materialesDeTicket(ticketId: string) {
  const requests = await prisma.materialRequest.findMany({
    where: { ticketId },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { inventario: true } },
      deliveries: {
        include: {
          items: { include: { inventario: true, serialAsset: true } },
        },
      },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      warehouse: true,
    },
  });
  const activo = requests.find((r) => otTieneFlujoCampoActivo(r.status));
  return { requests, flujoCampoActivo: Boolean(activo), activo };
}

export async function ajustarStock(opts: {
  warehouseId: string;
  inventarioId: string;
  quantity: number;
  tipo: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  performedById: string;
  notes?: string | null;
}) {
  const v = validarCantidadPositiva(opts.quantity);
  if (!v.ok) throw new InventarioCampoError(v.error);
  return prisma.$transaction(async (tx) => {
    const stock = await lockStock(tx, opts.warehouseId, opts.inventarioId);
    if (opts.tipo === "ADJUSTMENT_OUT") {
      const disp = stockDisponible(stock);
      if (opts.quantity > disp + 1e-9) {
        throw new InventarioCampoError("Stock insuficiente para el ajuste.", 409);
      }
      await tx.warehouseStock.update({
        where: { id: stock.id },
        data: { physicalQty: { decrement: opts.quantity } },
      });
      await tx.inventario.update({
        where: { id: opts.inventarioId },
        data: { stock: { decrement: opts.quantity } },
      });
    } else {
      await tx.warehouseStock.update({
        where: { id: stock.id },
        data: { physicalQty: { increment: opts.quantity } },
      });
      await tx.inventario.update({
        where: { id: opts.inventarioId },
        data: { stock: { increment: opts.quantity } },
      });
    }
    assertBucketsOk(
      await tx.warehouseStock.findUniqueOrThrow({ where: { id: stock.id } })
    );
    const mov = await crearMovimiento(tx, {
      inventarioId: opts.inventarioId,
      warehouseId: opts.warehouseId,
      movementType: opts.tipo,
      quantity: opts.quantity,
      performedById: opts.performedById,
      notes: opts.notes,
      referenceType: "Adjustment",
      referenceId: stock.id,
    });
    await registrarAuditoriaInventario({
      entidad: "WarehouseStock",
      registroId: stock.id,
      usuarioId: opts.performedById,
      accion: "INVENTORY_ADJUSTED",
      valorNuevo: { tipo: opts.tipo, quantity: opts.quantity },
    });
    return mov;
  });
}

export async function listarMovimientos(filtros?: {
  inventarioId?: string;
  warehouseId?: string;
  ticketId?: string;
  take?: number;
}) {
  return prisma.inventoryMovement.findMany({
    where: {
      inventarioId: filtros?.inventarioId,
      warehouseId: filtros?.warehouseId,
      ticketId: filtros?.ticketId,
    },
    orderBy: { createdAt: "desc" },
    take: filtros?.take ?? 100,
    include: {
      inventario: { select: { nombre: true, unidad: true } },
      warehouse: { select: { name: true, code: true } },
      performedBy: { select: { nombre: true } },
    },
  });
}

/** Bloquea descuento libre legacy cuando la OT ya entró al pipeline campo (incluye RECONCILED). */
export async function assertDescuentoLegacyPermitido(ticketId: string) {
  const data = await materialesDeTicket(ticketId);
  const bloquea = data.requests.some((r) => otBloqueaDescuentoLegacy(r.status));
  if (bloquea) {
    throw new InventarioCampoError(
      "Esta OT tiene (o tuvo) materiales de campo. Use el flujo entregado/utilizado/devuelto/dañado; el descuento libre está bloqueado.",
      403
    );
  }
}

/**
 * Única puerta de cierre: materiales de campo listos (RECONCILED) o sin flujo activo.
 * Usada por /cerrar y /cerrar-justificacion.
 */
export async function assertMaterialesListosParaCierre(ticketId: string) {
  return assertCierreMaterialesCampo(ticketId);
}

/**
 * Bloquea cierre/envío a revisión si hay flujo campo incompleto:
 * solicitud sin entregar, recepción pendiente, diferencia, o sin conciliar.
 */
export async function assertCierreMaterialesCampo(ticketId: string) {
  const data = await materialesDeTicket(ticketId);
  const activas = data.requests.filter((r) => otTieneFlujoCampoActivo(r.status));
  if (activas.length === 0) return;

  for (const req of activas) {
    if (req.deliveries.length === 0) {
      throw new InventarioCampoError(
        "Existen materiales pendientes de conciliación.",
        409
      );
    }
    for (const del of req.deliveries) {
      if (!del.confirmedAt) {
        throw new InventarioCampoError(
          "Existen materiales pendientes de conciliación.",
          409
        );
      }
      for (const it of del.items) {
        const v = validarConciliacionItem({
          deliveredQty: it.deliveredQty,
          usedQty: it.usedQty,
          returnedQty: it.returnedQty,
          damagedQty: it.damagedQty,
          lostQty: it.lostQty,
        });
        if (!v.ok) {
          throw new InventarioCampoError(
            "Existen materiales pendientes de conciliación.",
            409
          );
        }
      }
    }
    if (req.status !== "RECONCILED") {
      throw new InventarioCampoError(
        "Existen materiales pendientes de conciliación.",
        409
      );
    }
  }
}

/**
 * Libera reservas de solicitudes sin entrega al cancelar OT.
 * No toca material ya entregado (requiere RETURN/DAMAGE/LOSS o excepción).
 */
export async function liberarReservasPendientesPorCancelacionOt(opts: {
  ticketId: string;
  performedById: string;
}) {
  const requests = await prisma.materialRequest.findMany({
    where: {
      ticketId: opts.ticketId,
      status: { in: ["DRAFT", "REQUESTED", "APPROVED", "RESERVED", "PREPARED"] },
    },
    include: { items: true, deliveries: { select: { id: true } } },
  });

  for (const req of requests) {
    if (req.deliveries.length > 0) {
      throw new InventarioCampoError(
        `La solicitud ${req.requestNumber} ya tiene entrega; no se puede cancelar la OT sin liquidar materiales.`,
        409
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "MaterialRequest" WHERE id = ${req.id} FOR UPDATE`;
      if (req.status === "RESERVED" || req.status === "APPROVED" || req.status === "PREPARED") {
        for (const item of req.items) {
          const qty = item.approvedQty ?? 0;
          if (qty <= 1e-9) continue;
          const stock = await lockStock(tx, req.warehouseId, item.inventarioId);
          const release = Math.min(qty, stock.reservedQty);
          if (release > 1e-9) {
            await tx.warehouseStock.update({
              where: { id: stock.id },
              data: { reservedQty: { decrement: release } },
            });
            await crearMovimiento(tx, {
              inventarioId: item.inventarioId,
              warehouseId: req.warehouseId,
              movementType: "RESERVATION_RELEASE",
              quantity: release,
              ticketId: req.ticketId,
              tecnicoId: req.tecnicoId,
              referenceType: "MaterialRequest",
              referenceId: req.id,
              performedById: opts.performedById,
              notes: "Liberación por cancelación de OT",
            });
          }
        }
      }
      await tx.materialRequest.update({
        where: { id: req.id },
        data: { status: "CANCELLED" },
      });
      await registrarAuditoriaInventario({
        entidad: "MaterialRequest",
        registroId: req.id,
        usuarioId: opts.performedById,
        accion: "REQUEST_CANCELLED_OT",
        ticketId: opts.ticketId,
        valorAnterior: { status: req.status },
        valorNuevo: { status: "CANCELLED" },
      });
    });
  }
}
