"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";
import { Campo, campoControl } from "@/components/parque/Campo";

type VehiculoOpt = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  kilometrajeActual: number;
};

type Vecina = { id?: string; dia: string; kilometraje: number } | null;

type Faltante = {
  dia: string;
  anterior: Vecina;
  posterior: Vecina;
  diferencia: number | null;
};

type Borrador = {
  kilometraje: string;
  tipoLectura: "REAL" | "ESTIMADA";
  justificacion: string;
  fuente: string;
  incluir: boolean;
};

type Consulta = {
  vehiculo: VehiculoOpt;
  desde: string;
  hasta: string;
  historial: {
    id: string;
    fecha: string;
    createdAt: string;
    kilometraje: number;
    origen: string;
    tipoLectura: string;
    fuente: string | null;
    observacion: string | null;
  }[];
  faltantes: Faltante[];
  correcciones: {
    id: string;
    accion: string;
    motivo: string | null;
    valorNuevo: string | null;
    createdAt: string;
    usuarioNombre: string | null;
  }[];
};

function hoyIso() {
  const n = new Date();
  const t = new Date(n.getTime() - 5 * 60 * 60 * 1000);
  return t.toISOString().slice(0, 10);
}

function haceDias(n: number) {
  const t = new Date(Date.now() - 5 * 60 * 60 * 1000 - n * 86400000);
  return t.toISOString().slice(0, 10);
}

export default function RegularizacionKmPage() {
  const [vehiculos, setVehiculos] = useState<VehiculoOpt[]>([]);
  const [vehiculoId, setVehiculoId] = useState("");
  const [desde, setDesde] = useState(haceDias(14));
  const [hasta, setHasta] = useState(hoyIso());
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [borrador, setBorrador] = useState<Record<string, Borrador>>({});
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/vehiculos")
      .then((r) => r.json())
      .then((j) => setVehiculos(j.items || []))
      .catch(() => setError("No se pudo cargar el listado de vehículos."));
  }, []);

  const seleccionados = useMemo(
    () => Object.entries(borrador).filter(([, b]) => b.incluir && b.kilometraje !== ""),
    [borrador]
  );

  async function consultar(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setOk("");
    if (!vehiculoId) {
      setError("Seleccione un vehículo.");
      return;
    }
    setCargando(true);
    try {
      const r = await fetch(
        `/api/vehiculos/${vehiculoId}/kilometraje?desde=${desde}&hasta=${hasta}`
      );
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "No se pudo consultar el historial.");
        setConsulta(null);
        return;
      }
      setConsulta(j);
      const next: Record<string, Borrador> = {};
      for (const f of j.faltantes as Faltante[]) {
        next[f.dia] = {
          kilometraje: f.anterior ? String(f.anterior.kilometraje) : "",
          tipoLectura: "REAL",
          justificacion: "",
          fuente: "",
          incluir: false,
        };
      }
      setBorrador(next);
    } catch {
      setError("No se pudo consultar el historial.");
    } finally {
      setCargando(false);
    }
  }

  function cancelar() {
    setConsulta(null);
    setBorrador({});
    setError("");
    setOk("");
  }

  async function guardar() {
    if (!consulta) return;
    const items = seleccionados.map(([dia, b]) => ({
      dia,
      kilometraje: Number(b.kilometraje),
      tipoLectura: b.tipoLectura,
      justificacion: b.justificacion,
      fuente: b.fuente || null,
    }));
    if (items.length === 0) {
      setError("Marque al menos un día faltante e ingrese el kilometraje.");
      return;
    }
    const resumen = items
      .map((i) => `${i.dia}: ${i.kilometraje} km (${i.tipoLectura === "ESTIMADA" ? "estimada" : "real"})`)
      .join("\n");
    if (!confirm(`¿Guardar ${items.length} regularización(es)?\n\n${resumen}`)) return;
    setGuardando(true);
    setError("");
    setOk("");
    try {
      const r = await fetch(`/api/vehiculos/${consulta.vehiculo.id}/kilometraje/regularizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "No se pudo guardar.");
        return;
      }
      setOk(`Se guardaron ${j.lecturas?.length || items.length} lecturas históricas.`);
      await consultar();
    } catch {
      setError("No se pudo guardar la regularización.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <AppHeader title="Kilometraje" subtitle="Regularización histórica" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Regularización de kilometraje histórico</h1>
        <ParqueSubnav />
        <p className="text-sm text-slate-600">
          Complete días sin registro. No se sobrescriben lecturas existentes ni se reparte el
          kilometraje de forma automática.
        </p>
        <form className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white border rounded-xl p-4" onSubmit={consultar}>
          <Campo label="Vehículo">
            <select
              className={campoControl}
              value={vehiculoId}
              onChange={(e) => setVehiculoId(e.target.value)}
              required
            >
              <option value="">Seleccione placa, marca y modelo</option>
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} · {v.marca} {v.modelo} · {v.kilometrajeActual} km
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Desde">
            <input type="date" className={campoControl} value={desde} onChange={(e) => setDesde(e.target.value)} required />
          </Campo>
          <Campo label="Hasta">
            <input type="date" className={campoControl} value={hasta} onChange={(e) => setHasta(e.target.value)} required />
          </Campo>
          <div className="flex items-end gap-2">
            <button className="bg-infinity-600 text-white rounded px-4 py-2 text-sm" disabled={cargando}>
              {cargando ? "Consultando…" : "Consultar historial"}
            </button>
            <button type="button" className="border rounded px-4 py-2 text-sm" onClick={cancelar}>
              Cancelar
            </button>
          </div>
        </form>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {ok && <p className="text-sm text-emerald-700">{ok}</p>}
        {consulta && (
          <>
            <section className="bg-white border rounded-xl p-4 text-sm">
              <h2 className="font-semibold mb-1">
                <Link className="text-infinity-700" href={`/supervisor/parque-automotor/vehiculos/${consulta.vehiculo.id}`}>
                  {consulta.vehiculo.placa}
                </Link>{" "}
                · {consulta.vehiculo.marca} {consulta.vehiculo.modelo}
              </h2>
              <p>
                Período {consulta.desde} a {consulta.hasta} · Actual {consulta.vehiculo.kilometrajeActual} km ·{" "}
                {consulta.faltantes.length} día(s) sin registro
              </p>
            </section>
            <section className="bg-white border rounded-xl p-4 overflow-x-auto">
              <h2 className="font-semibold mb-2">Días faltantes</h2>
              {consulta.faltantes.length === 0 ? (
                <p className="text-sm text-slate-600">No hay días sin lectura en el período.</p>
              ) : (
                <table className="w-full text-sm min-w-[960px]">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th className="py-2 pr-2">Incluir</th>
                      <th className="py-2 pr-2">Fecha histórica</th>
                      <th className="py-2 pr-2">Anterior</th>
                      <th className="py-2 pr-2">Propuesto</th>
                      <th className="py-2 pr-2">Posterior</th>
                      <th className="py-2 pr-2">Diferencia</th>
                      <th className="py-2 pr-2">Tipo</th>
                      <th className="py-2 pr-2">Justificación</th>
                      <th className="py-2 pr-2">Fuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consulta.faltantes.map((f) => {
                      const b = borrador[f.dia];
                      if (!b) return null;
                      return (
                        <tr key={f.dia} className="border-b align-top">
                          <td className="py-2 pr-2">
                            <input
                              type="checkbox"
                              checked={b.incluir}
                              onChange={(e) =>
                                setBorrador((prev) => ({
                                  ...prev,
                                  [f.dia]: { ...b, incluir: e.target.checked },
                                }))
                              }
                            />
                          </td>
                          <td className="py-2 pr-2 whitespace-nowrap">{f.dia}</td>
                          <td className="py-2 pr-2">{f.anterior ? `${f.anterior.kilometraje} km` : "—"}</td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min={0}
                              className={campoControl}
                              value={b.kilometraje}
                              onChange={(e) =>
                                setBorrador((prev) => ({
                                  ...prev,
                                  [f.dia]: { ...b, kilometraje: e.target.value, incluir: true },
                                }))
                              }
                            />
                          </td>
                          <td className="py-2 pr-2">{f.posterior ? `${f.posterior.kilometraje} km` : "—"}</td>
                          <td className="py-2 pr-2">{f.diferencia == null ? "—" : `${f.diferencia} km`}</td>
                          <td className="py-2 pr-2">
                            <select
                              className={campoControl}
                              value={b.tipoLectura}
                              onChange={(e) =>
                                setBorrador((prev) => ({
                                  ...prev,
                                  [f.dia]: {
                                    ...b,
                                    tipoLectura: e.target.value as "REAL" | "ESTIMADA",
                                    incluir: true,
                                  },
                                }))
                              }
                            >
                              <option value="REAL">Real</option>
                              <option value="ESTIMADA">Estimada</option>
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              className={campoControl}
                              value={b.justificacion}
                              onChange={(e) =>
                                setBorrador((prev) => ({
                                  ...prev,
                                  [f.dia]: { ...b, justificacion: e.target.value, incluir: true },
                                }))
                              }
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              className={campoControl}
                              value={b.fuente}
                              onChange={(e) =>
                                setBorrador((prev) => ({
                                  ...prev,
                                  [f.dia]: { ...b, fuente: e.target.value },
                                }))
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {consulta.faltantes.length > 0 && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="bg-infinity-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
                    disabled={guardando || seleccionados.length === 0}
                    onClick={() => void guardar()}
                  >
                    {guardando ? "Guardando…" : "Guardar regularización"}
                  </button>
                  <button type="button" className="border rounded px-4 py-2 text-sm" onClick={cancelar}>
                    Cancelar sin guardar
                  </button>
                </div>
              )}
            </section>
            <section className="bg-white border rounded-xl p-4">
              <h2 className="font-semibold mb-2">Historial cronológico</h2>
              <ul className="text-sm space-y-1">
                {consulta.historial.map((h) => (
                  <li key={h.id}>
                    {new Date(h.fecha).toLocaleDateString("es-EC")} · {h.kilometraje} km · {h.origen} ·{" "}
                    <span className={h.tipoLectura === "ESTIMADA" ? "text-amber-800" : "text-slate-700"}>
                      {h.tipoLectura === "ESTIMADA" ? "Estimada" : "Real"}
                    </span>
                    {h.observacion ? ` · ${h.observacion}` : ""}
                  </li>
                ))}
              </ul>
            </section>
            <section className="bg-white border rounded-xl p-4">
              <h2 className="font-semibold mb-2">Correcciones y regularizaciones</h2>
              {consulta.correcciones.length === 0 ? (
                <p className="text-sm text-slate-600">Aún no hay correcciones registradas.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {consulta.correcciones.map((c) => (
                    <li key={c.id}>
                      {new Date(c.createdAt).toLocaleString("es-EC")} · {c.accion}
                      {c.usuarioNombre ? ` · ${c.usuarioNombre}` : ""} · {c.motivo || "sin motivo"}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
