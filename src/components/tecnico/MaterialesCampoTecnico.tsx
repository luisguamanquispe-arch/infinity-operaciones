"use client";

import { useCallback, useEffect, useState } from "react";

type DeliveryItem = {
  id: string;
  deliveredQty: number;
  usedQty: number;
  returnedQty: number;
  damagedQty: number;
  lostQty: number;
  inventario: { id: string; nombre: string; unidad: string };
};

type Delivery = {
  id: string;
  deliveryNumber: string;
  confirmedAt: string | null;
  items: DeliveryItem[];
};

type RequestRow = {
  id: string;
  requestNumber: string;
  status: string;
  deliveries: Delivery[];
};

type LineEdit = {
  usedQty: string;
  returnedQty: string;
  damagedQty: string;
  lostQty: string;
};

export function MaterialesCampoTecnico({ ticketId }: { ticketId: string }) {
  const [flujoActivo, setFlujoActivo] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [edits, setEdits] = useState<Record<string, LineEdit>>({});

  const cargar = useCallback(async () => {
    setError("");
    const r = await fetch(`/api/tickets/${ticketId}/materiales-campo`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "No se pudo cargar materiales de campo");
      return;
    }
    setFlujoActivo(Boolean(j.flujoCampoActivo));
    setRequests(j.requests || []);
    const map: Record<string, LineEdit> = {};
    for (const req of j.requests || []) {
      for (const del of req.deliveries || []) {
        for (const it of del.items || []) {
          map[it.id] = {
            usedQty: String(it.usedQty ?? 0),
            returnedQty: String(it.returnedQty ?? 0),
            damagedQty: String(it.damagedQty ?? 0),
            lostQty: String(it.lostQty ?? 0),
          };
        }
      }
    }
    setEdits(map);
  }, [ticketId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function confirmar(deliveryId: string) {
    setError("");
    setMsg("");
    const r = await fetch(`/api/material-deliveries/${deliveryId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await r.json();
    if (!r.ok) setError(j.error || "No se pudo confirmar");
    else {
      setMsg("Recepción confirmada.");
      await cargar();
    }
  }

  async function guardarUso(delivery: Delivery) {
    setError("");
    setMsg("");
    const items = delivery.items.map((it) => {
      const e = edits[it.id] || {
        usedQty: "0",
        returnedQty: "0",
        damagedQty: "0",
        lostQty: "0",
      };
      return {
        itemId: it.id,
        usedQty: Number(e.usedQty) || 0,
        returnedQty: Number(e.returnedQty) || 0,
        damagedQty: Number(e.damagedQty) || 0,
        lostQty: Number(e.lostQty) || 0,
      };
    });
    const r = await fetch(`/api/tickets/${ticketId}/materiales-campo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "uso", deliveryId: delivery.id, items }),
    });
    const j = await r.json();
    if (!r.ok) setError(j.error || "No se pudo guardar uso");
    else {
      setMsg("Uso / devolución / daño registrados.");
      await cargar();
    }
  }

  if (!flujoActivo && requests.length === 0) return null;

  const deliveryActiva = requests.flatMap((r) => r.deliveries)[0];

  return (
    <section className="bg-white rounded-xl border p-4 space-y-3 border-infinity-200">
      <h3 className="font-semibold text-infinity-800">Materiales de la OT</h3>
      <p className="text-xs text-slate-500">
        Flujo de campo: entregado / utilizado / devuelto / dañado. El descuento libre de
        inventario está bloqueado mientras haya una solicitud activa.
      </p>
      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-2 rounded-lg">{error}</div>
      )}
      {msg && (
        <div className="bg-emerald-50 text-emerald-800 text-sm p-2 rounded-lg">{msg}</div>
      )}
      {requests.map((req) => (
        <div key={req.id} className="text-xs text-slate-600">
          {req.requestNumber} · {req.status}
        </div>
      ))}
      {!deliveryActiva && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Solicitud activa sin entrega registrada. Espere a bodega/supervisor.
        </p>
      )}
      {deliveryActiva && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <p className="text-sm font-medium">{deliveryActiva.deliveryNumber}</p>
            {!deliveryActiva.confirmedAt ? (
              <button
                type="button"
                onClick={() => void confirmar(deliveryActiva.id)}
                className="px-3 py-1.5 bg-infinity-600 text-white rounded-lg text-sm"
              >
                Confirmar recepción
              </button>
            ) : (
              <span className="text-xs text-emerald-700">Recepción confirmada</span>
            )}
          </div>
          {deliveryActiva.items.map((it) => {
            const e = edits[it.id] || {
              usedQty: "0",
              returnedQty: "0",
              damagedQty: "0",
              lostQty: "0",
            };
            const pendiente =
              it.deliveredQty -
              (Number(e.usedQty) || 0) -
              (Number(e.returnedQty) || 0) -
              (Number(e.damagedQty) || 0) -
              (Number(e.lostQty) || 0);
            return (
              <div key={it.id} className="border rounded-lg p-3 space-y-2 text-sm">
                <p className="font-medium">
                  {it.inventario.nombre} · entregado {it.deliveredQty} {it.inventario.unidad}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["usedQty", "Utilizado"],
                      ["returnedQty", "Devuelto"],
                      ["damagedQty", "Dañado"],
                      ["lostQty", "Perdido"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="text-xs space-y-1">
                      <span className="text-slate-500">{label}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="w-full border rounded-lg px-2 py-1.5"
                        value={e[key]}
                        disabled={!deliveryActiva.confirmedAt}
                        onChange={(ev) =>
                          setEdits((prev) => ({
                            ...prev,
                            [it.id]: { ...e, [key]: ev.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <p
                  className={`text-xs ${
                    Math.abs(pendiente) > 1e-6 ? "text-amber-700" : "text-slate-500"
                  }`}
                >
                  Pendiente por conciliar: {pendiente} {it.inventario.unidad}
                </p>
              </div>
            );
          })}
          {deliveryActiva.confirmedAt && (
            <button
              type="button"
              onClick={() => void guardarUso(deliveryActiva)}
              className="w-full py-2 bg-infinity-600 text-white rounded-lg text-sm font-medium"
            >
              Guardar uso / devolución / daño
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function useFlujoCampoActivo(ticketId: string | undefined) {
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    if (!ticketId) return;
    fetch(`/api/tickets/${ticketId}/materiales-campo`)
      .then((r) => r.json())
      .then((j) => setActivo(Boolean(j.flujoCampoActivo)))
      .catch(() => setActivo(false));
  }, [ticketId]);
  return activo;
}
