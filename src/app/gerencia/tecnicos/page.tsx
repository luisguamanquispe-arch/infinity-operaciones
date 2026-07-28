"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, UserCheck, KeyRound } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ESTADO_TECNICO_LABELS } from "@/lib/utils";

interface Tecnico {
  id: string;
  usuarioId?: string;
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
  const [accionId, setAccionId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");

  function cargar() {
    setLoading(true);
    fetch("/api/tecnicos")
      .then((r) => r.json())
      .then((d) => setTecnicos(d.tecnicos ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function toggleActivo(t: Tecnico) {
    if (!t.usuarioId) return;
    setAccionId(t.id);
    setMensaje("");
    const res = await fetch(`/api/usuarios/${t.usuarioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !t.activo }),
    });
    setAccionId(null);
    if (res.ok) {
      setMensaje(t.activo ? `${t.nombre} desactivado` : `${t.nombre} activado — ya puede ingresar a la app`);
      cargar();
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Técnicos" subtitle="Gestión de personal de campo" />

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/gerencia"
            className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a gerencia
          </Link>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/gerencia/usuarios"
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50"
            >
              <KeyRound className="w-4 h-4" />
              Claves
            </Link>
            <Link
              href="/gerencia/tecnicos/nuevo"
              className="inline-flex items-center gap-2 px-4 py-2 bg-infinity-600 hover:bg-infinity-700 text-white text-sm font-medium rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              Nuevo técnico
            </Link>
          </div>
        </div>

        {mensaje && (
          <div className="bg-emerald-50 text-emerald-800 text-sm p-3 rounded-xl border border-emerald-200">
            {mensaje}
          </div>
        )}

        <p className="text-xs text-slate-500">
          App de campo:{" "}
          <code className="bg-slate-100 px-1 rounded">
            https://infinity-operaciones-b3ij.onrender.com/login?app=tecnico
          </code>
          . El técnico debe estar <strong>Activo</strong> y usar el email registrado aquí.
        </p>

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
                  <th className="text-left p-3">Estado</th>
                  <th className="text-left p-3">Acceso app</th>
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
                      <td className="p-3">
                        <button
                          type="button"
                          disabled={accionId === t.id || !t.usuarioId}
                          onClick={() => void toggleActivo(t)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold disabled:opacity-50 ${
                            t.activo
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-red-100 text-red-800 hover:bg-red-200"
                          }`}
                        >
                          {accionId === t.id ? "…" : t.activo ? "Activo" : "Inactivo — activar"}
                        </button>
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
