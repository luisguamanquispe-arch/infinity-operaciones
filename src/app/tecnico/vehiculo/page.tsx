"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { INSPECCION_ITEMS } from "@/lib/parque-automotor/labels";

type VehiculoMio = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  kilometraje: number;
  estado: string;
  proximoMantenimientoKm: number | null;
  alertaMant: string | null;
  alertaNoApto?: string | null;
  bloqueadoCampo?: boolean;
};

export default function TecnicoMiVehiculoPage() {
  const [vehiculo, setVehiculo] = useState<VehiculoMio | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [km, setKm] = useState(0);
  const [comb, setComb] = useState({ estacion: "", galones: 0, precioPorGalon: 0, kilometraje: 0 });
  const [items, setItems] = useState<Record<string, boolean>>(
    Object.fromEntries(INSPECCION_ITEMS.map((i) => [i.key, true]))
  );
  const [combustiblePct, setCombustiblePct] = useState(50);
  const [nov, setNov] = useState({ tipo: "MECANICA", descripcion: "", puedeCircular: true, kilometraje: 0 });
  const [mants, setMants] = useState<{ id: string; tipo: string; descripcion: string; costo: number }[]>([]);

  async function cargar() {
    const r = await fetch("/api/tecnico/vehiculo");
    const j = await r.json();
    setVehiculo(j.vehiculo ?? null);
    if (j.vehiculo) {
      setKm(j.vehiculo.kilometraje);
      setComb((c) => ({ ...c, kilometraje: j.vehiculo.kilometraje }));
      setNov((n) => ({ ...n, kilometraje: j.vehiculo.kilometraje }));
    }
    const m = await fetch("/api/tecnico/vehiculo/mantenimiento").then((x) => x.json());
    setMants(m.items || []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function post(path: string, body: unknown) {
    setError("");
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) setError(j.error || "Error");
    else {
      if (j.mensajeAnormal) setError(j.mensajeAnormal);
      await cargar();
    }
  }

  if (vehiculo === undefined) {
    return (
      <div>
        <AppHeader title="Mi vehículo" subtitle="Infinity Técnicos" modules={false} />
        <main className="p-4">Cargando…</main>
      </div>
    );
  }

  if (!vehiculo) {
    return (
      <div>
        <AppHeader title="Mi vehículo" subtitle="Infinity Técnicos" modules={false} />
        <main className="max-w-xl mx-auto p-4">
          <h1 className="text-lg font-semibold">Mi vehículo</h1>
          <p className="text-sm text-slate-600 mt-2">No tiene un vehículo asignado.</p>
          <Link href="/tecnico" className="text-infinity-700 text-sm">
            Volver a mis órdenes
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div>
      <AppHeader title="Mi vehículo" subtitle="Infinity Técnicos" modules={false} />
      <main className="max-w-xl mx-auto p-4 space-y-4">
        <Link href="/tecnico" className="text-sm text-infinity-700">
          ← Mis órdenes
        </Link>
        <h1 className="text-lg font-semibold">Mi vehículo</h1>
        {error && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">{error}</p>}
        <div className="border rounded-xl p-3 bg-white">
          <p className="font-medium">
            {vehiculo.placa} · {vehiculo.marca} {vehiculo.modelo}
          </p>
          <p className="text-sm">Km {vehiculo.kilometraje} · {vehiculo.estado}</p>
          {vehiculo.proximoMantenimientoKm && (
            <p className="text-sm">Próximo mantenimiento: {vehiculo.proximoMantenimientoKm} km</p>
          )}
        </div>
        {(vehiculo.bloqueadoCampo || vehiculo.estado === "FUERA_SERVICIO") && (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2 font-medium">
            El vehículo está FUERA DE SERVICIO y no puede registrar operaciones.
            {vehiculo.alertaNoApto ? ` ${vehiculo.alertaNoApto}` : ""}
          </p>
        )}

        {vehiculo.bloqueadoCampo || vehiculo.estado === "FUERA_SERVICIO" ? (
          <section className="border rounded-xl p-3">
            <p className="text-sm text-slate-600">
              Operaciones/supervisor debe revisar mantenimiento o reparación antes de volver a operativo.
            </p>
          </section>
        ) : (
        <>
        <section className="border rounded-xl p-3 space-y-2">
          <h2 className="font-semibold">Inspección</h2>
          {INSPECCION_ITEMS.map((i) => (
            <label key={i.key} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={items[i.key] !== false}
                onChange={(e) => setItems({ ...items, [i.key]: e.target.checked })}
              />
              {i.label}
            </label>
          ))}
          <input
            type="number"
            className="border rounded px-2 w-full"
            value={combustiblePct}
            onChange={(e) => setCombustiblePct(Number(e.target.value))}
            placeholder="% combustible"
          />
          <button
            className="bg-infinity-600 text-white rounded px-3 py-1"
            onClick={() =>
              post("/api/tecnico/vehiculo/inspeccion", {
                kilometraje: km,
                combustible: combustiblePct,
                items,
              })
            }
          >
            Enviar inspección
          </button>
        </section>

        <section className="border rounded-xl p-3 space-y-2">
          <h2 className="font-semibold">Kilometraje</h2>
          <input type="number" className="border rounded px-2 w-full" value={km} onChange={(e) => setKm(Number(e.target.value))} />
          <button className="bg-infinity-600 text-white rounded px-3 py-1" onClick={() => post("/api/tecnico/vehiculo/kilometraje", { kilometraje: km })}>
            Actualizar kilometraje
          </button>
        </section>

        <section className="border rounded-xl p-3 space-y-2">
          <h2 className="font-semibold">Combustible</h2>
          <input className="border rounded px-2 w-full" placeholder="Estación" value={comb.estacion} onChange={(e) => setComb({ ...comb, estacion: e.target.value })} />
          <input type="number" className="border rounded px-2 w-full" placeholder="Galones" value={comb.galones} onChange={(e) => setComb({ ...comb, galones: Number(e.target.value) })} />
          <input type="number" className="border rounded px-2 w-full" placeholder="Precio por galón" value={comb.precioPorGalon} onChange={(e) => setComb({ ...comb, precioPorGalon: Number(e.target.value) })} />
          <button className="bg-infinity-600 text-white rounded px-3 py-1" onClick={() => post("/api/tecnico/vehiculo/combustible", comb)}>
            Registrar carga
          </button>
        </section>

        <section className="border rounded-xl p-3 space-y-2">
          <h2 className="font-semibold">Reportar novedad</h2>
          <select className="border rounded px-2 w-full" value={nov.tipo} onChange={(e) => setNov({ ...nov, tipo: e.target.value })}>
            <option>MECANICA</option>
            <option>ELECTRICA</option>
            <option>CARROCERIA</option>
            <option>NEUMATICOS</option>
            <option>ACCIDENTE</option>
            <option>ACCESORIOS</option>
            <option>OTRO</option>
          </select>
          <textarea className="border rounded px-2 w-full" value={nov.descripcion} onChange={(e) => setNov({ ...nov, descripcion: e.target.value })} />
          <label className="text-sm flex gap-2">
            <input type="checkbox" checked={nov.puedeCircular} onChange={(e) => setNov({ ...nov, puedeCircular: e.target.checked })} />
            Puede circular
          </label>
          <button className="bg-infinity-600 text-white rounded px-3 py-1" onClick={() => post("/api/tecnico/vehiculo/novedad", nov)}>
            Enviar novedad
          </button>
        </section>
        </>
        )}

        <section className="border rounded-xl p-3">
          <h2 className="font-semibold mb-1">Mantenimiento</h2>
          <ul className="text-sm">
            {mants.map((m) => (
              <li key={m.id}>
                {m.tipo} · ${m.costo} · {m.descripcion}
              </li>
            ))}
            {mants.length === 0 && <li>Sin registros</li>}
          </ul>
        </section>
      </main>
    </div>
  );
}
