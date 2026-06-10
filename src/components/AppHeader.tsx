"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-infinity-800 text-white px-4 py-4 sticky top-0 z-50 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{title}</h1>
          {subtitle && <p className="text-infinity-200 text-sm">{subtitle}</p>}
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-lg hover:bg-white/10 transition"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
