import type { ReactNode } from "react";

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 py-2 border-b border-border bg-card flex items-center gap-1.5 flex-wrap">
      {children}
    </div>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="uppercase tracking-wider font-medium">{label}</span>
      {children}
    </label>
  );
}

export function FilterSelect({
  value, onChange, options, className = "",
}: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={"h-7 text-[12px] rounded border border-border bg-card px-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0 " + className}
    >
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

export function FilterDate({
  value, onChange, min, max,
}: { value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 text-[12px] rounded border border-border bg-card px-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
    />
  );
}

export function FilterDivider() {
  return <span className="hidden sm:inline-block h-5 w-px bg-border mx-1" />;
}

export function FilterBtn({
  onClick, variant = "ghost", children,
}: { onClick: () => void; variant?: "primary" | "ghost"; children: ReactNode }) {
  const cls =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
      : "bg-card text-foreground hover:bg-secondary border-border";
  return (
    <button
      type="button"
      onClick={onClick}
      className={"h-7 px-2.5 text-[11px] font-medium rounded border inline-flex items-center gap-1 " + cls}
    >
      {children}
    </button>
  );
}
