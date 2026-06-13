"use client";

import { useRef, useEffect, useState } from "react";
import SignaturePad from "signature_pad";
import { fetchWithRetry } from "@/lib/compress-image";
import {
  mensajeCedulaInvalida,
  normalizarCedula,
  validarCedulaEcuatoriana,
} from "@/lib/cedula-ec";
import { enMayusculas, inputMayusculasClass } from "@/lib/mayusculas";

interface SignatureCaptureProps {
  ticketId: string;
  existing?: { imagenUrl: string; imagenSrc?: string; nombreCliente: string; cedula: string } | null;
  clienteNombre: string;
  clienteCedula: string;
  onSaved: () => void;
}

export function SignatureCapture({
  ticketId,
  existing,
  clienteNombre,
  clienteCedula,
  onSaved,
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [nombre, setNombre] = useState(clienteNombre);
  const [cedula, setCedula] = useState(clienteCedula);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canvasRef.current || existing) return;

    const pad = new SignaturePad(canvasRef.current, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(0, 0, 0)",
    });
    padRef.current = pad;

    function resize() {
      if (!canvasRef.current) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvasRef.current.width = canvasRef.current.offsetWidth * ratio;
      canvasRef.current.height = canvasRef.current.offsetHeight * ratio;
      canvasRef.current.getContext("2d")?.scale(ratio, ratio);
      pad.clear();
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [existing]);

  async function guardar() {
    if (!padRef.current || padRef.current.isEmpty()) {
      alert("Por favor firme en el área");
      return;
    }

    const cedulaNorm = normalizarCedula(cedula);
    if (!validarCedulaEcuatoriana(cedulaNorm)) {
      setError(mensajeCedulaInvalida());
      return;
    }

    setLoading(true);
    setError("");
    const imagen = padRef.current.toDataURL("image/png");

    let lat = -1.2491;
    let lng = -78.6168;
    if (navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            resolve();
          },
          () => resolve(),
          { timeout: 8000, maximumAge: 60000 }
        );
      });
    }

    const res = await fetchWithRetry(`/api/tickets/${ticketId}/medicion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firma: { nombreCliente: nombre, cedula: cedulaNorm, imagen, lat, lng },
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo guardar la firma");
      setLoading(false);
      return;
    }

    setLoading(false);
    onSaved();
  }

  if (existing) {
    return (
      <div className="bg-white rounded-xl border p-4 space-y-2">
        <h3 className="font-semibold">Firma registrada</h3>
        <p className="text-sm text-slate-600">
          {existing.nombreCliente} — {existing.cedula}
        </p>
        <img
          src={existing.imagenSrc || existing.imagenUrl}
          alt="Firma"
          className="border rounded-lg max-h-32"
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Firma digital del cliente</h3>

      <div className="grid grid-cols-2 gap-3">
        <input
          value={nombre}
          onChange={(e) => setNombre(enMayusculas(e.target.value))}
          placeholder="Nombre cliente"
          className={`px-3 py-2 border rounded-lg text-sm ${inputMayusculasClass}`}
        />
        <input
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          placeholder="Cédula"
          className="px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-40 border-2 border-dashed border-slate-300 rounded-xl touch-none"
      />

      <div className="flex gap-2">
        <button
          onClick={() => padRef.current?.clear()}
          className="flex-1 py-2 border rounded-lg text-sm"
        >
          Limpiar
        </button>
        <button
          onClick={guardar}
          disabled={loading}
          className="flex-1 py-2 bg-infinity-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar firma"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
