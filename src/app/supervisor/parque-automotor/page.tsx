"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { StatCard } from "@/components/StatCard";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";

type Dash = {
  total: number;
  operativos: number;
  asignados: number;
  mantenimiento: number;
  fueraServicio: number;
  combustibleMes: number;
  mantenimientoMes: number;
  kmMes: number;
  novedadesPendientes: number;
  alertas: { placa: string; mensaje: string; nivel: string }[];
  rankingConsumo: {
    placa: string;
    km: number;
    galones: number;
    kmPorGalon: number | null;
    costo: number;
  }[];
  rankingCostos: {
    placa: string;
    combustible: number;
    mantenimiento: number;
    reparaciones: number;
    total: number;
  }[];
};

export default function ParqueDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/vehiculos/dashboard")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch(() => setError("No se pudo cargar el dashboard."));
  }, []);

  return (
    <div>
      <AppHeader title="Parque automotor" subtitle="Control vehicular Infinity" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Control parque automotor</h1>
        <ParqueSubnav />
        {error && <p className="text-red-700 text-sm">{error}</p>}
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total" value={String(data.total)} />
              <StatCard label="Operativos" value={String(data.operativos)} />
              <StatCard label="Asignados" value={String(data.asignados)} />
              <StatCard label="Mantenimiento" value={String(data.mantenimiento)} />
              <StatCard label="Fuera de servicio" value={String(data.fueraServicio)} />
              <StatCard label="Combustible (mes)" value={`$${data.combustibleMes}`} />
              <StatCard label="Mantenimiento (mes)" value={`$${data.mantenimientoMes}`} />
              <StatCard label="Novedades abiertas" value={String(data.novedadesPendientes)} />
            </div>
            {data.alertas.length > 0 && (
              <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h2 className="font-semibold mb-2">Alertas</h2>
                <ul className="text-sm space-y-1">
                  {data.alertas.map((a, i) => (
                    <li key={i}>
                      <span className="font-medium uppercase text-xs mr-2">{a.nivel}</span>
                      {a.mensaje}
                {a.mensaje === "Vehículo NO APTO — requiere revisión" ? ` (${a.placa})` : ""}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <section className="border rounded-xl p-4 bg-white">
                <h2 className="font-semibold mb-2">Ranking consumo</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th>Placa</th>
                      <th>Km</th>
                      <th>Gal</th>
                      <th>Km/gal</th>
                      <th>Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rankingConsumo.map((r) => (
                      <tr key={r.placa} className="border-t">
                        <td>{r.placa}</td>
                        <td>{r.km}</td>
                        <td>{r.galones}</td>
                        <td>{r.kmPorGalon ?? "—"}</td>
                        <td>${r.costo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="border rounded-xl p-4 bg-white">
                <h2 className="font-semibold mb-2">Ranking costos</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th>Placa</th>
                      <th>Comb.</th>
                      <th>Mant.</th>
                      <th>Repar.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rankingCostos.map((r) => (
                      <tr key={r.placa} className="border-t">
                        <td>{r.placa}</td>
                        <td>${r.combustible}</td>
                        <td>${r.mantenimiento}</td>
                        <td>${r.reparaciones}</td>
                        <td>${r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
            <Link
              href="/supervisor/parque-automotor/vehiculos"
              className="inline-block px-4 py-2 bg-infinity-600 text-white rounded-lg"
            >
              Administrar vehículos
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
