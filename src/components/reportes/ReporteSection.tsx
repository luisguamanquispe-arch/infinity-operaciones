import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ReporteSectionProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: "default" | "sky" | "amber" | "emerald";
  children: ReactNode;
  className?: string;
}

const ACCENT_STYLES = {
  default: "from-infinity-800 to-infinity-700",
  sky: "from-sky-700 to-sky-600",
  amber: "from-amber-700 to-amber-600",
  emerald: "from-emerald-700 to-emerald-600",
};

export function ReporteSection({
  title,
  subtitle,
  icon: Icon,
  accent = "default",
  children,
  className = "",
}: ReporteSectionProps) {
  return (
    <section
      className={`bg-white rounded-xl border overflow-hidden print:break-inside-avoid ${className}`}
    >
      <div className={`bg-gradient-to-r ${ACCENT_STYLES[accent]} px-4 py-3 text-white`}>
        <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
          {Icon && <Icon className="w-4 h-4 shrink-0" />}
          {title}
        </h3>
        {subtitle && <p className="text-white/80 text-xs mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
