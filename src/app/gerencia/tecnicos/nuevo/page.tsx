"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

export default function NuevoTecnicoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    confirmPassword: "",
    telefono: "",
    vehiculo: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setExito("");

    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/tecnicos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        telefono: form.telefono,
        vehiculo: form.vehiculo,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Error al registrar técnico");
      return;
    }

    setExito(
      `Técnico ${data.tecnico.nombre} registrado. Puede ingresar con ${data.tecnico.email}`
    );
    setTimeout(() => router.push("/gerencia/tecnicos"), 2500);
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Nuevo técnico" subtitle="Registrar personal de campo" />

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <Link
          href="/gerencia/tecnicos"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a técnicos
        </Link>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}
        {exito && (
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            {exito}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-4 space-y-4">
          <section className="space-y-3">
            <h2 className="font-semibold">Datos personales</h2>

            <div>
              <label className="text-xs text-slate-500">Nombre completo *</label>
              <input
                type="text"
                required
                placeholder="Ej: Pedro Gómez"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl text-sm mt-0.5"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Teléfono</label>
              <input
                type="tel"
                placeholder="Ej: 0991234567"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl text-sm mt-0.5"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Vehículo / placa</label>
              <input
                type="text"
                placeholder="Ej: Moto-03 / ABC-1234"
                value={form.vehiculo}
                onChange={(e) => setForm({ ...form, vehiculo: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl text-sm mt-0.5"
              />
            </div>
          </section>

          <section className="space-y-3 pt-2 border-t">
            <h2 className="font-semibold">Acceso al sistema</h2>
            <p className="text-xs text-slate-500">
              El técnico usará este email y contraseña para ingresar en{" "}
              <strong>/login</strong> y ver su panel de órdenes.
            </p>

            <div>
              <label className="text-xs text-slate-500">Email *</label>
              <input
                type="email"
                required
                placeholder="pedro@infinity.ec"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl text-sm mt-0.5"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Contraseña *</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl text-sm mt-0.5"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Confirmar contraseña *</label>
              <input
                type="password"
                required
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl text-sm mt-0.5"
              />
            </div>
          </section>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-infinity-600 hover:bg-infinity-700 text-white font-semibold rounded-xl disabled:opacity-50 transition"
          >
            {loading ? "Registrando..." : "Registrar técnico"}
          </button>
        </form>
      </main>
    </div>
  );
}
