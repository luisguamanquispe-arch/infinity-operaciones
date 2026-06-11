"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { CalendarioSoporte } from "@/components/calendario/CalendarioSoporte";

export default function CalendarioPage() {
  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader
        title="Calendario de soporte"
        subtitle="Programación según disponibilidad de técnicos"
      />

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <Link
          href="/supervisor"
          className="text-sm text-infinity-600 hover:underline"
        >
          ← Volver al panel supervisor
        </Link>

        <CalendarioSoporte />
      </main>
    </div>
  );
}
