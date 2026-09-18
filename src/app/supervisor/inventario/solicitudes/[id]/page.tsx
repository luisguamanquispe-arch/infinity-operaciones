"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { InventarioSubnav } from "@/components/inventario/InventarioSubnav";
import { ESTADOS_SOLICITUD_LABELS } from "@/lib/inventario-campo/reglas";

type RequestDetail = {
  id: string;
  requestNumber: string;
  status: string;
  justification: string | null;
  ticket: { codigo: string; cliente: { nombre: string } };
  tecnico: { usuario: { nombre: string } };
  warehouse: { name: string };
  items: {
    id: string;
    requestedQty: number;
    approvedQty: number | null;
    inventario: { id: string; nombre: string; unidad: string };
  }[];
  deliveries: {
    id: string;
    deliveryNumber: string;
    confirmedAt: string | null;
    items: {
      id: string;
      deliveredQty: number;
      usedQty: number;
      returnedQty: number;
      damagedQty: number;
      lostQty: number;
      inventario: { nombre: string; unidad: string };
    }[];
  }[];
};

export default function SolicitudDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [req, setReq] = useState<RequestDetail | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [approved, setApproved] = useState<Record<string, number>>({});
  const [exception, setException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");

  async function cargar() {
    const r = await fetch(`/api/material-requests/${id}`);
    const j = await r.json();
    if (!r.ok) setError(j.error || "Error");
    else {
      setReq(j.request);
      const map: Record<string, number> = {};
      for (const it of j.request.items) {
        map[it.id] = it.approvedQty ?? it.requestedQty;
      }
      setApproved(map);
    }
  }

  useEffect(() => {
    void cargar();
  }, [id]);

  async function post(path: string, body?: unknown) {
    setError("");
    setMsg("");
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const j = await r.json();
    if (!r.ok) setError(j.error || "Error");
    else {
      setMsg("Operación realizada.");
      await cargar();
    }
  }

  if (!req) {
    return (
      <div>
        <AppHeader title="Solicitud" subtitle="Inventario" />
        <main className="p-4">{error || "Cargando…"}</main>
      </div>
    );
  }

  const delivery = req.deliveries[0];

  return (
    <div>
      <AppHeader title={req.requestNumber} subtitle="Solicitud de materiales" />
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <InventarioSubnav />
        {error && <p className="text-red-700 text-sm bg-red-50 border border-red-200 rounded p-2">{error}</p>}
        {msg && <p className="text-emerald-800 text-sm bg-emerald-50 border rounded p-2">{msg}</p>}
        <section className="border rounded-xl p-4 bg-white text-sm space-y-1">
          <p>
            <span className="text-slate-500">Estado:</span>{" "}
            {ESTADOS_SOLICITUD_LABELS[req.status] || req.status}
          </p>
          <p>
            OT {req.ticket.codigo} · {req.ticket.cliente.nombre}
          </p>
          <p>Técnico: {req.tecnico.usuario.nombre}</p>
          <p>Bodega: {req.warehouse.name}</p>
          {req.justification && <p>Justificación: {req.justification}</p>}
        </section>

        <section className="border rounded-xl p-4 bg-white space-y-2">
          <h2 className="font-semibold">Materiales</h2>
          {req.items.map((it) => (
            <div key={it.id} className="flex flex-wrap gap-2 items-center text-sm border-b py-2">
              <span className="flex-1">
                {it.inventario.nombre} · solicitado {it.requestedQty} {it.inventario.unidad}
              </span>
              {(req.status === "REQUESTED" || req.status === "DRAFT") && (
                <input
                  type="number"
                  className="border rounded px-2 w-28"
                  value={approved[it.id] ?? it.requestedQty}
                  onChange={(e) =>
                    setApproved({ ...approved, [it.id]: Number(e.target.value) })
                  }
                />
              )}
              {it.approvedQty != null && (
                <span className="text-xs text-slate-500">aprobado {it.approvedQty}</span>
              )}
            </div>
          ))}
        </section>

        <div className="flex flex-wrap gap-2">
          {(req.status === "REQUESTED" || req.status === "DRAFT") && (
            <>
              <button
                className="px-4 py-2 bg-infinity-600 text-white rounded-lg"
                onClick={() =>
                  post(`/api/material-requests/${id}/approve`, {
                    items: Object.entries(approved).map(([itemId, approvedQty]) => ({
                      itemId,
                      approvedQty,
                    })),
                  })
                }
              >
                Aprobar y reservar
              </button>
              <button
                className="px-4 py-2 border border-red-300 text-red-700 rounded-lg"
                onClick={() =>
                  post(`/api/material-requests/${id}/approve`, {
                    reject: true,
                    rejectionReason: "Rechazada por supervisor",
                  })
                }
              >
                Rechazar
              </button>
            </>
          )}
          {(req.status === "RESERVED" || req.status === "APPROVED") && (
            <button
              className="px-4 py-2 border border-infinity-600 text-infinity-700 rounded-lg"
              onClick={() => post(`/api/material-requests/${id}/prepare`, {})}
            >
              Marcar preparada (bodega)
            </button>
          )}
          {(req.status === "RESERVED" || req.status === "APPROVED" || req.status === "PREPARED") && (
            <button
              className="px-4 py-2 bg-infinity-600 text-white rounded-lg"
              onClick={() => post(`/api/material-requests/${id}/deliver`, {})}
            >
              Registrar entrega
            </button>
          )}
          {(req.status === "PENDING_RECONCILIATION" ||
            req.status === "IN_USE" ||
            req.status === "DELIVERED") && (
            <div className="w-full space-y-2 border rounded-xl p-3">
              <label className="flex gap-2 text-sm items-center">
                <input
                  type="checkbox"
                  checked={exception}
                  onChange={(e) => setException(e.target.checked)}
                />
                Autorizar excepción de diferencia
              </label>
              {exception && (
                <input
                  className="border rounded px-2 py-1.5 w-full text-sm"
                  placeholder="Motivo de excepción"
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                />
              )}
              <button
                className="px-4 py-2 bg-infinity-600 text-white rounded-lg"
                onClick={() =>
                  post(`/api/material-requests/${id}/reconcile`, {
                    exceptionAuthorized: exception,
                    exceptionReason,
                  })
                }
              >
                Conciliar
              </button>
            </div>
          )}
        </div>

        {delivery && (
          <section className="border rounded-xl p-4 bg-white text-sm space-y-2">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <h2 className="font-semibold">Entrega {delivery.deliveryNumber}</h2>
              <a
                className="text-infinity-700 text-xs underline"
                href={`/api/inventario/pdf?deliveryId=${encodeURIComponent(delivery.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                PDF acta entrega
              </a>
            </div>
            <p className="text-xs text-slate-500">
              Confirmada: {delivery.confirmedAt ? new Date(delivery.confirmedAt).toLocaleString("es-EC") : "pendiente"}
            </p>
            {delivery.items.map((it) => (
              <div key={it.id} className="border-t pt-2">
                {it.inventario.nombre}: entregado {it.deliveredQty} · usado {it.usedQty} ·
                devuelto {it.returnedQty} · dañado {it.damagedQty} · perdido {it.lostQty}
              </div>
            ))}
            {(req.status === "RECONCILED" || req.status === "PENDING_RECONCILIATION") && (
              <a
                className="inline-block text-infinity-700 text-xs underline"
                href={`/api/inventario/pdf?requestId=${encodeURIComponent(req.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                PDF consumo / conciliación
              </a>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
