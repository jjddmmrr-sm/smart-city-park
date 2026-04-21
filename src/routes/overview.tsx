import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, KpiTile, StatusPill } from "@/components/ui-bits";
import { useSim, useLiveStats } from "@/lib/sim";
import { DAILY, HOURLY, ZONES, LATEST_DATE } from "@/lib/data";
import { fmtInt, fmtUSD, fmtPct } from "@/lib/format";
import {
  Activity, AlertTriangle, Car, DollarSign, MapPin, ShieldAlert, Timer, TrendingUp,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useMemo } from "react";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Overview — Smart Park Chone" },
      { name: "description", content: "Executive overview of Chone municipal parking operations." },
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
        {/* Section header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Executive Overview</h1>
            <p className="text-[12px] text-muted-foreground">Operational summary for {LATEST_DATE} · live signal · all zones</p>
          </div>
          <Link to="/" className="text-[12px] inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            Open Live Map
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiTile label="Total spaces" value={fmtInt(stats.total)} sub="city-wide inventory" icon={<MapPin className="h-4 w-4" />} accent="primary" />
          <KpiTile label="Occupied now" value={fmtInt(stats.occupied)} sub={`${fmtPct(stats.occupancy, 1)} occupancy`} icon={<Car className="h-4 w-4" />} accent="destructive" />
          <KpiTile label="Available now" value={fmtInt(stats.available)} sub="ready to use" icon={<Activity className="h-4 w-4" />} accent="success" />
          <KpiTile label="Vehicles today" value={fmtInt(todayTotals.vehicles)} sub={`avg ${avgDur} min stay`} icon={<TrendingUp className="h-4 w-4" />} accent="accent" />
          <KpiTile label="Revenue today" value={fmtUSD(todayTotals.revenue)} sub="all zones" icon={<DollarSign className="h-4 w-4" />} accent="success" />
          <KpiTile label="Active alerts" value={fmtInt(feed.filter(f => f.status === "pending").length)} sub="awaiting action" icon={<AlertTriangle className="h-4 w-4" />} accent="warning" />
          <KpiTile label="Overstays today" value={fmtInt(todayTotals.over)} sub="time exceeded" icon={<Timer className="h-4 w-4" />} accent="warning" />
          <KpiTile label="Unpaid cases" value={fmtInt(todayTotals.unpaid)} sub="no payment" icon={<ShieldAlert className="h-4 w-4" />} accent="destructive" />
          <KpiTile label="Avg duration" value={`${avgDur} min`} sub="weighted" icon={<Timer className="h-4 w-4" />} accent="primary" />
          <KpiTile label="Reserved" value={fmtInt(stats.reserved)} sub="held spaces" icon={<MapPin className="h-4 w-4" />} accent="warning" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="Hourly occupancy (city avg, 90d)" className="lg:col-span-2 h-72">
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
                <Area type="monotone" dataKey="occupancy" stroke="#0a2540" strokeWidth={2} fill="url(#occ)" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Revenue trend (14 days)" className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue14} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} formatter={(v) => fmtUSD(Number(v))} />
                <Bar dataKey="revenue" fill="#00d4aa" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="Top zones today" className="lg:col-span-1">
            <table className="w-full text-[12px]">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left font-medium pb-2">Zone</th><th className="text-right font-medium pb-2">Vehicles</th><th className="text-right font-medium pb-2">Occ.</th><th className="text-right font-medium pb-2">Revenue</th></tr>
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

          <Panel title="Recent alerts" className="lg:col-span-2" padded={false}>
            <table className="w-full text-[12px]">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-surface-2">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Time</th>
                  <th className="text-left font-medium px-3 py-2">Plate</th>
                  <th className="text-left font-medium px-3 py-2">Zone</th>
                  <th className="text-left font-medium px-3 py-2">Issue</th>
                  <th className="text-left font-medium px-3 py-2">Priority</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {feed.slice(0, 10).map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-surface-2">
                    <td className="px-3 py-1.5 tabular-nums">{c.detected}</td>
                    <td className="px-3 py-1.5 font-mono">{c.plate}</td>
                    <td className="px-3 py-1.5">{c.zone}</td>
                    <td className="px-3 py-1.5 capitalize">{c.issue.replace("_", " ")}</td>
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
