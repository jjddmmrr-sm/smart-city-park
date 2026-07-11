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
import {
  UsersRound,
  MapPinned,
  ParkingSquare,
  BadgeDollarSign,
  ShieldCheck,
  KeyRound,
  Building2,
  SquareParking,
  Coins,
  UserCog,
  CreditCard,
  FileWarning,
} from "lucide-react";

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
          <button
            onClick={logout}
            className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-secondary"
          >
            Salir
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AdminCard
            to="/admin/users"
            title="Usuarios"
            desc="Gestión de accesos administrativos"
            icon={<UsersRound className="h-5 w-5" />}
          />
          <AdminCard
            to="/admin/roles"
            title="Roles"
            desc="Perfiles y accesos del sistema"
            icon={<KeyRound className="h-5 w-5" />}
          />
          <AdminCard
            to="/admin/access-control"
            title="Gobierno de Acceso"
            desc="Permisos y zonas por usuario"
            icon={<ShieldCheck className="h-5 w-5" />}
          />
          <AdminCard
            to="/admin/zones"
            title="Zonas"
            desc="Administración de zonas de parqueo"
            icon={<Building2 className="h-5 w-5" />}
          />
          <AdminCard
            to="/admin/spaces"
            title="Espacios"
            desc="Inventario físico de parqueo"
            icon={<SquareParking className="h-5 w-5" />}
          />
          <AdminCard
            to="/admin/rates"
            title="Tarifas"
            desc="Precios y mínimos de parqueo"
            icon={<Coins className="h-5 w-5" />}
          />
          <AdminCard
            to="/admin/payment-methods"
            title="Medios de Pago"
            desc="Canales de recaudación"
            icon={<CreditCard className="h-5 w-5" />}
          />
          <AdminCard
            to="/admin/fine-types"
            title="Tipos de Multa"
            desc="Catálogo de infracciones"
            icon={<FileWarning className="h-5 w-5" />}
          />
          <AdminCard
            to="/admin/controllers"
            title="Controladores"
            desc="Equipo operativo de campo"
            icon={<UserCog className="h-5 w-5" />}
          />
          <AdminCard
            to="/settings"
            title="Zonas y espacios"
            desc="Inventario operativo real"
            icon={<MapPinned className="h-5 w-5" />}
          />
          <AdminCard
            to="/"
            title="Mapa operativo"
            desc="Monitoreo en vivo"
            icon={<ParkingSquare className="h-5 w-5" />}
          />
        </div>
      </div>
    </div>
  );
}

function AdminCard({
  to,
  title,
  desc,
  icon,
}: {
  to: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <Link to={to} className="block">
      <Panel>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded bg-secondary grid place-items-center text-primary">
            {icon}
          </div>
          <div>
            <div className="font-semibold text-[14px]">{title}</div>
            <div className="text-[12px] text-muted-foreground mt-1">{desc}</div>
          </div>
        </div>
      </Panel>
    </Link>
  );
}
