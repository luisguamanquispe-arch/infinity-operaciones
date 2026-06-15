"use client";

import { useEffect, useState } from "react";
import { Loader2, Users, Ticket, Wrench, RefreshCw } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { StatCard } from "@/components/StatCard";
import { DeployVersionBanner, GerenciaQuickNav } from "@/components/DeployVersionBanner";

interface GerenciaData {
  operacion: {
    clientesActivos: number;
    ticketsAbiertos: number;
    instalacionesMes: number;
    reconexionesMes: number;
    retirosMes: number;
  };
  rendimiento: {
    tecnico: string;
    cerrados: number;
    tiempoPromedioMin: number;
  }[];
  sla: { menos4h: number; menos8h: number; mas24h: number };
  inventarioBajo: { nombre: string; stock: number; stockMin: number }[];
  totalTecnicos: number;
}

export default function GerenciaDashboard() {
  const [data, setData] = useState<GerenciaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/gerencia/dashboard", { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok || json.error || !json.operacion) {
          throw new Error(json.error || "No se pudo cargar el panel");
        }
        setData(json);
        setError("");
      })
      .catch((e) => {
        setData(null);
        setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Panel Gerencial" subtitle="Infinity Internet" />
      <DeployVersionBanner />

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <GerenciaQuickNav totalTecnicos={data?.totalTecnicos} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-4">
            {error}. Verifique que inició sesión como administrador (admin@infinity.ec).
          </div>
        )}

        {loading && !data ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
          </div>
        ) : data ? (
          <>
            <section>
              <h2 className="font-semibold mb-3">Operación</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard
                  label="Clientes activos"
                  value={data.operacion.clientesActivos}
                  icon={Users}
                  color="blue"
                />
                <StatCard
                  label="Tickets abiertos"
                  value={data.operacion.ticketsAbiertos}
                  icon={Ticket}
                  color="yellow"
                />
                <StatCard
                  label="Instalaciones/mes"
                  value={data.operacion.instalacionesMes}
                  icon={Wrench}
                  color="green"
                />
                <StatCard
                  label="Reconexiones/mes"
                  value={data.operacion.reconexionesMes}
                  icon={RefreshCw}
                  color="blue"
                />
                <StatCard
                  label="Retiros/mes"
                  value={data.operacion.retirosMes}
                  color="slate"
                />
              </div>
            </section>

            <section>
              <h2 className="font-semibold mb-3">Rendimiento técnico</h2>
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3">Técnico</th>
                      <th className="text-left p-3">Cerrados</th>
                      <th className="text-left p-3">Tiempo promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rendimiento.map((r) => (
                      <tr key={r.tecnico} className="border-t">
                        <td className="p-3 font-medium">{r.tecnico}</td>
                        <td className="p-3">{r.cerrados}</td>
                        <td className="p-3">{r.tiempoPromedioMin} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="font-semibold mb-3">SLA (tickets cerrados del mes)</h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Menos de 4h" value={data.sla.menos4h} color="green" />
                <StatCard label="Menos de 8h" value={data.sla.menos8h} color="yellow" />
                <StatCard label="Más de 24h" value={data.sla.mas24h} color="red" />
              </div>
            </section>

            {data.inventarioBajo.length > 0 && (
              <section>
                <h2 className="font-semibold mb-3 text-red-700">Inventario bajo mínimo</h2>
                <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left p-3">Material</th>
                        <th className="text-left p-3">Stock</th>
                        <th className="text-left p-3">Mínimo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.inventarioBajo.map((i) => (
                        <tr key={i.nombre} className="border-t border-red-200">
                          <td className="p-3">{i.nombre}</td>
                          <td className="p-3 font-semibold text-red-700">{i.stock}</td>
                          <td className="p-3">{i.stockMin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
