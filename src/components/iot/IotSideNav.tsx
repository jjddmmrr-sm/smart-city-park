import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Server,
  Router,
  Layers,
  Camera,
  Link2,
  Settings2,
  Activity,
  Stethoscope,
  ArrowLeft,
} from "lucide-react";

const IOT_NAV = [
  { to: "/admin/iot", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/iot/providers", label: "Providers", icon: Server },
  { to: "/admin/iot/gateways", label: "Gateways", icon: Router },
  { to: "/admin/iot/groups", label: "Groups", icon: Layers },
  { to: "/admin/iot/cameras", label: "Cameras", icon: Camera },
  { to: "/admin/iot/mappings", label: "Mappings", icon: Link2 },
  { to: "/admin/iot/configuration", label: "Configuration", icon: Settings2 },
  { to: "/admin/iot/monitor", label: "Monitor", icon: Activity },
  { to: "/admin/iot/diagnostics", label: "Diagnostics", icon: Stethoscope },
] as const;

/**
 * Lateral navigation for the IoT Device Management module — scoped to
 * /admin/iot/*, composed from the same primitives as the rest of the admin
 * section (no shared layout-route mechanism exists yet in this codebase,
 * so each page renders this alongside its content, same convention as the
 * "Volver" links in the other admin/*.tsx pages).
 */
export function IotSideNav() {
  const { location } = useRouterState();

  return (
    <nav className="w-44 shrink-0 border-r border-border bg-card">
      <div className="px-3 h-9 flex items-center border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary truncate">
          IoT Devices
        </span>
      </div>
      <ul className="p-1.5 space-y-0.5">
        {IOT_NAV.map((item) => {
          const active =
            item.to === "/admin/iot"
              ? location.pathname === "/admin/iot"
              : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={
                  "flex items-center gap-2 h-8 px-2 rounded text-[12px] transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary")
                }
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function IotPageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { location } = useRouterState();
  const isIotRoot = location.pathname === "/admin/iot";
  const backTo = isIotRoot ? "/admin" : "/admin/iot";
  const backLabel = isIotRoot ? "Volver a Administración" : "Volver a IoT Devices";

  return (
    <div className="h-full flex overflow-hidden bg-surface">
      <IotSideNav />
      <div className="flex-1 overflow-auto">
        <div className="px-4 py-4 space-y-4">
          <div>
            <Link
              to={backTo}
              className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </Link>
            <div className="flex items-center justify-between mt-1">
              <div>
                <h1 className="text-[20px] font-semibold text-primary">{title}</h1>
                {description && <p className="text-[12px] text-muted-foreground">{description}</p>}
              </div>
              {actions && <div className="flex gap-2">{actions}</div>}
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
