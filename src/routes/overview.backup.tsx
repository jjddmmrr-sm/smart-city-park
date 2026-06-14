import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, KpiTile, StatusPill } from "@/components/ui-bits";
import { useSim, useLiveStats } from "@/lib/sim";
import { DAILY, HOURLY, ZONES, LATEST_DATE, MULTAS_RESUMEN } from "@/lib/data";
import { fmtInt, fmtUSD, fmtPct, ISSUE_LABEL } from "@/lib/format";
import {
  Activity, AlertTriangle, Car, DollarSign, MapPin, ShieldAlert, Timer, TrendingUp, Receipt,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useMemo } from "react";

export const Route = createFileRoute("/overview/backup")({
  head: () => ({
    meta: [
      { title: "Resumen General — Smart Park Chone" },
      { name: "description", content: "Resumen ejecutivo de las operaciones de parqueo municipal de Chone." },
    ],
  }),
  component: OverviewPage,
  ssr: false,
});

function OverviewPage() {
  const stats = useLiveStats();
  const { feed } = useSim();

  const today = useMemo(() => DAILY.filter((d) => d.date === LATEST_DATE), []);
  const todayTotals = today.reduce(
    (acc, d) => {
      acc.vehicles += d.total_vehicles;
      acc.revenue += d.revenue_usd;
      acc.over += d.overstay_cases;
      acc.unpaid += d.unpaid_cases;
      acc.dur += d.avg_duration_minutes * d.total_vehicles;
      acc.weight += d.total_vehicles;
      return acc;
    },
    { vehicles: 0, revenue: 0, over: 0, unpaid: 0, dur: 0, weight: 0 }
  );
  const avgDur = Math.round(todayTotals.dur / Math.max(todayTotals.weight, 1));

  const multasHoy = useMemo(() => {
    const dates = Array.from(new Set(MULTAS_RESUMEN.map(m => m.fecha))).sort();
    const last = dates[dates.length - 1];
    return MULTAS_RESUMEN.filter(m => m.fecha === last)
      .reduce((acc, m) => { acc.total += m.total_multas; acc.monto += m.monto_total_usd; return acc; }, { total: 0, monto: 0 });
  }, []);

  const hourlyAll = useMemo(() => {
    const by: Record<number, { hour: string; occupancy: number; entries: number }> = {};
    for (const h of HOURLY) {
      const e = (by[h.hour] ??= { hour: `${h.hour.toString().padStart(2, "0")}:00`, occupancy: 0, entries: 0 });
      e.occupancy += h.occupancy_rate;
      e.entries += h.avg_entries;
    }
    return Object.values(by).map((x) => ({ ...x, occupancy: +(x.occupancy / ZONES.length * 100).toFixed(1) }));
  }, []);

  const revenue14 = useMemo(() => {
    const dates = Array.from(new Set(DAILY.map((d) => d.date))).sort().slice(-14);
    return dates.map((date) => ({
      date: date.slice(5),
      revenue: +DAILY.filter((d) => d.date === date).reduce((a, b) => a + b.revenue_usd, 0).toFixed(2),
    }));
  }, []);

  const topZones = [...today].sort((a, b) => b.occupancy_rate - a.occupancy_rate);

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Resumen General Ejecutivo</h1>
            <p className="text-[12px] text-muted-foreground">Resumen operativo del {LATEST_DATE} · señal en vivo · todas las zonas</p>
          </div>
          <Link to="/" className="text-[12px] inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            Abrir Mapa en Vivo
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiTile label="Espacios totales" value={fmtInt(stats.total)} sub="inventario ciudad" icon={<MapPin className="h-4 w-4" />} accent="primary" />
          <KpiTile label="Ocupados ahora" value={fmtInt(stats.occupied)} sub={`${fmtPct(stats.occupancy, 1)} ocupación`} icon={<Car className="h-4 w-4" />} accent="destructive" />
          <KpiTile label="Disponibles ahora" value={fmtInt(stats.available)} sub="listos para uso" icon={<Activity className="h-4 w-4" />} accent="success" />
          <KpiTile label="Vehículos hoy" value={fmtInt(todayTotals.vehicles)} sub={`${avgDur} min promedio`} icon={<TrendingUp className="h-4 w-4" />} accent="accent" />
          <KpiTile label="Ingresos hoy" value={fmtUSD(todayTotals.revenue)} sub="todas las zonas" icon={<DollarSign className="h-4 w-4" />} accent="success" />
          <KpiTile label="Alertas activas" value={fmtInt(feed.filter(f => f.status === "pending").length)} sub="pendientes" icon={<AlertTriangle className="h-4 w-4" />} accent="warning" />
          <KpiTile label="Excesos de tiempo" value={fmtInt(todayTotals.over)} sub="hoy" icon={<Timer className="h-4 w-4" />} accent="warning" />
          <KpiTile label="Casos sin pago" value={fmtInt(todayTotals.unpaid)} sub="hoy" icon={<ShieldAlert className="h-4 w-4" />} accent="destructive" />
          <KpiTile label="Multas emitidas" value={fmtInt(multasHoy.total)} sub={fmtUSD(multasHoy.monto)} icon={<Receipt className="h-4 w-4" />} accent="primary" />
          <KpiTile label="Duración promedio" value={`${avgDur} min`} sub="ponderada" icon={<Timer className="h-4 w-4" />} accent="primary" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="Ocupación horaria (promedio ciudad, 90d)" className="lg:col-span-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyAll} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0a2540" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0a2540" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
                <Area type="monotone" dataKey="occupancy" stroke="#0a2540" strokeWidth={2} fill="url(#occ)" name="Ocupación" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Ingresos diarios (14 días)" className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue14} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} formatter={(v) => fmtUSD(Number(v))} />
                <Bar dataKey="revenue" fill="#00d4aa" radius={[3, 3, 0, 0]} name="Ingresos" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="Zonas con mayor demanda hoy" className="lg:col-span-1">
            <table className="w-full text-[12px]">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left font-medium pb-2">Zona</th><th className="text-right font-medium pb-2">Vehículos</th><th className="text-right font-medium pb-2">Ocup.</th><th className="text-right font-medium pb-2">Ingresos</th></tr>
              </thead>
              <tbody>
                {topZones.map((z) => (
                  <tr key={z.zone_id} className="border-t border-border">
                    <td className="py-2"><div className="font-medium">{z.zone_name}</div><div className="text-[10px] text-muted-foreground">{z.zone_id}</div></td>
                    <td className="text-right tabular-nums">{fmtInt(z.total_vehicles)}</td>
                    <td className="text-right tabular-nums">{fmtPct(z.occupancy_rate, 1)}</td>
                    <td className="text-right tabular-nums">{fmtUSD(z.revenue_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Alertas recientes" className="lg:col-span-2" padded={false}>
            <table className="w-full text-[12px]">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-surface-2">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Hora</th>
                  <th className="text-left font-medium px-3 py-2">Placa</th>
                  <th className="text-left font-medium px-3 py-2">Zona</th>
                  <th className="text-left font-medium px-3 py-2">Motivo</th>
                  <th className="text-left font-medium px-3 py-2">Prioridad</th>
                  <th className="text-left font-medium px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {feed.slice(0, 10).map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-surface-2">
                    <td className="px-3 py-1.5 tabular-nums">{c.detected}</td>
                    <td className="px-3 py-1.5 font-mono">{c.plate}</td>
                    <td className="px-3 py-1.5">{c.zone}</td>
                    <td className="px-3 py-1.5">{ISSUE_LABEL[c.issue] ?? c.issue}</td>
                    <td className="px-3 py-1.5"><StatusPill status={c.priority} /></td>
                    <td className="px-3 py-1.5"><StatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </div>
  );
}
