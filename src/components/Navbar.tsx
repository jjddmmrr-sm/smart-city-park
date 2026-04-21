import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Map, Car, BarChart3, ShieldAlert, Settings, Activity, Receipt, UserCog, CreditCard, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const NAV = [
  { to: "/overview", label: "Resumen", full: "Resumen General", icon: LayoutDashboard },
  { to: "/", label: "Mapa", full: "Mapa en Vivo", icon: Map },
  { to: "/vehicles", label: "Vehículos", full: "Vehículos", icon: Car },
  { to: "/multas", label: "Multas", full: "Multas", icon: Receipt },
  { to: "/controladores", label: "Controladores", full: "Controladores", icon: UserCog },
  { to: "/analytics", label: "Analítica", full: "Analítica", icon: BarChart3 },
  { to: "/medios-pago", label: "Pagos", full: "Medios de Pago", icon: CreditCard },
  { to: "/enforcement", label: "Cumplimiento", full: "Cumplimiento", icon: ShieldAlert },
  { to: "/settings", label: "Config.", full: "Configuración", icon: Settings },
] as const;

export function Navbar() {
  const { location } = useRouterState();
  const [now, setNow] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/85 border-b border-border">
      <div className="flex items-center h-12 px-3 gap-2 sm:gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded bg-primary text-primary-foreground grid place-items-center">
            <Activity className="h-3.5 w-3.5 text-accent" strokeWidth={2.5} />
          </div>
          <div className="text-[12px] font-semibold tracking-tight text-primary whitespace-nowrap">
            SMART PARK CHONE
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-px ml-2 min-w-0 flex-1">
          {NAV.map((n) => {
            const active =
              n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                title={n.full}
                className={
                  "px-2 h-8 inline-flex items-center gap-1.5 text-[12px] rounded transition-colors whitespace-nowrap " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary")
                }
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden xl:inline">{n.full}</span>
                <span className="xl:hidden">{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="spk-dot bg-success spk-pulse" />
            <span className="hidden xl:inline">Sistema en línea</span>
            <span className="xl:hidden">En línea</span>
          </div>
          <div className="text-right hidden sm:block leading-tight" suppressHydrationWarning>
            <div className="text-[11px] font-medium tabular-nums text-foreground min-w-[60px]">
              {now ? now.toLocaleTimeString("es-EC") : "--:--:--"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {now ? `Chone · ${now.toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}` : "Chone"}
            </div>
          </div>
          <div className="h-7 w-7 rounded-full bg-secondary text-primary grid place-items-center text-[11px] font-medium shrink-0">
            MA
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden h-8 w-8 inline-flex items-center justify-center rounded text-foreground hover:bg-secondary"
            aria-label="Abrir menú"
          >
            {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <nav className="lg:hidden border-t border-border bg-white/95 backdrop-blur-md p-1.5 grid grid-cols-2 sm:grid-cols-3 gap-1">
          {NAV.map((n) => {
            const active =
              n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "px-2 h-9 inline-flex items-center gap-1.5 text-[12px] rounded transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {n.full}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
