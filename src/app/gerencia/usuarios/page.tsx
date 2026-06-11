"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Key, UserCog, CheckCircle, Eye, EyeOff } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  rolLabel: string;
  activo: boolean;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  function cargar() {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then((d) => setUsuarios(d.usuarios))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar();
  }, []);

  function iniciarEdicion(u: Usuario) {
    setEditando(u.id);
    setPassword("");
    setConfirmPassword("");
    setMensaje("");
    setError("");
  }

  async function guardarPassword(id: string) {
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setGuardando(true);
    setError("");
    setMensaje("");

    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    setGuardando(false);

    if (!res.ok) {
      setError(data.error || "Error al guardar");
      return;
    }

    setMensaje(`Contraseña actualizada para ${data.usuario.email}`);
    setEditando(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function toggleActivo(u: Usuario) {
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !u.activo }),
    });

    if (res.ok) cargar();
    else {
      const data = await res.json();
      setError(data.error);
    }
  }

  const rolColor: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    SUPERVISOR: "bg-blue-100 text-blue-800",
    TECNICO: "bg-emerald-100 text-emerald-800",
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Usuarios del sistema" subtitle="Contraseñas y accesos" />

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <Link
          href="/gerencia"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a gerencia
        </Link>

        {mensaje && (
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {mensaje}
          </div>
        )}
        {error && !editando && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
          </div>
        ) : (
          <div className="space-y-3">
            {usuarios.map((u) => (
              <div key={u.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{u.nombre}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rolColor[u.rol]}`}>
                        {u.rolLabel}
                      </span>
                      {!u.activo && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{u.email}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => iniciarEdicion(u)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-infinity-600 border border-infinity-200 rounded-lg hover:bg-infinity-50"
                    >
                      <Key className="w-3.5 h-3.5" />
                      Cambiar clave
                    </button>
                    <button
                      onClick={() => toggleActivo(u)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 border rounded-lg hover:bg-slate-50"
                    >
                      <UserCog className="w-3.5 h-3.5" />
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>

                {editando === u.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <p className="text-sm font-medium">
                      Nueva contraseña para <strong>{u.email}</strong>
                    </p>
                    {error && editando === u.id && (
                      <p className="text-sm text-red-600">{error}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Nueva contraseña"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-2.5 text-slate-400"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirmar contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => guardarPassword(u.id)}
                        disabled={guardando}
                        className="px-4 py-2 bg-infinity-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                      >
                        {guardando ? "Guardando..." : "Guardar contraseña"}
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="px-4 py-2 border text-sm rounded-lg"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">Usuarios de prueba actuales</p>
          <ul className="space-y-0.5 text-xs">
            <li>Admin: admin@infinity.ec</li>
            <li>Supervisor: supervisor@infinity.ec</li>
            <li>Cree técnicos en /gerencia/tecnicos/nuevo</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
