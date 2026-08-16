export function Campo({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-0.5 min-w-0 ${className ?? ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const campoControl =
  "border rounded px-2 py-1.5 w-full text-sm bg-white disabled:bg-slate-100 disabled:text-slate-500";
