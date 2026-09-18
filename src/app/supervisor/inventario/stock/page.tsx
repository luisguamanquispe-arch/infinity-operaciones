"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { InventarioSubnav } from "@/components/inventario/InventarioSubnav";

type Row = {
  id: string;
  physicalQty: number;
  reservedQty: number;
  assignedQty: number;
  disponible: number;
  critico: boolean;
  legacyNegativo?: boolean;
  inventario: { nombre: string; unidad: string; stockMin: number; stock?: number };
};

export default function InventarioStockPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [warehouse, setWarehouse] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/inventario/items", { method: "PUT" })
      .then(() => fetch("/api/inventario/stock"))
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else {
          setItems(j.items || []);
          setWarehouse(j.warehouse?.name || "");
        }
      })
      .catch(() => setError("Error al cargar stock"));
  }, []);

  return (
    <div>
      <AppHeader title="Stock" subtitle="Bodegas" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Stock — {warehouse}</h1>
        <InventarioSubnav />
        {error && <p className="text-red-700 text-sm">{error}</p>}
        <table className="w-full text-sm bg-white border rounded-xl">
          <thead>
            <tr className="text-left bg-slate-50">
              <th className="p-2">Material</th>
              <th>Físico</th>
              <th>Reservado</th>
              <th>Asignado</th>
              <th>Disponible</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  {r.inventario.nombre}
                  {r.critico && <span className="ml-2 text-xs text-red-700">crítico</span>}
                  {r.legacyNegativo && (
                    <span className="ml-2 text-xs text-amber-800">legacy negativo</span>
                  )}
                </td>
                <td>
                  {r.physicalQty} {r.inventario.unidad}
                </td>
                <td>{r.reservedQty}</td>
                <td>{r.assignedQty}</td>
                <td className="font-medium">{r.disponible}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
