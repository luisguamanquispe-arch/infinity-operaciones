"use client";

import { useRouter, usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    const loginUrl = pathname.startsWith("/tecnico") ? "/login?app=tecnico" : "/login";
    router.push(loginUrl);
    router.refresh();
  }

  return (
    <header className="bg-infinity-800 text-white px-4 py-3 sticky top-0 z-50 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo variant="header" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{title}</h1>
            {subtitle && (
              <p className="text-infinity-200 text-sm truncate">{subtitle}</p>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-lg hover:bg-white/10 transition shrink-0"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
