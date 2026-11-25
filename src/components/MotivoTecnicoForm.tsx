"use client";

import {
  CLIENTE_SITUACIONES,
  MOTIVO_CATEGORIAS,
  MOTIVO_IMPACTOS,
  MOTIVO_PROBLEMAS,
} from "@/lib/motivo-tecnico/catalogo";
import { inputMayusculasClass } from "@/lib/mayusculas";

export type MotivoTecnicoFormState = {
  motivoCategoria: string;
  motivoCategoriaOtro: string;
  motivoProblema: string;
  motivoProblemaOtro: string;
  motivoDetalle: string;
  motivoImpacto: string;
  motivoObservaciones: string;
  clienteSituacion: string;
  clienteRiesgoBajaMotivo: string;
  prioridad: string;
};

type Props = {
  value: MotivoTecnicoFormState;
  onChange: (next: MotivoTecnicoFormState) => void;
  /** Si true, fuerza prioridad ALTA al elegir intención de cancelar. */
  autoPrioridadAltaEnRiesgo?: boolean;
  /** En edición: ocultar situación del cliente (solo se define al crear). */
  mostrarSituacionCliente?: boolean;
};

export function MotivoTecnicoForm({
  value,
  onChange,
  autoPrioridadAltaEnRiesgo = true,
  mostrarSituacionCliente = true,
}: Props) {
  const set = (patch: Partial<MotivoTecnicoFormState>) => {
    const next = { ...value, ...patch };
    if (
      autoPrioridadAltaEnRiesgo &&
      patch.clienteSituacion === "INTENCION_CANCELAR"
    ) {
      next.prioridad = "ALTA";
    }
    onChange(next);
  };

  const riesgo = value.clienteSituacion === "INTENCION_CANCELAR";

  return (
    <div className="space-y-3 border rounded-xl bg-white p-4">
      <h3 className="font-semibold text-sm text-slate-800">Motivo técnico</h3>
      <p className="text-xs text-slate-500">
        Complete categoría, problema, detalle e impacto. Evite textos genéricos
        («internet», «revisar», «no funciona»).
      </p>

      <label className="block text-sm">
        <span className="text-xs text-slate-500">Categoría del soporte *</span>
        <select
          className="border rounded-lg w-full px-2 py-1.5 mt-1"
          value={value.motivoCategoria}
          onChange={(e) => set({ motivoCategoria: e.target.value })}
          required
        >
          <option value="">Seleccione…</option>
          {MOTIVO_CATEGORIAS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      {value.motivoCategoria === "OTRO" && (
        <label className="block text-sm">
          <span className="text-xs text-slate-500">Especifique la categoría *</span>
          <input
            className={`border rounded-lg w-full px-2 py-1.5 mt-1 ${inputMayusculasClass}`}
            value={value.motivoCategoriaOtro}
            onChange={(e) => set({ motivoCategoriaOtro: e.target.value })}
            required
          />
        </label>
      )}

      <label className="block text-sm">
        <span className="text-xs text-slate-500">Problema reportado *</span>
        <select
          className="border rounded-lg w-full px-2 py-1.5 mt-1"
          value={value.motivoProblema}
          onChange={(e) => set({ motivoProblema: e.target.value })}
          required
        >
          <option value="">Seleccione…</option>
          {MOTIVO_PROBLEMAS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      {value.motivoProblema === "OTRO" && (
        <label className="block text-sm">
          <span className="text-xs text-slate-500">Especifique el problema *</span>
          <input
            className={`border rounded-lg w-full px-2 py-1.5 mt-1 ${inputMayusculasClass}`}
            value={value.motivoProblemaOtro}
            onChange={(e) => set({ motivoProblemaOtro: e.target.value })}
            required
          />
        </label>
      )}

      <label className="block text-sm">
        <span className="text-xs text-slate-500">Detalle técnico del problema *</span>
        <textarea
          className={`border rounded-lg w-full px-2 py-1.5 mt-1 min-h-[5rem] ${inputMayusculasClass}`}
          value={value.motivoDetalle}
          onChange={(e) => set({ motivoDetalle: e.target.value })}
          placeholder="Ej.: ONU sin luz PON desde las 08:30; sin navegación en todo el domicilio"
          required
        />
      </label>

      <label className="block text-sm">
        <span className="text-xs text-slate-500">Impacto sobre el servicio *</span>
        <select
          className="border rounded-lg w-full px-2 py-1.5 mt-1"
          value={value.motivoImpacto}
          onChange={(e) => set({ motivoImpacto: e.target.value })}
          required
        >
          <option value="">Seleccione…</option>
          {MOTIVO_IMPACTOS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-xs text-slate-500">Observaciones adicionales</span>
        <textarea
          className={`border rounded-lg w-full px-2 py-1.5 mt-1 min-h-[3rem] ${inputMayusculasClass}`}
          value={value.motivoObservaciones}
          onChange={(e) => set({ motivoObservaciones: e.target.value })}
        />
      </label>

      {mostrarSituacionCliente && (
        <>
          <hr className="border-slate-100" />
          <h3 className="font-semibold text-sm text-slate-800">Situación del cliente</h3>
          <label className="block text-sm">
            <span className="text-xs text-slate-500">Estado declarado por el agente *</span>
            <select
              className="border rounded-lg w-full px-2 py-1.5 mt-1"
              value={value.clienteSituacion}
              onChange={(e) => set({ clienteSituacion: e.target.value })}
              required
            >
              <option value="">Seleccione…</option>
              {CLIENTE_SITUACIONES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {riesgo && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 space-y-2">
              <p className="text-sm font-semibold text-red-900">
                Cliente en riesgo de baja — se forzará prioridad ALTA y se alertará al
                Supervisor.
              </p>
              <label className="block text-sm">
                <span className="text-xs text-red-800">Motivo de la inconformidad *</span>
                <textarea
                  className={`border border-red-200 rounded-lg w-full px-2 py-1.5 mt-1 min-h-[3rem] ${inputMayusculasClass}`}
                  value={value.clienteRiesgoBajaMotivo}
                  onChange={(e) => set({ clienteRiesgoBajaMotivo: e.target.value })}
                  placeholder="Por qué manifiesta intención de cancelar"
                  required
                />
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}
