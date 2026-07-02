"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Headphones,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/help-desk", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/help-desk/cola", label: "Cola de atención", icon: MessageSquare },
  { href: "/help-desk/conocimiento", label: "Base de conocimiento", icon: BookOpen },
  { href: "/help-desk/reportes", label: "Reportes", icon: BarChart3 },
];

export function HelpDeskShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("hd-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    fetch("/api/help-desk/agente/presencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conectado: true }),
    }).catch(() => {});

    const ping = setInterval(() => {
      fetch("/api/help-desk/agente/presencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conectado: true }),
      }).catch(() => {});
    }, 60000);

    return () => {
      clearInterval(ping);
      fetch("/api/help-desk/agente/presencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conectado: false }),
      }).catch(() => {});
    };
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("hd-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <aside className="hidden md:flex w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Headphones className="w-6 h-6 text-teal-600" />
            <div>
              <p className="font-bold text-sm">Infinity Remote</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Help Desk N1</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                  active
                    ? "bg-teal-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {dark ? "Claro" : "Oscuro"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950 text-red-600"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-teal-700 text-white">
          <span className="font-semibold text-sm">Infinity Help Desk</span>
          <button type="button" onClick={logout} aria-label="Salir">
            <LogOut className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
