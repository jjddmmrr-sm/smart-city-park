import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Panel, StatusPill } from "@/components/ui-bits";
import { SPACES, ZONES } from "@/lib/data";
import { fmtInt, fmtUSD2 } from "@/lib/format";
import { Bell, Building2, Coins, ParkingSquare, ShieldAlert, UsersRound } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Configuración — Smart Park Chone" },
      { name: "description", content: "Configurar zonas, tarifas, inventario, reglas de alertas y operadores." },
    ],
  }),
  component: SettingsPage,
  ssr: false,
});

const USERS = [
  { name: "Marlon Andrade", role: "Director de Operaciones", email: "m.andrade@chone.gob.ec", status: "activo" },
  { name: "Carla Zambrano", role: "Despachadora Senior", email: "c.zambrano@chone.gob.ec", status: "activo" },
  { name: "Diego Vélez", role: "Inspector de Campo", email: "d.velez@chone.gob.ec", status: "activo" },
  { name: "Ana Mendoza", role: "Auditora Financiera", email: "a.mendoza@chone.gob.ec", status: "activo" },
  { name: "Pedro Cevallos", role: "Inspector de Campo", email: "p.cevallos@chone.gob.ec", status: "inactivo" },
];

const RULES = [
  { id: "R-01", name: "Umbral de exceso de tiempo", value: "120 min", scope: "Todas las zonas" },
  { id: "R-02", name: "Período de gracia sin pago", value: "10 min", scope: "Todas las zonas" },
  { id: "R-03", name: "Escalamiento de alta prioridad", value: ">200% de tarifa adeudada", scope: "Z1, Z3" },
  { id: "R-04", name: "Retención de espacio reservado", value: "15 min", scope: "Z1" },
  { id: "R-05", name: "Alerta de sensor fuera de línea", value: ">30 min sin señal", scope: "Todas las zonas" },
];

function SettingsPage() {
  const inventory = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const s of SPACES) {
      m[s.zone_id] ??= {};
      m[s.zone_id][s.type] = (m[s.zone_id][s.type] ?? 0) + 1;
    }
    const types = Array.from(new Set(SPACES.map((s) => s.type)));
    return { matrix: m, types };
  }, []);

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div>
          <h1 className="text-[20px] font-semibold text-primary">Configuración del Sistema</h1>
          <p className="text-[12px] text-muted-foreground">Configurar parámetros operativos del sistema Smart Park Chone.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel title="Zonas y tarifas" action={<span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {ZONES.length} zonas</span>} padded={false}>
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><Th>Zona</Th><Th>Calles</Th><Th className="text-right">Espacios</Th><Th className="text-right">Tarifa/h</Th><Th className="text-right">Ocup. base</Th></tr>
              </thead>
              <tbody>
                {ZONES.map((z) => (
                  <tr key={z.zone_id} className="border-t border-border">
                    <td className="px-3 py-2"><div className="font-medium">{z.zone_name}</div><div className="text-[10px] text-muted-foreground">{z.zone_id}</div></td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[260px]">{z.streets.join(", ")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{z.spaces}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtUSD2(z.tariff)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{(z.occupancy_base * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Inventario por tipo de espacio" action={<span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><ParkingSquare className="h-3 w-3" /> {fmtInt(SPACES.length)} espacios</span>} padded={false}>
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Zona</Th>
                  {inventory.types.map((t) => <Th key={t} className="text-right capitalize">{t.replace("_", " ")}</Th>)}
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {ZONES.map((z) => {
                  const row = inventory.matrix[z.zone_id] ?? {};
                  const tot = Object.values(row).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={z.zone_id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{z.zone_name}</td>
                      {inventory.types.map((t) => <td key={t} className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row[t] ?? 0}</td>)}
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{tot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel title="Reglas de alertas" action={<span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Bell className="h-3 w-3" /> {RULES.length} reglas</span>} padded={false}>
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><Th>ID</Th><Th>Regla</Th><Th>Valor</Th><Th>Alcance</Th><Th>Estado</Th></tr>
              </thead>
              <tbody>
                {RULES.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-[11px]">{r.id}</td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 tabular-nums">{r.value}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.scope}</td>
                    <td className="px-3 py-2"><StatusPill status="activo" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Operadores" action={<span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><UsersRound className="h-3 w-3" /> {USERS.length} usuarios</span>} padded={false}>
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><Th>Nombre</Th><Th>Rol</Th><Th>Correo</Th><Th>Estado</Th></tr>
              </thead>
              <tbody>
                {USERS.map((u) => (
                  <tr key={u.email} className="border-t border-border">
                    <td className="px-3 py-2"><div className="font-medium">{u.name}</div></td>
                    <td className="px-3 py-2 text-muted-foreground">{u.role}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-2"><StatusPill status={u.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Panel title="Facturación y finanzas">
            <div className="space-y-2 text-[12px]">
              <Row k="Moneda" v="USD" icon={<Coins className="h-3.5 w-3.5" />} />
              <Row k="Tarifa por defecto" v="$0.50 / hora" />
              <Row k="Período de gracia" v="10 minutos" />
              <Row k="Espacios discapacitados" v="Sin tarifa" />
            </div>
          </Panel>
          <Panel title="Notificaciones">
            <div className="space-y-2 text-[12px]">
              <Row k="Alertas por correo" v={<StatusPill status="activo" />} icon={<Bell className="h-3.5 w-3.5" />} />
              <Row k="Despacho por SMS" v={<StatusPill status="activo" />} />
              <Row k="Push (móvil)" v={<StatusPill status="pendiente" />} />
            </div>
          </Panel>
          <Panel title="Seguridad">
            <div className="space-y-2 text-[12px]">
              <Row k="Doble factor (2FA)" v={<StatusPill status="activo" />} icon={<ShieldAlert className="h-3.5 w-3.5" />} />
              <Row k="Registro de auditoría" v={<StatusPill status="activo" />} />
              <Row k="Retención de datos" v="36 meses" />
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
      <span className="text-muted-foreground inline-flex items-center gap-1.5">{icon}{k}</span>
      <span className="font-medium text-right truncate ml-2">{v}</span>
    </div>
  );
}
