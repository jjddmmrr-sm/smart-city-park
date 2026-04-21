import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Panel, StatusPill } from "@/components/ui-bits";
import { SPACES, ZONES } from "@/lib/data";
import { fmtInt, fmtUSD2 } from "@/lib/format";
import { Bell, Building2, Coins, ParkingSquare, ShieldAlert, UsersRound } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Smart Park Chone" },
      { name: "description", content: "Configure zones, tariffs, parking inventory, alert rules and operators." },
    ],
  }),
  component: SettingsPage,
  ssr: false,
});

const USERS = [
  { name: "Marlon Andrade", role: "Operations Director", email: "m.andrade@chone.gob.ec", status: "active" },
  { name: "Carla Zambrano", role: "Senior Dispatcher", email: "c.zambrano@chone.gob.ec", status: "active" },
  { name: "Diego Velez", role: "Field Inspector", email: "d.velez@chone.gob.ec", status: "active" },
  { name: "Ana Mendoza", role: "Finance Auditor", email: "a.mendoza@chone.gob.ec", status: "active" },
  { name: "Pedro Cevallos", role: "Field Inspector", email: "p.cevallos@chone.gob.ec", status: "inactive" },
];

const RULES = [
  { id: "R-01", name: "Overstay threshold", value: "120 min", scope: "All zones", status: "active" },
  { id: "R-02", name: "No-payment grace period", value: "10 min", scope: "All zones", status: "active" },
  { id: "R-03", name: "High-priority escalation", value: ">200% of tariff owed", scope: "Z1, Z3", status: "active" },
  { id: "R-04", name: "Reserved space holdover", value: "15 min", scope: "Z1", status: "active" },
  { id: "R-05", name: "Sensor offline alert", value: ">30 min no signal", scope: "All zones", status: "active" },
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
          <h1 className="text-[20px] font-semibold text-primary">System Settings</h1>
          <p className="text-[12px] text-muted-foreground">Configure operational parameters of the Smart Park Chone system.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel title="Zones & tariffs" action={<span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {ZONES.length} zones</span>} padded={false}>
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><Th>Zone</Th><Th>Streets</Th><Th className="text-right">Spaces</Th><Th className="text-right">Tariff/h</Th><Th className="text-right">Base occ.</Th></tr>
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

          <Panel title="Parking inventory by type" action={<span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><ParkingSquare className="h-3 w-3" /> {fmtInt(SPACES.length)} spaces</span>} padded={false}>
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Zone</Th>
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
          <Panel title="Alert rules" action={<span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Bell className="h-3 w-3" /> {RULES.length} rules</span>} padded={false}>
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><Th>ID</Th><Th>Rule</Th><Th>Value</Th><Th>Scope</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {RULES.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-[11px]">{r.id}</td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 tabular-nums">{r.value}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.scope}</td>
                    <td className="px-3 py-2"><StatusPill status="resolved" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Operators" action={<span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><UsersRound className="h-3 w-3" /> {USERS.length} users</span>} padded={false}>
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><Th>Name</Th><Th>Role</Th><Th>Email</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {USERS.map((u) => (
                  <tr key={u.email} className="border-t border-border">
                    <td className="px-3 py-2"><div className="font-medium">{u.name}</div></td>
                    <td className="px-3 py-2 text-muted-foreground">{u.role}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-2"><StatusPill status={u.status === "active" ? "resolved" : "low"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Panel title="Billing & finance">
            <div className="space-y-2 text-[12px]">
              <Row k="Currency" v="USD" icon={<Coins className="h-3.5 w-3.5" />} />
              <Row k="Default tariff" v="$0.50 / hour" />
              <Row k="Free grace period" v="10 minutes" />
              <Row k="Disabled spaces" v="No tariff" />
            </div>
          </Panel>
          <Panel title="Notifications">
            <div className="space-y-2 text-[12px]">
              <Row k="Email alerts" v={<StatusPill status="resolved" />} icon={<Bell className="h-3.5 w-3.5" />} />
              <Row k="SMS dispatch" v={<StatusPill status="resolved" />} />
              <Row k="Push (mobile)" v={<StatusPill status="pending" />} />
            </div>
          </Panel>
          <Panel title="Security">
            <div className="space-y-2 text-[12px]">
              <Row k="2FA enforcement" v={<StatusPill status="resolved" />} icon={<ShieldAlert className="h-3.5 w-3.5" />} />
              <Row k="Audit log" v={<StatusPill status="resolved" />} />
              <Row k="Data retention" v="36 months" />
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
