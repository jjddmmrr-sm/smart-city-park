import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Map, Car, BarChart3, ShieldAlert, Settings, Activity } from "lucide-react";
import { useEffect, useState } from "react";

const NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/", label: "Live Map", icon: Map },
  { to: "/vehicles", label: "Vehicles", icon: Car },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/enforcement", label: "Enforcement", icon: ShieldAlert },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Navbar() {
  const { location } = useRouterState();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-border">
      <div className="flex items-center h-14 px-4 gap-6">
        <Link to="/" className="flex items-center gap-2.5 mr-2">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-semibold">
            <Activity className="h-4 w-4 text-accent" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight text-primary">SMART PARK CHONE</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Operations Control Center</div>
          </div>
        </Link>

        <nav className="flex items-center gap-0.5">
          {NAV.map((n) => {
            const active =
              n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "px-3 h-9 inline-flex items-center gap-2 text-[13px] rounded-md transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="spk-dot bg-success spk-pulse" />
            System online
          </div>
          <div className="text-right">
            <div className="text-[12px] font-medium tabular-nums text-foreground">
              {now.toLocaleTimeString("en-GB")}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Chone, EC · {now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}
            </div>
          </div>
          <div className="h-8 w-8 rounded-full bg-secondary text-primary grid place-items-center text-[12px] font-medium">
            MA
          </div>
        </div>
      </div>
    </header>
  );
}
