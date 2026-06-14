import { createFileRoute, Link } from "@tanstack/react-router";
import { getAuthUser, isAuthenticated, logout } from "@/lib/auth";

function requireAdmin() {
  if (typeof window !== "undefined" && !isAuthenticated()) {
    window.location.href = "/admin/login";
    return false;
  }
  return true;
}
import { Panel } from "@/components/ui-bits";
import { UsersRound, MapPinned, ParkingSquare, BadgeDollarSign, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHomePage,
  ssr: false,
});

function AdminHomePage() {
  const user = getAuthUser();

  if (!requireAdmin()) return null;

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Administración del Sistema</h1>
            <p className="text-[12px] text-muted-foreground">
              Sesión: {user?.name ?? "Administrador"} · {user?.roles?.join(", ")}
            </p>
          </div>
          <button onClick={logout} className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-secondary">
            Salir
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AdminCard to="/admin/users" title="Usuarios" desc="Gestión de accesos administrativos" icon={<UsersRound className="h-5 w-5" />} />
          <AdminCard to="/settings" title="Zonas y espacios" desc="Inventario operativo real" icon={<MapPinned className="h-5 w-5" />} />
          <AdminCard to="/controladores" title="Controladores" desc="Equipo operativo de campo" icon={<ShieldCheck className="h-5 w-5" />} />
          <AdminCard to="/medios-pago" title="Medios de pago" desc="Canales activos de recaudación" icon={<BadgeDollarSign className="h-5 w-5" />} />
          <AdminCard to="/" title="Mapa operativo" desc="Monitoreo en vivo" icon={<ParkingSquare className="h-5 w-5" />} />
        </div>
      </div>
    </div>
  );
}

function AdminCard({ to, title, desc, icon }: { to: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <Link to={to} className="block">
      <Panel>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded bg-secondary grid place-items-center text-primary">{icon}</div>
          <div>
            <div className="font-semibold text-[14px]">{title}</div>
            <div className="text-[12px] text-muted-foreground mt-1">{desc}</div>
          </div>
        </div>
      </Panel>
    </Link>
  );
}
