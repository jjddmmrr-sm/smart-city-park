import type { ReactNode } from "react";
import { STATUS_LABEL } from "@/lib/format";

export function KpiTile({
  label, value, sub, accent, icon,
}: { label: string; value: ReactNode; sub?: ReactNode; accent?: "primary" | "success" | "warning" | "destructive" | "accent"; icon?: ReactNode }) {
  const accentBar: Record<string, string> = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    accent: "bg-accent",
  };
  return (
    <div className="relative bg-card border border-border rounded-md px-3.5 py-2.5 flex items-center gap-3">
      <span className={"absolute left-0 top-2 bottom-2 w-[3px] rounded-r " + (accentBar[accent ?? "primary"])} />
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        <div className="text-[18px] font-semibold tabular-nums leading-tight text-foreground">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function Panel({
  title, action, children, padded = true, className = "",
}: { title?: ReactNode; action?: ReactNode; children: ReactNode; padded?: boolean; className?: string }) {
  return (
    <section className={"bg-card border border-border rounded-md flex flex-col min-h-0 " + className}>
      {title && (
        <header className="flex items-center justify-between px-3.5 h-10 border-b border-border">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-primary">{title}</h3>
          {action}
        </header>
      )}
      <div className={(padded ? "p-3.5 " : "") + "flex-1 min-h-0"}>{children}</div>
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    available: "bg-success/10 text-success",
    occupied: "bg-destructive/10 text-destructive",
    reserved: "bg-warning/10 text-warning",
    out_of_service: "bg-muted text-muted-foreground",
    paid: "bg-success/10 text-success",
    unpaid: "bg-destructive/10 text-destructive",
    partial: "bg-warning/10 text-warning",
    valid: "bg-success/10 text-success",
    overstay: "bg-warning/10 text-warning",
    no_payment: "bg-destructive/10 text-destructive",
    pending: "bg-warning/10 text-warning",
    reviewing: "bg-info/10 text-info",
    resolved: "bg-success/10 text-success",
    fined: "bg-primary/10 text-primary",
    high: "bg-destructive/10 text-destructive",
    medium: "bg-warning/10 text-warning",
    low: "bg-muted text-muted-foreground",
    pagada: "bg-success/10 text-success",
    apelada: "bg-info/10 text-info",
    notificada: "bg-warning/10 text-warning",
    anulada: "bg-muted text-muted-foreground",
    pendiente: "bg-warning/10 text-warning",
    alta: "bg-destructive/10 text-destructive",
    media: "bg-warning/10 text-warning",
    baja: "bg-muted text-muted-foreground",
    activo: "bg-success/10 text-success",
    vacaciones: "bg-warning/10 text-warning",
    inactivo: "bg-muted text-muted-foreground",
  };
  const dotCls =
    ["available","paid","valid","resolved","pagada","activo"].includes(status) ? "bg-success" :
    ["occupied","unpaid","no_payment","high","alta"].includes(status) ? "bg-destructive" :
    ["reserved","partial","overstay","pending","medium","pendiente","notificada","media","vacaciones"].includes(status) ? "bg-warning" :
    ["reviewing","apelada"].includes(status) ? "bg-info" :
    status === "fined" ? "bg-primary" : "bg-muted-foreground";
  const label = STATUS_LABEL[status] ?? status.replace(/_/g, " ");
  return (
    <span className={"inline-flex items-center gap-1.5 px-2 h-5 rounded text-[11px] font-medium " + (cfg[status] ?? "bg-muted text-muted-foreground")}>
      <span className={"spk-dot " + dotCls} />
      {label}
    </span>
  );
}
