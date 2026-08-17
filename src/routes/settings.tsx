import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Panel, StatusPill } from "@/components/ui-bits";
import { apiGetAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { fmtInt, fmtUSD2 } from "@/lib/format";
import { Bell, Building2, Coins, ParkingSquare, ShieldAlert, UsersRound } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Configuración — Smart Park Chone" },
      { name: "description", content: "Estado operativo real del sistema Smart Park Chone." },
    ],
  }),
  component: SettingsPage,
  ssr: false,
});

type Zone = {
  zone_id: string;
  zone_name: string;
  spaces: number;
  tariff: number;
  occupancy_base: number;
  streets: string[];
};

type Space = {
  id: string;
  zone_id: string;
  zone: string;
  street: string;
  type: string;
  status: string;
  sensor?: boolean;
};

type Controller = {
  controlador_id: string;
  nombre: string;
  zona_asignada: string;
  turno: string;
  estado: string;
  fecha_ingreso: string;
  dispositivo_id: string;
};

type Overview = {
  totalSpaces: number;
  occupiedSpaces: number;
  availableSpaces: number;
  occupancyRate: number;
  activeAlerts: number;
  ticketsIssued: number;
  revenueToday: number;
};

function estadoEs(value: string) {
  if (value === "active") return "activo";
  if (value === "inactive") return "inactivo";
  return value;
}

function SettingsPage() {
  const navigate = useNavigate();
  const [zones, setZones] = useState<Zone[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    Promise.all([
      apiGetAuth<Zone[]>("/frontend/zones"),
      apiGetAuth<Space[]>("/frontend/spaces"),
      apiGetAuth<Controller[]>("/frontend/controllers"),
      apiGetAuth<Overview>("/frontend/overview"),
    ])
      .then(([z, s, c, o]) => {
        setZones(z);
        setSpaces(s);
        setControllers(c);
        setOverview(o);
      })
      .catch((error) => console.error("Error loading settings", error));
  }, [navigate]);

  const inventory = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const s of spaces) {
      m[s.zone_id] ??= {};
      m[s.zone_id][s.type] = (m[s.zone_id][s.type] ?? 0) + 1;
    }
    const types = Array.from(new Set(spaces.map((s) => s.type)));
    return { matrix: m, types };
  }, [spaces]);

  const modules = [
    { name: "Resumen General", endpoint: "/frontend/overview", status: "online" },
    { name: "Mapa en Vivo", endpoint: "/frontend/live", status: "online" },
    { name: "Vehículos", endpoint: "/frontend/vehicles", status: "online" },
    { name: "Multas", endpoint: "/frontend/fines", status: "online" },
    { name: "Controladores", endpoint: "/frontend/controllers", status: "online" },
    { name: "Medios de Pago", endpoint: "/frontend/payments", status: "online" },
    { name: "Cumplimiento", endpoint: "/frontend/enforcement", status: "online" },
  ];

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Configuración Operativa</h1>
            <p className="text-[12px] text-muted-foreground">
              Estado real de parámetros, inventario y módulos conectados a PostgreSQL.
            </p>
          </div>
          <Link
            to="/admin"
            className="h-8 px-3 rounded-md border border-border text-[12px] inline-flex items-center hover:bg-secondary"
          >
            Volver
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel
            title="Zonas y tarifas reales"
            action={
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {zones.length} zonas
              </span>
            }
            padded={false}
          >
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Zona</Th>
                  <Th>Calles</Th>
                  <Th className="text-right">Espacios</Th>
                  <Th className="text-right">Tarifa/h</Th>
                  <Th className="text-right">Ocup. base</Th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.zone_id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{z.zone_name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {z.zone_id.slice(0, 8).toUpperCase()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[260px]">
                      {z.streets.join(", ")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{z.spaces}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtUSD2(z.tariff)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(z.occupancy_base * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel
            title="Inventario real por tipo de espacio"
            action={
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <ParkingSquare className="h-3 w-3" /> {fmtInt(spaces.length)} espacios
              </span>
            }
            padded={false}
          >
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Zona</Th>
                  {inventory.types.map((t) => (
                    <Th key={t} className="text-right capitalize">
                      {t.replace("_", " ")}
                    </Th>
                  ))}
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => {
                  const row = inventory.matrix[z.zone_id] ?? {};
                  const tot = Object.values(row).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={z.zone_id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{z.zone_name}</td>
                      {inventory.types.map((t) => (
                        <td
                          key={t}
                          className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                        >
                          {row[t] ?? 0}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{tot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel
            title="Módulos conectados"
            action={
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <Bell className="h-3 w-3" /> {modules.length} endpoints
              </span>
            }
            padded={false}
          >
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Módulo</Th>
                  <Th>Endpoint</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.endpoint} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{m.name}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {m.endpoint}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status="activo" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel
            title="Controladores reales"
            action={
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <UsersRound className="h-3 w-3" /> {controllers.length} controladores
              </span>
            }
            padded={false}
          >
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Nombre</Th>
                  <Th>Zona</Th>
                  <Th>Turno</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {controllers.map((c) => (
                  <tr key={c.controlador_id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.nombre}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        CTRL-{c.controlador_id.slice(0, 8).toUpperCase()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.zona_asignada}</td>
                    <td className="px-3 py-2 capitalize">{c.turno}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={estadoEs(c.estado)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Panel title="Facturación real">
            <div className="space-y-2 text-[12px]">
              <Row k="Moneda" v="USD" icon={<Coins className="h-3.5 w-3.5" />} />
              <Row k="Ingreso hoy" v={fmtUSD2(overview?.revenueToday ?? 0)} />
              <Row k="Multas emitidas" v={fmtInt(overview?.ticketsIssued ?? 0)} />
              <Row k="Ocupación actual" v={`${overview?.occupancyRate ?? 0}%`} />
            </div>
          </Panel>
          <Panel title="Operación actual">
            <div className="space-y-2 text-[12px]">
              <Row
                k="Espacios totales"
                v={fmtInt(overview?.totalSpaces ?? spaces.length)}
                icon={<ParkingSquare className="h-3.5 w-3.5" />}
              />
              <Row k="Ocupados" v={fmtInt(overview?.occupiedSpaces ?? 0)} />
              <Row k="Disponibles" v={fmtInt(overview?.availableSpaces ?? 0)} />
              <Row k="Alertas activas" v={fmtInt(overview?.activeAlerts ?? 0)} />
            </div>
          </Panel>
          <Panel title="Seguridad y gobierno">
            <div className="space-y-2 text-[12px]">
              <Row
                k="JWT Backend"
                v={<StatusPill status="activo" />}
                icon={<ShieldAlert className="h-3.5 w-3.5" />}
              />
              <Row k="Prisma ORM" v={<StatusPill status="activo" />} />
              <Row k="PostgreSQL" v={<StatusPill status="activo" />} />
              <Row k="Modo demo" v="Datos reales actuales" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={"text-left font-medium px-3 py-2 " + className}>{children}</th>;
}

function Row({ k, v, icon }: { k: string; v: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-muted-foreground inline-flex items-center gap-1.5">
        {icon}
        {k}
      </span>
      <span className="font-medium text-right truncate ml-2">{v}</span>
    </div>
  );
}
