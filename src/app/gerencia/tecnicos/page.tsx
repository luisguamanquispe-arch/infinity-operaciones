"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, UserCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ESTADO_TECNICO_LABELS } from "@/lib/utils";

interface Tecnico {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  vehiculo: string | null;
  estado: string;
  activo: boolean;
}

export default function TecnicosListPage() {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tecnicos")
      .then((r) => r.json())
      .then((d) => setTecnicos(d.tecnicos))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Técnicos" subtitle="Gestión de personal de campo" />

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/gerencia"
            className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a gerencia
          </Link>
          <Link
            href="/gerencia/tecnicos/nuevo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-infinity-600 hover:bg-infinity-700 text-white text-sm font-medium rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            Nuevo técnico
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3">Nombre</th>
                  <th className="text-left p-3 hidden sm:table-cell">Email</th>
                  <th className="text-left p-3 hidden md:table-cell">Teléfono</th>
                  <th className="text-left p-3 hidden md:table-cell">Vehículo</th>
                  <th className="text-left p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tecnicos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No hay técnicos registrados
                    </td>
                  </tr>
                ) : (
                  tecnicos.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-infinity-600 shrink-0" />
                          <span className="font-medium">{t.nombre}</span>
                        </div>
                        <span className="text-xs text-slate-400 sm:hidden">{t.email}</span>
                      </td>
                      <td className="p-3 hidden sm:table-cell text-slate-600">{t.email}</td>
                      <td className="p-3 hidden md:table-cell">{t.telefono || "—"}</td>
                      <td className="p-3 hidden md:table-cell">{t.vehiculo || "—"}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            t.estado === "TRABAJANDO"
                              ? "bg-blue-100 text-blue-800"
                              : t.estado === "DISPONIBLE"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {ESTADO_TECNICO_LABELS[t.estado]}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
