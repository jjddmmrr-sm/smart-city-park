import { lazy, Suspense, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSim, useLiveStats } from "@/lib/sim";
import { ZONES, type LiveSpace } from "@/lib/data";
import { fmtInt, fmtPct, STATUS_LABEL } from "@/lib/format";
import { KpiTile, Panel, StatusPill } from "@/components/ui-bits";
import {
  Activity, AlertTriangle, Car, DollarSign, Filter, Flame, Layers, MapPin, Radio, Search,
} from "lucide-react";

const LiveMap = lazy(() => import("@/components/LiveMap").then((m) => ({ default: m.LiveMap })));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Map — Smart Park Chone" },
      { name: "description", content: "Real-time parking occupancy map for the city of Chone." },
    ],
  }),
  component: LiveMapPage,
  ssr: false,
});

function LiveMapPage() {
  const { feed } = useSim();
  const stats = useLiveStats();
  const [zone, setZone] = useState("all");
  const [status, setStatus] = useState("all");
  const [heat, setHeat] = useState(false);
  const [selected, setSelected] = useState<LiveSpace | null>(null);

  const todayRevenue = 4820 + Math.round((stats.occupied % 50) * 13);
  const vehiclesToday = 6310 + (stats.occupied % 20);

  return (
    <div className="h-full flex flex-col">
      {/* Top KPI strip */}
      <div className="border-b border-border bg-card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-border">
          <KpiBare label="Occupancy" value={fmtPct(stats.occupancy, 1)} sub={`${stats.occupied}/${stats.total - stats.oos} spaces`} icon={<Activity className="h-4 w-4 text-accent" />} />
          <KpiBare label="Available" value={fmtInt(stats.available)} sub="ready to use" icon={<MapPin className="h-4 w-4 text-success" />} />
          <KpiBare label="Occupied" value={fmtInt(stats.occupied)} sub="active vehicles" icon={<Car className="h-4 w-4 text-destructive" />} />
          <KpiBare label="Vehicles today" value={fmtInt(vehiclesToday)} sub="entries since 06:00" icon={<Radio className="h-4 w-4 text-primary" />} />
          <KpiBare label="Revenue today" value={`$${fmtInt(todayRevenue)}`} sub="all zones" icon={<DollarSign className="h-4 w-4 text-success" />} />
          <KpiBare label="Active alerts" value={fmtInt(feed.filter((f) => f.status === "pending").length)} sub="awaiting action" icon={<AlertTriangle className="h-4 w-4 text-warning" />} />
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 p-3 bg-surface">
        {/* MAP */}
        <div className="relative rounded-md overflow-hidden border border-border bg-card min-h-[400px]">
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading map…</div>}>
            <LiveMap
              filter={{ zone, status }}
              heat={heat}
              selectedId={selected?.id ?? null}
              onSelect={(s) => setSelected(s)}
            />
          </Suspense>

          {/* Floating filter card */}
          <div className="absolute top-3 left-3 z-[400] bg-card/95 backdrop-blur border border-border rounded-md shadow-sm p-2.5 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={zone} onChange={setZone} options={[{ v: "all", l: "All zones" }, ...ZONES.map((z) => ({ v: z.zone_id, l: z.zone_name }))]} />
            <Select value={status} onChange={setStatus} options={[
              { v: "all", l: "All statuses" },
              { v: "available", l: "Available" },
              { v: "occupied", l: "Occupied" },
              { v: "reserved", l: "Reserved" },
              { v: "out_of_service", l: "Out of service" },
            ]} />
            <button
              onClick={() => setHeat((h) => !h)}
              className={"inline-flex items-center gap-1.5 px-2.5 h-8 text-[12px] rounded-md border " + (heat ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-secondary")}
            >
              <Flame className="h-3.5 w-3.5" /> Heatmap
            </button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-[400] bg-card/95 backdrop-blur border border-border rounded-md shadow-sm px-3 py-2 flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5"><span className="spk-dot bg-success" />Available</div>
            <div className="flex items-center gap-1.5"><span className="spk-dot bg-destructive" />Occupied</div>
            <div className="flex items-center gap-1.5"><span className="spk-dot bg-warning" />Reserved</div>
            <div className="flex items-center gap-1.5"><span className="spk-dot bg-muted-foreground" />Out of service</div>
          </div>

          <div className="absolute top-3 right-3 z-[400] bg-card/95 backdrop-blur border border-border rounded-md shadow-sm px-2.5 py-1.5 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> {ZONES.length} zones · 500 spaces
          </div>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-3 min-h-0">
          <Panel title={selected ? "Space detail" : "Select a space"} padded>
            {selected ? <SpaceDetail s={selected} /> : (
              <div className="text-[12px] text-muted-foreground">
                Click any marker on the map to inspect occupancy, vehicle and compliance details.
              </div>
            )}
          </Panel>

          <Panel title="Live alerts feed" className="flex-1" padded={false}>
            <ul className="divide-y divide-border overflow-auto h-full">
              {feed.slice(0, 40).map((c) => (
                <li key={c.id} className="px-3 py-2 hover:bg-surface-2 flex items-start gap-2">
                  <span className={"spk-dot mt-1.5 " + (c.priority === "high" ? "bg-destructive spk-pulse" : c.priority === "medium" ? "bg-warning" : "bg-muted-foreground")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium truncate">{c.plate}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{c.detected}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {c.zone} · {c.street} · {c.issue.replace("_", " ")}
                    </div>
                  </div>
                  <StatusPill status={c.status} />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function KpiBare({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-2.5 flex items-center gap-3">
      <div className="h-8 w-8 rounded bg-secondary grid place-items-center">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-[16px] font-semibold tabular-nums leading-tight">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
      </div>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 text-[12px] rounded-md border border-border bg-card px-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function SpaceDetail({ s }: { s: LiveSpace }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-semibold tabular-nums">{s.id}</div>
        <StatusPill status={s.status} />
      </div>
      <Row k="Zone" v={`${s.zone_id} · ${s.zone}`} />
      <Row k="Street" v={s.street} />
      <Row k="Type" v={s.type.replace("_", " ")} />
      <Row k="Sensor" v={s.sensor ? "Enabled" : "Manual"} />
      {s.status === "occupied" && (
        <>
          <div className="my-2 border-t border-border" />
          <Row k="Vehicle plate" v={<span className="font-mono">{s.plate || "—"}</span>} />
          <Row k="Occupied since" v={s.since || "—"} />
          <Row k="Compliance" v={<StatusPill status="valid" />} />
        </>
      )}
      <div className="pt-2 flex gap-2">
        <button className="flex-1 h-8 text-[12px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-1.5">
          <Search className="h-3.5 w-3.5" /> Inspect
        </button>
        <button className="flex-1 h-8 text-[12px] rounded-md border border-border hover:bg-secondary">
          Reserve
        </button>
      </div>
      <div className="text-[10px] text-muted-foreground pt-1">
        Status: {STATUS_LABEL[s.status]}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-foreground text-right truncate ml-2">{v}</span>
    </div>
  );
}
