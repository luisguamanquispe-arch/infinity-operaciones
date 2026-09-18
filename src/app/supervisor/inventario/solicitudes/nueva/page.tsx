"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { InventarioSubnav } from "@/components/inventario/InventarioSubnav";
import { Campo, campoControl } from "@/components/parque/Campo";

type TicketOpt = { id: string; codigo: string; clienteNombre: string; tecnicoId: string | null };
type InvOpt = { id: string; nombre: string; unidad: string; stock: number };
type TecOpt = { id: string; nombre: string };

export default function NuevaSolicitudPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketOpt[]>([]);
  const [tecnicos, setTecnicos] = useState<TecOpt[]>([]);
  const [inventario, setInventario] = useState<InvOpt[]>([]);
  const [ticketId, setTicketId] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [justification, setJustification] = useState("");
  const [lines, setLines] = useState<{ inventarioId: string; requestedQty: number }[]>([
    { inventarioId: "", requestedQty: 1 },
  ]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/supervisor/asignaciones")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.tickets || []).map(
          (t: {
            id: string;
            codigo: string;
            cliente?: { nombre: string };
            tecnicoIds?: string[];
          }) => ({
            id: t.id,
            codigo: t.codigo,
            clienteNombre: t.cliente?.nombre || "",
            tecnicoId: t.tecnicoIds?.[0] || null,
          })
        );
        setTickets(list);
      })
      .catch(() => undefined);
    fetch("/api/tecnicos")
      .then((r) => r.json())
      .then((j) =>
        setTecnicos(
          (j.tecnicos || []).map((t: { id: string; nombre?: string; usuario?: { nombre: string } }) => ({
            id: t.id,
            nombre: t.nombre || t.usuario?.nombre || t.id,
          }))
        )
      );
    fetch("/api/inventario/items")
      .then((r) => r.json())
      .then((j) => setInventario(j.items || []));
  }, []);

  useEffect(() => {
    const t = tickets.find((x) => x.id === ticketId);
    if (t?.tecnicoId) setTecnicoId(t.tecnicoId);
  }, [ticketId, tickets]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/material-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId,
        tecnicoId,
        justification,
        enviar: true,
        items: lines.filter((l) => l.inventarioId && l.requestedQty > 0),
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Error");
      return;
    }
    router.push(`/supervisor/inventario/solicitudes/${j.request.id}`);
  }

  return (
    <div>
      <AppHeader title="Nueva solicitud" subtitle="Materiales" />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Nueva solicitud de materiales</h1>
        <InventarioSubnav />
        {error && <p className="text-red-700 text-sm">{error}</p>}
        <form onSubmit={enviar} className="space-y-3 border rounded-xl p-4 bg-white">
          <Campo label="Orden de trabajo">
            <select
              className={campoControl}
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              required
            >
              <option value="">Seleccione OT</option>
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo} — {t.clienteNombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Técnico">
            <select
              className={campoControl}
              value={tecnicoId}
              onChange={(e) => setTecnicoId(e.target.value)}
              required
            >
              <option value="">Seleccione técnico</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Justificación">
            <textarea
              className={campoControl}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </Campo>
          <div className="space-y-2">
            <p className="text-sm font-medium">Materiales</p>
            {lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2">
                <select
                  className={campoControl}
                  value={l.inventarioId}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], inventarioId: e.target.value };
                    setLines(next);
                  }}
                  required
                >
                  <option value="">Material</option>
                  {inventario.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} ({i.stock} {i.unidad})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  className={campoControl}
                  value={l.requestedQty}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...next[idx], requestedQty: Number(e.target.value) };
                    setLines(next);
                  }}
                  required
                />
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-infinity-700"
              onClick={() => setLines([...lines, { inventarioId: "", requestedQty: 1 }])}
            >
              + Agregar línea
            </button>
          </div>
          <button className="w-full bg-infinity-600 text-white rounded-lg py-2.5 font-medium">
            Enviar solicitud
          </button>
        </form>
      </main>
    </div>
  );
}
