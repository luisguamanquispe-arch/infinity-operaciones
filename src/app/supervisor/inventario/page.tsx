"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { StatCard } from "@/components/StatCard";
import { InventarioSubnav } from "@/components/inventario/InventarioSubnav";

type Dash = {
  stockTotalItems: number;
  fisico: number;
  reservado: number;
  asignado: number;
  disponible: number;
  critico: number;
  sinStock: number;
  pendienteConciliacion: number;
  costoConsumoMes: number;
  otsBloqueadasInventario?: number;
  serialesAsignados?: number;
  legacyNegativos?: {
    inventarioId: string;
    nombre: string;
    stockLegacy: number;
    physicalQty: number;
    nota: string;
  }[];
};

export default function InventarioDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/inventario/dashboard")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch(() => setError("No se pudo cargar el dashboard."));
  }, []);

  return (
    <div>
      <AppHeader title="Inventario" subtitle="Control de materiales de campo" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Inventario</h1>
        <InventarioSubnav />
        {error && <p className="text-red-700 text-sm">{error}</p>}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Ítems catálogo" value={String(data.stockTotalItems)} />
            <StatCard label="Disponible" value={String(Math.round(data.disponible))} />
            <StatCard label="Reservado" value={String(Math.round(data.reservado))} />
            <StatCard label="Asignado" value={String(Math.round(data.asignado))} />
            <StatCard label="Stock crítico" value={String(data.critico)} />
            <StatCard label="Sin stock" value={String(data.sinStock)} />
            <StatCard label="Pend. conciliación" value={String(data.pendienteConciliacion)} />
            <StatCard label="Costo consumo mes" value={`$${data.costoConsumoMes}`} />
            <StatCard
              label="OTs c/flujo campo"
              value={String(data.otsBloqueadasInventario ?? 0)}
            />
            <StatCard
              label="Seriales asignados"
              value={String(data.serialesAsignados ?? 0)}
            />
          </div>
        )}
        {data?.legacyNegativos && data.legacyNegativos.length > 0 && (
          <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 text-sm space-y-1">
            <p className="font-semibold text-amber-900">Saldos legacy negativos (solo lectura)</p>
            <p className="text-amber-800 text-xs">
              No habilitan operaciones negativas en el flujo de campo. No se corrigen en esta fase.
            </p>
            {data.legacyNegativos.map((l) => (
              <p key={l.inventarioId} className="text-amber-900">
                {l.nombre}: Inventario.stock={l.stockLegacy} · physicalQty={l.physicalQty}
              </p>
            ))}
          </div>
        )}
        <p className="text-sm text-slate-600">
          Flujo: solicitud (supervisor) → aprobación/reserva → preparación (bodega) → entrega →
          recepción/uso (técnico) → conciliación → kardex. El técnico no puede solicitar ni
          descontar stock libre cuando la OT usa este flujo.
        </p>
      </main>
    </div>
  );
}
