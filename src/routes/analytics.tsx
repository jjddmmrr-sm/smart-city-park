import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Panel } from "@/components/ui-bits";
import { DAILY, HOURLY, TX_AGG, VEHICLES, ZONES } from "@/lib/data";
import { fmtInt, fmtUSD } from "@/lib/format";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend,
} from "recharts";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analítica — Smart Park Chone" },
      { name: "description", content: "Analítica estratégica de demanda, ingresos y cumplimiento de los últimos 90 días." },
    ],
  }),
  component: AnalyticsPage,
  ssr: false,
});

const ZONE_COLORS = ["#0a2540", "#00d4aa", "#f59e0b", "#ef4444", "#3b82f6"];
const COMPLIANCE_LABEL: Record<string, string> = { valid: "Válido", overstay: "Exceso de tiempo", no_payment: "Sin pago" };

function AnalyticsPage() {
  const dailyByDate = useMemo(() => {
    const dates = Array.from(new Set(DAILY.map(d => d.date))).sort();
    return dates.map((date) => {
      const day = DAILY.filter(d => d.date === date);
      const out: Record<string, number | string> = { date: date.slice(5) };
      let total = 0, rev = 0;
      for (const d of day) { total += d.total_vehicles; rev += d.revenue_usd; out[d.zone_name] = d.total_vehicles; }
      out.total = total; out.revenue = +rev.toFixed(2);
      return out;
    });
  }, []);

  const occByZoneHour = useMemo(() => {
    const hours = Array.from({ length: 14 }, (_, i) => i + 6);
    return hours.map((h) => {
      const out: Record<string, number | string> = { hour: `${h.toString().padStart(2, "0")}:00` };
      for (const z of ZONES) {
        const r = HOURLY.find((x) => x.zone_id === z.zone_id && x.hour === h);
        out[z.zone_name] = r ? +(r.occupancy_rate * 100).toFixed(1) : 0;
      }
      return out;
    });
  }, []);

  const zoneSummary = useMemo(() => {
    return ZONES.map((z) => {
      const days = DAILY.filter(d => d.zone_id === z.zone_id);
      const vehicles = days.reduce((a, b) => a + b.total_vehicles, 0);
      const revenue = days.reduce((a, b) => a + b.revenue_usd, 0);
      const occ = days.reduce((a, b) => a + b.occupancy_rate, 0) / days.length;
      const dur = days.reduce((a, b) => a + b.avg_duration_minutes * b.total_vehicles, 0) / Math.max(vehicles, 1);
      const rotation = vehicles / (z.spaces * days.length);
      return { ...z, vehicles, revenue: +revenue.toFixed(2), occ: +(occ * 100).toFixed(1), dur: Math.round(dur), rotation: +rotation.toFixed(2) };
    });
  }, []);

  const vehicleTypes = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of VEHICLES) m.set(v.type, (m.get(v.type) ?? 0) + 1);
    return Array.from(m, ([name, value]) => ({ name, value }));
  }, []);

  const compliance = useMemo(() => {
    const m: Record<string, number> = { valid: 0, overstay: 0, no_payment: 0 };
    for (const v of VEHICLES) m[v.compliance] = (m[v.compliance] ?? 0) + 1;
    return Object.entries(m).map(([name, value]) => ({ name: COMPLIANCE_LABEL[name] ?? name, value }));
  }, []);

  const topStreets = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of VEHICLES) m.set(v.street, (m.get(v.street) ?? 0) + 1);
    return Array.from(m, ([street, vehicles]) => ({ street, vehicles })).sort((a, b) => b.vehicles - a.vehicles).slice(0, 10);
  }, []);

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div>
          <h1 className="text-[20px] font-semibold text-primary">Analítica Estratégica</h1>
          <p className="text-[12px] text-muted-foreground">Inteligencia operativa de 90 días · todas las zonas · Smart Park Chone</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="Ocupación por hora y zona" className="lg:col-span-2 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={occByZoneHour} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {ZONES.map((z, i) => (
                  <Line key={z.zone_id} type="monotone" dataKey={z.zone_name} stroke={ZONE_COLORS[i]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Distribución por tipo de vehículo" className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={vehicleTypes} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {vehicleTypes.map((_, i) => <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="Volumen diario por zona (30d)" className="lg:col-span-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyByDate.slice(-30)} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {ZONES.map((z, i) => (
                  <Bar key={z.zone_id} dataKey={z.zone_name} stackId="a" fill={ZONE_COLORS[i]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Cumplimiento vs. infracciones" className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={compliance} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                  <Cell fill="#10b981" /><Cell fill="#f59e0b" /><Cell fill="#ef4444" />
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel title="Desempeño por zona (90 días)" padded={false}>
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Zona</th>
                  <th className="text-right font-medium px-3 py-2">Espacios</th>
                  <th className="text-right font-medium px-3 py-2">Vehículos</th>
                  <th className="text-right font-medium px-3 py-2">Ocup. prom.</th>
                  <th className="text-right font-medium px-3 py-2">Dur. prom.</th>
                  <th className="text-right font-medium px-3 py-2">Rotación</th>
                  <th className="text-right font-medium px-3 py-2">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {zoneSummary.map((z) => (
                  <tr key={z.zone_id} className="border-t border-border">
                    <td className="px-3 py-2"><div className="font-medium">{z.zone_name}</div><div className="text-[10px] text-muted-foreground">{z.zone_id}</div></td>
                    <td className="px-3 py-2 text-right tabular-nums">{z.spaces}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtInt(z.vehicles)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{z.occ}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{z.dur} min</td>
                    <td className="px-3 py-2 text-right tabular-nums">{z.rotation}×/día</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtUSD(z.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <div className="grid grid-cols-1 gap-3">
            <Panel title="Calles con mayor demanda (14d)" padded={false}>
              <table className="w-full text-[12px]">
                <tbody>
                  {topStreets.map((s, i) => (
                    <tr key={s.street} className="border-t border-border">
                      <td className="px-3 py-1.5 w-6 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-3 py-1.5">{s.street}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums w-24">{fmtInt(s.vehicles)}</td>
                      <td className="px-3 py-1.5 w-32">
                        <div className="h-1.5 rounded bg-secondary overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${(s.vehicles / topStreets[0].vehicles) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="Ingresos por método de pago (14d)" className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={TX_AGG.by_method} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="method" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} formatter={(v) => fmtUSD(Number(v))} />
                  <Bar dataKey="amount" fill="#0a2540" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
