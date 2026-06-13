"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, Loader2, CheckCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TIPO_LABELS } from "@/lib/utils";
import { TecnicoMultiSelect } from "@/components/TecnicoMultiSelect";
import {
  mensajeCedulaInvalida,
  normalizarCedula,
  validarCedulaEcuatoriana,
} from "@/lib/cedula-ec";
import { enMayusculas, inputMayusculasClass } from "@/lib/mayusculas";

interface Cliente {
  id: string;
  cedula: string;
  nombre: string;
  telefono: string;
  plan: string;
  direccion: string;
  sector: string;
  nodo: string | null;
  referencia: string | null;
}

interface Tecnico {
  id: string;
  nombre: string;
  estado: string;
}

const TIPOS = ["SOPORTE", "INSTALACION", "RECONEXION", "CORTE", "MIGRACION", "RETIRO"] as const;

const CAMPOS_MAYUS_CLIENTE = new Set(["nombre", "plan", "sector", "nodo", "direccion"]);

export default function NuevoTicketPage() {
  const router = useRouter();
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [cliente, setCliente] = useState({
    cedula: "",
    nombre: "",
    telefono: "",
    plan: "",
    direccion: "",
    sector: "",
    nodo: "",
    referencia: "",
  });

  const [ticket, setTicket] = useState({
    tipo: "SOPORTE",
    prioridad: "MEDIA",
    motivo: "",
    descripcion: "",
    tecnicoIds: [] as string[],
    programadoEn: "",
  });
  const [cedulaError, setCedulaError] = useState("");

  useEffect(() => {
    fetch("/api/tecnicos")
      .then((r) => r.json())
      .then((d) => setTecnicos(d.tecnicos));
  }, []);

  async function buscarClientes(q: string) {
    setBusqueda(q);
    if (q.length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const res = await fetch(`/api/clientes?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResultados(data.clientes);
    setBuscando(false);
  }

  function seleccionarCliente(c: Cliente) {
    setClienteId(c.id);
    setCliente({
      cedula: c.cedula,
      nombre: c.nombre,
      telefono: c.telefono,
      plan: c.plan,
      direccion: c.direccion,
      sector: c.sector,
      nodo: c.nodo || "",
      referencia: c.referencia || "",
    });
    setResultados([]);
    setBusqueda("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setExito("");
    setCedulaError("");

    const cedulaNorm = normalizarCedula(cliente.cedula);
    if (!validarCedulaEcuatoriana(cedulaNorm)) {
      setCedulaError(mensajeCedulaInvalida());
      setLoading(false);
      return;
    }

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId,
        ...cliente,
        cedula: cedulaNorm,
        ...ticket,
        tecnicoIds: ticket.tecnicoIds,
        programadoEn: ticket.programadoEn || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Error al crear ticket");
      return;
    }

    setExito(`Ticket ${data.ticket.codigo} creado y asignado correctamente`);
    setTimeout(() => router.push("/supervisor"), 2000);
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Nuevo ticket" subtitle="Recepción de soporte — Infinity Internet" />

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <Link
          href="/supervisor"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al panel
        </Link>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}
        {exito && (
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {exito}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Buscar cliente */}
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">1. Cliente</h2>

            {!clienteId && (
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por cédula, nombre o teléfono..."
                  value={busqueda}
                  onChange={(e) => buscarClientes(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm"
                />
                {buscando && (
                  <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-slate-400" />
                )}
                {resultados.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {resultados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => seleccionarCliente(c)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm border-b last:border-0"
                      >
                        <span className="font-medium">{c.nombre}</span>
                        <span className="text-slate-500 ml-2">{c.cedula}</span>
                        <span className="text-slate-400 block text-xs">{c.sector}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {clienteId && (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                <span>Cliente existente seleccionado</span>
                <button
                  type="button"
                  onClick={() => {
                    setClienteId(null);
                    setCliente({
                      cedula: "",
                      nombre: "",
                      telefono: "",
                      plan: "",
                      direccion: "",
                      sector: "",
                      nodo: "",
                      referencia: "",
                    });
                  }}
                  className="text-infinity-600 text-xs font-medium"
                >
                  Cambiar
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "cedula", label: "Cédula * (10 dígitos)", required: true },
                { key: "nombre", label: "Nombre *", required: true },
                { key: "telefono", label: "Teléfono *", required: true },
                { key: "plan", label: "Plan contratado", required: false },
                { key: "sector", label: "Sector *", required: true },
                { key: "nodo", label: "Nodo", required: false },
                { key: "direccion", label: "Dirección *", required: true, colSpan: 2 },
              ].map(({ key, label, required, colSpan }) => (
                <div key={key} className={colSpan === 2 ? "col-span-2" : ""}>
                  <label className="text-xs text-slate-500">{label}</label>
                  <input
                    type="text"
                    required={required}
                    value={cliente[key as keyof typeof cliente]}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCliente({
                        ...cliente,
                        [key]: CAMPOS_MAYUS_CLIENTE.has(key) ? enMayusculas(val) : val,
                      });
                    }}
                    className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${
                      CAMPOS_MAYUS_CLIENTE.has(key) ? inputMayusculasClass : ""
                    }`}
                  />
                </div>
              ))}
            </div>
            {cedulaError && (
              <p className="text-sm text-red-600">{cedulaError}</p>
            )}

            <div>
              <label className="text-xs text-slate-500">Referencia *</label>
              <textarea
                required
                rows={5}
                placeholder="Ej: Frente al parque central, casa azul de dos pisos, portón negro..."
                value={cliente.referencia}
                onChange={(e) =>
                  setCliente({ ...cliente, referencia: enMayusculas(e.target.value) })
                }
                className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 resize-none ${inputMayusculasClass}`}
              />
              <p className="text-xs text-slate-400 mt-1">
                Puntos de referencia para que el técnico ubique al cliente fácilmente
              </p>
            </div>
          </section>

          {/* Datos del ticket */}
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">2. Ticket de soporte</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Tipo de trabajo *</label>
                <select
                  value={ticket.tipo}
                  onChange={(e) => setTicket({ ...ticket, tipo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
                  required
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Prioridad *</label>
                <select
                  value={ticket.prioridad}
                  onChange={(e) => setTicket({ ...ticket, prioridad: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
                  required
                >
                  <option value="ALTA">Alta (SLA 4h)</option>
                  <option value="MEDIA">Media (SLA 8h)</option>
                  <option value="BAJA">Baja (SLA 24h)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">Motivo *</label>
              <input
                type="text"
                required
                placeholder="Ej: Sin servicio, luz roja en ONU"
                value={ticket.motivo}
                onChange={(e) => setTicket({ ...ticket, motivo: enMayusculas(e.target.value) })}
                className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Descripción del problema</label>
              <textarea
                rows={3}
                placeholder="Detalle reportado por el cliente..."
                value={ticket.descripcion}
                onChange={(e) =>
                  setTicket({ ...ticket, descripcion: enMayusculas(e.target.value) })
                }
                className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 resize-none ${inputMayusculasClass}`}
              />
            </div>
          </section>

          {/* Asignación */}
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">3. Programar y asignar</h2>

            <div>
              <label className="text-xs text-slate-500">Fecha y hora de visita</label>
              <input
                type="datetime-local"
                value={ticket.programadoEn}
                onChange={(e) =>
                  setTicket({ ...ticket, programadoEn: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
              />
              <p className="text-xs text-slate-400 mt-1">
                Aparecerá en el calendario de soporte
              </p>
            </div>

            <TecnicoMultiSelect
              label="Técnicos asignados (puede seleccionar más de uno)"
              tecnicos={tecnicos}
              selected={ticket.tecnicoIds}
              onChange={(tecnicoIds) => setTicket({ ...ticket, tecnicoIds })}
            />
          </section>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-infinity-600 hover:bg-infinity-700 text-white font-semibold rounded-xl disabled:opacity-50 transition"
          >
            {loading ? "Creando ticket..." : "Crear ticket de soporte"}
          </button>
        </form>
      </main>
    </div>
  );
}
