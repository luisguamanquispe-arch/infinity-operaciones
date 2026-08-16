"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";
import { Campo, campoControl } from "@/components/parque/Campo";
import { enMayusculas } from "@/lib/mayusculas";
import {
  ESTADO_VEHICULO_LABELS,
  TIPO_VEHICULO_LABELS,
} from "@/lib/parque-automotor/labels";

type Item = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number;
  estado: string;
  kilometrajeActual: number;
  responsable: { nombre: string } | null;
};

export default function VehiculosListPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    placa: "",
    marca: "",
    modelo: "",
    anio: new Date().getFullYear(),
    tipo: "CAMIONETA",
    kilometrajeInicial: 0,
  });

  async function cargar() {
    const r = await fetch("/api/vehiculos");
    const j = await r.json();
    if (!r.ok) setError(j.error || "Error");
    else setItems(j.items || []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/vehiculos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "No se pudo crear");
      return;
    }
    setForm({ ...form, placa: "", marca: "", modelo: "", kilometrajeInicial: 0 });
    await cargar();
  }

  return (
    <div>
      <AppHeader title="Vehículos" subtitle="Parque automotor" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Vehículos</h1>
        <ParqueSubnav />
        {error && <p className="text-red-700 text-sm">{error}</p>}
        <form onSubmit={crear} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 border rounded-xl p-3 bg-white">
          <Campo label="Placa">
            <input
              className={campoControl}
              value={form.placa}
              onChange={(e) => setForm({ ...form, placa: enMayusculas(e.target.value) })}
              required
            />
          </Campo>
          <Campo label="Marca">
            <input
              className={campoControl}
              value={form.marca}
              onChange={(e) => setForm({ ...form, marca: enMayusculas(e.target.value) })}
              required
            />
          </Campo>
          <Campo label="Modelo">
            <input
              className={campoControl}
              value={form.modelo}
              onChange={(e) => setForm({ ...form, modelo: enMayusculas(e.target.value) })}
              required
            />
          </Campo>
          <Campo label="Año">
            <input
              type="number"
              className={campoControl}
              value={form.anio}
              onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })}
              required
            />
          </Campo>
          <Campo label="Tipo de vehículo">
            <select
              className={campoControl}
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              {Object.entries(TIPO_VEHICULO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Kilometraje inicial">
            <input
              type="number"
              className={campoControl}
              min={0}
              value={form.kilometrajeInicial}
              onChange={(e) => setForm({ ...form, kilometrajeInicial: Number(e.target.value) })}
            />
          </Campo>
          <div className="flex items-end">
            <button className="bg-infinity-600 text-white rounded-lg px-4 py-2 w-full sm:w-auto">
              Crear vehículo
            </button>
          </div>
        </form>
        <table className="w-full text-sm bg-white border rounded-xl overflow-hidden">
          <thead>
            <tr className="text-left bg-slate-50">
              <th className="p-2">Placa</th>
              <th>Marca</th>
              <th>Estado</th>
              <th>Kilometraje</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="p-2">
                  <Link className="text-infinity-700 font-medium" href={`/supervisor/parque-automotor/vehiculos/${v.id}`}>
                    {v.placa}
                  </Link>
                </td>
                <td>
                  {v.marca} {v.modelo}
                </td>
                <td>
                  {ESTADO_VEHICULO_LABELS[v.estado as keyof typeof ESTADO_VEHICULO_LABELS] ??
                    v.estado}
                </td>
                <td>{v.kilometrajeActual}</td>
                <td>{v.responsable?.nombre ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
