import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Map, Car, BarChart3, ShieldAlert, Settings, Activity, Receipt, UserCog, CreditCard, Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiGetAuth } from "@/lib/api";
import { getAuthUser, isAuthenticated } from "@/lib/auth";

const NAV = [
  { to: "/overview", label: "Resumen", full: "Resumen General", icon: LayoutDashboard, permission: "VIEW_OVERVIEW" },
  { to: "/", label: "Mapa", full: "Mapa en Vivo", icon: Map, permission: "VIEW_LIVE" },
  { to: "/vehicles", label: "Vehículos", full: "Vehículos", icon: Car, permission: "VIEW_VEHICLES" },
  { to: "/multas", label: "Multas", full: "Multas", icon: Receipt, permission: "VIEW_FINES" },
  { to: "/controladores", label: "Controladores", full: "Controladores", icon: UserCog, permission: "VIEW_CONTROLLERS" },
  { to: "/analytics", label: "Analítica", full: "Analítica", icon: BarChart3, permission: "VIEW_ANALYTICS" },
  { to: "/medios-pago", label: "Pagos", full: "Medios de Pago", icon: CreditCard, permission: "VIEW_PAYMENTS" },
  { to: "/enforcement", label: "Cumplimiento", full: "Cumplimiento", icon: ShieldAlert, permission: "VIEW_ENFORCEMENT" },
  { to: "/admin", label: "Admin", full: "Administración", icon: Settings, permission: "MANAGE_USERS" },
] as const;

export function Navbar() {
  const { location } = useRouterState();
  const [now, setNow] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) return;

    apiGetAuth<{ permissions: string[]; roles: string[] }>("/auth/me")
      .then((me) => {
        setPermissions(me.permissions ?? []);
        setRoles(me.roles ?? []);
      })
      .catch(() => {
        setPermissions([]);
        setRoles([]);
      });
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const visibleNav = useMemo(() => {
    if (roles.includes("SUPER_ADMIN")) return NAV;
    return NAV.filter((n) => permissions.includes(n.permission));
  }, [permissions, roles]);

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
          {visibleNav.map((n) => {
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
          {visibleNav.map((n) => {
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
