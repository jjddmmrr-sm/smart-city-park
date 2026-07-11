import { lazy, Suspense, useEffect, useState } from "react";
import { RequirePermission } from "@/components/RequirePermission";
import { createFileRoute } from "@tanstack/react-router";
import { useSim, useLiveStats } from "@/lib/sim";
import { ZONES, type LiveSpace } from "@/lib/data";
import { fmtInt, fmtPct, fmtUSD, STATUS_LABEL, ISSUE_LABEL } from "@/lib/format";
import { Panel, StatusPill } from "@/components/ui-bits";
import { apiGet } from "@/lib/api";
import {
  Activity,
  AlertTriangle,
  Car,
  DollarSign,
  Filter,
  Flame,
  Layers,
  MapPin,
  Radio,
  Search,
} from "lucide-react";

const LiveMap = lazy(() => import("@/components/LiveMap").then((m) => ({ default: m.LiveMap })));

type OverviewApi = {
  totalSpaces: number;
  occupiedSpaces: number;
  availableSpaces: number;
  occupancyRate: number;
  vehiclesToday: number;
  revenueToday: number;
  activeSessions: number;
  completedSessions: number;
  activeAlerts: number;
  overstayCases: number;
  unpaidCases: number;
  ticketsIssued: number;
  ticketsAmount: number;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mapa en Vivo — Smart Park Chone" },
      {
        name: "description",
        content: "Mapa de ocupación de parqueo en tiempo real de la ciudad de Chone.",
      },
    ],
  }),
  component: LiveMapPageProtected,
  ssr: false,
});

function LiveMapPage() {
  const { feed } = useSim();
  const stats = useLiveStats();
  const [zone, setZone] = useState("all");
  const [status, setStatus] = useState("all");
  const [heat, setHeat] = useState(false);
  const [selected, setSelected] = useState<LiveSpace | null>(null);
  const [liveData, setLiveData] = useState<LiveSpace[] | null>(null);
  const [overview, setOverview] = useState<OverviewApi | null>(null);

  useEffect(() => {
    Promise.all([apiGet<LiveSpace[]>("/frontend/live"), apiGet<OverviewApi>("/frontend/overview")])
      .then(([live, overviewData]) => {
        setLiveData(live);
        setOverview(overviewData);
      })
      .catch((error) => console.error("Error loading live map", error));
  }, []);

  const currentLive = (liveData ?? stats.total) ? (liveData ?? []) : [];
  const realTotal = liveData ? currentLive.length : stats.total;
  const realOccupied = liveData
    ? currentLive.filter((s) => s.status === "occupied").length
    : stats.occupied;
  const realAvailable = liveData
    ? currentLive.filter((s) => s.status === "available").length
    : stats.available;
  const realOccupancy = realTotal > 0 ? (realOccupied / realTotal) * 100 : stats.occupancy;

  const todayRevenue = overview?.revenueToday ?? 0;
  const vehiclesToday = overview?.vehiclesToday ?? 0;
  const activeAlerts = overview?.activeAlerts ?? feed.filter((f) => f.status === "pending").length;

  return (
    <div className="h-full flex flex-col">
      {/* Top KPI strip */}
      <div className="border-b border-border bg-card">
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-px bg-border">
          <KpiBare
            label="Ocupación"
            value={fmtPct(realOccupancy, 1)}
            sub={`${realOccupied}/${realTotal}`}
            icon={<Activity className="h-4 w-4 text-accent" />}
          />
          <KpiBare
            label="Disponibles"
            value={fmtInt(realAvailable)}
            sub="listos"
            icon={<MapPin className="h-4 w-4 text-success" />}
          />
          <KpiBare
            label="Ocupados"
            value={fmtInt(realOccupied)}
            sub="activos"
            icon={<Car className="h-4 w-4 text-destructive" />}
          />
          <KpiBare
            label="Vehículos hoy"
            value={fmtInt(vehiclesToday)}
            sub="desde 06:00"
            icon={<Radio className="h-4 w-4 text-primary" />}
          />
          <KpiBare
            label="Ingresos hoy"
            value={fmtUSD(todayRevenue)}
            sub="todas las zonas"
            icon={<DollarSign className="h-4 w-4 text-success" />}
          />
          <KpiBare
            label="Alertas"
            value={fmtInt(activeAlerts)}
            sub="pendientes"
            icon={<AlertTriangle className="h-4 w-4 text-warning" />}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-2 p-2 bg-surface">
        {/* MAP */}
        <div className="relative rounded overflow-hidden border border-border bg-card min-h-[320px] lg:min-h-0">
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                Cargando mapa…
              </div>
            }
          >
            <LiveMap
              filter={{ zone, status }}
              heat={heat}
              selectedId={selected?.id ?? null}
              onSelect={(s) => setSelected(s)}
              liveData={liveData ?? undefined}
            />
          </Suspense>

          {/* Floating filter card */}
          <div className="absolute top-2 left-2 right-2 sm:right-auto z-[400] bg-card/95 backdrop-blur border border-border rounded shadow-sm p-1.5 flex items-center gap-1.5 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select
              value={zone}
              onChange={setZone}
              options={[
                { v: "all", l: "Todas las zonas" },
                ...ZONES.map((z) => ({ v: z.zone_id, l: z.zone_name })),
              ]}
            />
            <Select
              value={status}
              onChange={setStatus}
              options={[
                { v: "all", l: "Todos los estados" },
                { v: "available", l: "Disponible" },
                { v: "occupied", l: "Ocupado" },
                { v: "reserved", l: "Reservado" },
                { v: "out_of_service", l: "Fuera de servicio" },
              ]}
            />
            <button
              onClick={() => setHeat((h) => !h)}
              className={
                "inline-flex items-center gap-1 px-2 h-7 text-[11px] rounded border " +
                (heat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-secondary")
              }
            >
              <Flame className="h-3 w-3" /> Calor
            </button>
          </div>

          {/* Legend */}
          <div className="hidden sm:flex absolute bottom-2 left-2 z-[400] bg-card/95 backdrop-blur border border-border rounded shadow-sm px-2.5 py-1.5 items-center gap-2.5 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="spk-dot bg-success" />
              Disponible
            </div>
            <div className="flex items-center gap-1">
              <span className="spk-dot bg-destructive" />
              Ocupado
            </div>
            <div className="flex items-center gap-1">
              <span className="spk-dot bg-warning" />
              Reservado
            </div>
            <div className="flex items-center gap-1">
              <span className="spk-dot bg-muted-foreground" />
              Fuera serv.
            </div>
          </div>

          <div className="hidden md:inline-flex absolute bottom-2 right-2 z-[400] bg-card/95 backdrop-blur border border-border rounded shadow-sm px-2 py-1 text-[10px] text-muted-foreground items-center gap-1">
            <Layers className="h-3 w-3" /> {liveData ? 1 : ZONES.length} zona · {realTotal} espacios
          </div>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-2 min-h-0 lg:max-h-none max-h-[60vh]">
          <Panel title={selected ? "Detalle del espacio" : "Seleccione un espacio"} padded>
            {selected ? (
              <SpaceDetail s={selected} />
            ) : (
              <div className="text-[12px] text-muted-foreground">
                Haga clic en cualquier marcador del mapa para inspeccionar ocupación, vehículo y
                cumplimiento.
              </div>
            )}
          </Panel>

          <Panel title="Feed de alertas en vivo" className="flex-1 min-h-[200px]" padded={false}>
            <ul className="divide-y divide-border overflow-auto h-full">
              {feed.slice(0, 40).map((c) => (
                <li key={c.id} className="px-2.5 py-1.5 hover:bg-surface-2 flex items-start gap-2">
                  <span
                    className={
                      "spk-dot mt-1.5 " +
                      (c.priority === "high"
                        ? "bg-destructive spk-pulse"
                        : c.priority === "medium"
                          ? "bg-warning"
                          : "bg-muted-foreground")
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium truncate">{c.plate}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {c.detected}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {c.zone} · {c.street} · {ISSUE_LABEL[c.issue] ?? c.issue}
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

function KpiBare({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-card px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center gap-2 min-w-0">
      <div className="h-7 w-7 rounded bg-secondary grid place-items-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </div>
        <div className="text-[14px] sm:text-[15px] font-semibold tabular-nums leading-tight truncate">
          {value}
        </div>
        {sub && (
          <div className="text-[10px] text-muted-foreground truncate hidden sm:block">{sub}</div>
        )}
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 text-[11px] rounded border border-border bg-card px-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring max-w-[140px]"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
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
      <Row k="Zona" v={`${s.zone_id} · ${s.zone}`} />
      <Row k="Calle" v={s.street} />
      <Row k="Tipo" v={s.type.replace("_", " ")} />
      <Row k="Sensor" v={s.sensor ? "Habilitado" : "Manual"} />
      {s.status === "occupied" && (
        <>
          <div className="my-2 border-t border-border" />
          <Row k="Placa del vehículo" v={<span className="font-mono">{s.plate || "—"}</span>} />
          <Row k="Ocupado desde" v={s.since || "—"} />
          <Row k="Cumplimiento" v={<StatusPill status="valid" />} />
        </>
      )}
      <div className="pt-2 flex gap-2">
        <button className="flex-1 h-8 text-[12px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-1.5">
          <Search className="h-3.5 w-3.5" /> Inspeccionar
        </button>
        <button className="flex-1 h-8 text-[12px] rounded-md border border-border hover:bg-secondary">
          Reservar
        </button>
      </div>
      <div className="text-[10px] text-muted-foreground pt-1">Estado: {STATUS_LABEL[s.status]}</div>
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

function LiveMapPageProtected() {
  return (
    <RequirePermission permission="VIEW_LIVE">
      <LiveMapPage />
    </RequirePermission>
  );
}
