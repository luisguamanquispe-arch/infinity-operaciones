"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";
import { enMayusculas } from "@/lib/mayusculas";

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
        <form onSubmit={crear} className="grid sm:grid-cols-6 gap-2 border rounded-xl p-3 bg-white">
          <input
            className="border rounded px-2 py-1"
            placeholder="Placa"
            value={form.placa}
            onChange={(e) => setForm({ ...form, placa: enMayusculas(e.target.value) })}
            required
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Marca"
            value={form.marca}
            onChange={(e) => setForm({ ...form, marca: enMayusculas(e.target.value) })}
            required
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Modelo"
            value={form.modelo}
            onChange={(e) => setForm({ ...form, modelo: enMayusculas(e.target.value) })}
            required
          />
          <input
            type="number"
            className="border rounded px-2 py-1"
            value={form.anio}
            onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })}
          />
          <input
            type="number"
            className="border rounded px-2 py-1"
            placeholder="Km inicial"
            value={form.kilometrajeInicial}
            onChange={(e) => setForm({ ...form, kilometrajeInicial: Number(e.target.value) })}
          />
          <button className="bg-infinity-600 text-white rounded-lg px-3">Crear</button>
        </form>
        <table className="w-full text-sm bg-white border rounded-xl overflow-hidden">
          <thead>
            <tr className="text-left bg-slate-50">
              <th className="p-2">Placa</th>
              <th>Marca</th>
              <th>Estado</th>
              <th>Km</th>
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
                <td>{v.estado}</td>
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
