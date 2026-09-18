"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { InventarioSubnav } from "@/components/inventario/InventarioSubnav";

type Item = {
  id: string;
  nombre: string;
  unidad: string;
  tipo: string;
  stock: number;
  stockMin: number;
  unitCost: number;
  isSerialized: boolean;
  isActive: boolean;
  code: string | null;
};

export default function InventarioMaterialesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    unidad: "unidad",
    tipo: "CONSUMIBLE",
    stock: 0,
    stockMin: 5,
    unitCost: 0,
  });

  async function cargar() {
    const r = await fetch("/api/inventario/items");
    const j = await r.json();
    if (!r.ok) setError(j.error || "Error");
    else setItems(j.items || []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/inventario/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "No se pudo crear");
      return;
    }
    setForm({ ...form, nombre: "", stock: 0 });
    await cargar();
  }

  return (
    <div>
      <AppHeader title="Materiales" subtitle="Catálogo de inventario" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Materiales</h1>
        <InventarioSubnav />
        {error && <p className="text-red-700 text-sm">{error}</p>}
        <form onSubmit={crear} className="grid sm:grid-cols-3 gap-2 border rounded-xl p-3 bg-white">
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Unidad"
            value={form.unidad}
            onChange={(e) => setForm({ ...form, unidad: e.target.value })}
          />
          <input
            type="number"
            className="border rounded px-2 py-1.5"
            placeholder="Stock inicial"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
          />
          <input
            type="number"
            step="0.01"
            className="border rounded px-2 py-1.5"
            placeholder="Costo unitario"
            value={form.unitCost}
            onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
          />
          <button className="bg-infinity-600 text-white rounded px-3 py-2">Agregar material</button>
        </form>
        <table className="w-full text-sm bg-white border rounded-xl">
          <thead>
            <tr className="text-left bg-slate-50">
              <th className="p-2">Nombre</th>
              <th>Unidad</th>
              <th>Tipo</th>
              <th>Stock</th>
              <th>Mín.</th>
              <th>Costo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-2">{i.nombre}</td>
                <td>{i.unidad}</td>
                <td>{i.tipo}</td>
                <td className={i.stock <= i.stockMin ? "text-red-700 font-medium" : ""}>{i.stock}</td>
                <td>{i.stockMin}</td>
                <td>${i.unitCost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
