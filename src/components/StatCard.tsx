import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: "green" | "yellow" | "blue" | "red" | "slate";
}

const colors = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  red: "bg-red-50 text-red-700 border-red-200",
  slate: "bg-slate-50 text-slate-700 border-slate-200",
};

export function StatCard({ label, value, icon: Icon, color = "slate" }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border p-4", colors[color])}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium opacity-80">{label}</p>
        {Icon && <Icon className="w-4 h-4 opacity-60" />}
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
