"use client";

import type { TipoConexionInstalacion } from "@prisma/client";
import { CLAUSULAS_POLITICA_INSTALACION } from "@/lib/ticket-instalacion";

export interface InstalacionFormState {
  tipoConexion: TipoConexionInstalacion | "";
  direccionIp: string;
  pppoeUsuario: string;
  pppoeClave: string;
  nombreRedWifi: string;
  claveRedWifi: string;
}

export function instalacionFormVacio(): InstalacionFormState {
  return {
    tipoConexion: "",
    direccionIp: "",
    pppoeUsuario: "",
    pppoeClave: "",
    nombreRedWifi: "",
    claveRedWifi: "",
  };
}

interface Props {
  instalacion: InstalacionFormState;
  onChange: (next: InstalacionFormState) => void;
  onSave: () => void;
  error?: string;
  readOnly?: boolean;
  showClausulas?: boolean;
}

export function InstalacionOrdenSection({
  instalacion,
  onChange,
  onSave,
  error,
  readOnly = false,
  showClausulas = true,
}: Props) {
  if (readOnly) {
    if (!instalacion.tipoConexion) return null;
    return (
      <section className="bg-white rounded-xl border border-sky-200 p-4 space-y-2">
        <h3 className="font-semibold text-sky-900">Datos de instalación registrados</h3>
        <p className="text-sm">
          Conexión:{" "}
          {instalacion.tipoConexion === "IP"
            ? `IP ${instalacion.direccionIp}`
            : `PPPoE — usuario ${instalacion.pppoeUsuario}`}
        </p>
        {instalacion.tipoConexion === "PPPOE" && (
          <p className="text-sm font-mono">Clave PPPoE: {instalacion.pppoeClave}</p>
        )}
        <p className="text-sm">Red WiFi: {instalacion.nombreRedWifi}</p>
        <p className="text-sm font-mono">Clave WiFi: {instalacion.claveRedWifi}</p>
      </section>
    );
  }

  return (
    <>
      <section className="bg-sky-50 border border-sky-300 rounded-xl p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sky-900 text-lg">Nueva instalación — datos del cliente</h3>
          <p className="text-sm text-sky-800 mt-1">
            Obligatorio para cerrar el ticket. Registre IP o PPPoE y la red WiFi entregada.
          </p>
        </div>

        <div>
          <label className="text-xs text-slate-600 font-medium">Tipo de conexión *</label>
          <select
            value={instalacion.tipoConexion}
            onChange={(e) =>
              onChange({
                ...instalacion,
                tipoConexion: e.target.value as TipoConexionInstalacion | "",
                direccionIp: "",
                pppoeUsuario: "",
                pppoeClave: "",
              })
            }
            className="w-full px-3 py-2.5 border border-sky-200 rounded-lg text-sm mt-1 bg-white"
          >
            <option value="">Seleccionar IP o PPPoE…</option>
            <option value="IP">Dirección IP fija</option>
            <option value="PPPOE">PPPoE (usuario y clave)</option>
          </select>
        </div>

        {instalacion.tipoConexion === "IP" && (
          <div>
            <label className="text-xs text-slate-600 font-medium">Dirección IP *</label>
            <input
              type="text"
              value={instalacion.direccionIp}
              onChange={(e) => onChange({ ...instalacion, direccionIp: e.target.value })}
              placeholder="Ej: 192.168.10.45"
              className="w-full px-3 py-2.5 border rounded-lg text-sm mt-1 font-mono bg-white"
            />
          </div>
        )}

        {instalacion.tipoConexion === "PPPOE" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600 font-medium">Usuario PPPoE *</label>
              <input
                type="text"
                value={instalacion.pppoeUsuario}
                onChange={(e) => onChange({ ...instalacion, pppoeUsuario: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm mt-1 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 font-medium">Clave PPPoE *</label>
              <input
                type="text"
                value={instalacion.pppoeClave}
                onChange={(e) => onChange({ ...instalacion, pppoeClave: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm mt-1 font-mono bg-white"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-600 font-medium">Nombre de red WiFi *</label>
            <input
              type="text"
              value={instalacion.nombreRedWifi}
              onChange={(e) => onChange({ ...instalacion, nombreRedWifi: e.target.value })}
              placeholder="SSID entregado al cliente"
              className="w-full px-3 py-2.5 border rounded-lg text-sm mt-1 bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 font-medium">Clave WiFi *</label>
            <input
              type="text"
              value={instalacion.claveRedWifi}
              onChange={(e) => onChange({ ...instalacion, claveRedWifi: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-lg text-sm mt-1 font-mono bg-white"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onSave}
          className="w-full py-2.5 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700"
        >
          Guardar datos de instalación
        </button>
      </section>

      {showClausulas && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-900 text-sm">Políticas del servicio (instalación)</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-950">
            {CLAUSULAS_POLITICA_INSTALACION.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="text-amber-600 shrink-0">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
