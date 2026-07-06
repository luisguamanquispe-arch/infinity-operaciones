"use client";

import { inputMayusculasClass } from "@/lib/mayusculas";

export type ClienteFormState = {
  cedula: string;
  nombre: string;
  telefono: string;
  plan: string;
  direccion: string;
  sector: string;
  referencia: string;
  nodo: string;
  lat: string;
  lng: string;
  cajaNap: string;
  puerto: string;
  onuSerial: string;
  potencia: string;
  activo: boolean;
};

export const clienteFormVacio = (): ClienteFormState => ({
  cedula: "",
  nombre: "",
  telefono: "",
  plan: "",
  direccion: "",
  sector: "",
  referencia: "",
  nodo: "",
  lat: "",
  lng: "",
  cajaNap: "",
  puerto: "",
  onuSerial: "",
  potencia: "",
  activo: true,
});

const CAMPOS_MAYUS = new Set(["nombre", "plan", "sector", "nodo", "direccion", "referencia", "cajaNap", "puerto", "onuSerial"]);

export function clienteToForm(c: {
  cedula: string;
  nombre: string;
  telefono: string;
  plan: string;
  direccion: string;
  sector: string;
  referencia: string | null;
  nodo: string | null;
  lat: number | null;
  lng: number | null;
  cajaNap: string | null;
  puerto: string | null;
  onuSerial: string | null;
  potencia: number | null;
  activo: boolean;
}): ClienteFormState {
  return {
    cedula: c.cedula,
    nombre: c.nombre,
    telefono: c.telefono,
    plan: c.plan,
    direccion: c.direccion,
    sector: c.sector,
    referencia: c.referencia || "",
    nodo: c.nodo || "",
    lat: c.lat != null ? String(c.lat) : "",
    lng: c.lng != null ? String(c.lng) : "",
    cajaNap: c.cajaNap || "",
    puerto: c.puerto || "",
    onuSerial: c.onuSerial || "",
    potencia: c.potencia != null ? String(c.potencia) : "",
    activo: c.activo,
  };
}

export function formToPayload(form: ClienteFormState) {
  return {
    cedula: form.cedula,
    nombre: form.nombre,
    telefono: form.telefono,
    plan: form.plan || "Sin plan",
    direccion: form.direccion,
    sector: form.sector,
    referencia: form.referencia || null,
    nodo: form.nodo || null,
    lat: form.lat ? parseFloat(form.lat) : null,
    lng: form.lng ? parseFloat(form.lng) : null,
    cajaNap: form.cajaNap || null,
    puerto: form.puerto || null,
    onuSerial: form.onuSerial || null,
    potencia: form.potencia ? parseFloat(form.potencia) : null,
    activo: form.activo,
  };
}

interface ClienteFormProps {
  form: ClienteFormState;
  onChange: (form: ClienteFormState) => void;
  cedulaError?: string;
}

export function ClienteForm({ form, onChange, cedulaError }: ClienteFormProps) {
  function set<K extends keyof ClienteFormState>(key: K, value: ClienteFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  const fields: { key: keyof ClienteFormState; label: string; required?: boolean; colSpan?: number; type?: string }[] = [
    { key: "cedula", label: "Cédula *", required: true },
    { key: "nombre", label: "Nombre *", required: true },
    { key: "telefono", label: "Teléfono *", required: true },
    { key: "plan", label: "Plan contratado" },
    { key: "sector", label: "Sector *", required: true },
    { key: "nodo", label: "Nodo" },
    { key: "direccion", label: "Dirección *", required: true, colSpan: 2 },
    { key: "cajaNap", label: "Caja NAP" },
    { key: "puerto", label: "Puerto OLT" },
    { key: "onuSerial", label: "Serial ONU" },
    { key: "potencia", label: "Potencia óptica (dBm)", type: "number" },
    { key: "lat", label: "Latitud GPS", type: "number" },
    { key: "lng", label: "Longitud GPS", type: "number" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(({ key, label, required, colSpan, type }) => (
          <div key={key} className={colSpan === 2 ? "sm:col-span-2" : ""}>
            <label className="text-xs text-slate-500">{label}</label>
            <input
              type={type || "text"}
              step={type === "number" ? "any" : undefined}
              required={required}
              value={String(form[key])}
              onChange={(e) =>
                set(
                  key,
                  (key === "activo" ? e.target.checked : e.target.value) as ClienteFormState[typeof key]
                )
              }
              className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${
                CAMPOS_MAYUS.has(key) ? inputMayusculasClass : ""
              }`}
            />
          </div>
        ))}
      </div>

      {cedulaError && <p className="text-sm text-red-600">{cedulaError}</p>}

      <div>
        <label className="text-xs text-slate-500">Referencia</label>
        <textarea
          rows={4}
          value={form.referencia}
          onChange={(e) => set("referencia", e.target.value)}
          placeholder="Puntos de referencia para ubicar al cliente..."
          className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 resize-none ${inputMayusculasClass}`}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.activo}
          onChange={(e) => set("activo", e.target.checked)}
          className="rounded"
        />
        Cliente activo
      </label>
    </div>
  );
}
