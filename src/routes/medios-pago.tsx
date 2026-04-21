import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { KpiTile, Panel } from "@/components/ui-bits";
import { MEDIOS_PAGO } from "@/lib/data";
import { fmtInt, fmtUSD, PAYMENT_METHOD_LABEL } from "@/lib/format";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CreditCard, Smartphone, Building, UserRound, DollarSign, Receipt } from "lucide-react";

export const Route = createFileRoute("/medios-pago")({
  head: () => ({
    meta: [
      { title: "Medios de Pago — Smart Park Chone" },
      { name: "description", content: "Análisis de canales de pago: app móvil, tarjeta física, kiosco y agente." },
    ],
  }),
  component: MediosPagoPage,
  ssr: false,
});

const METHOD_COLORS: Record<string, string> = {
  app_movil: "#00d4aa",
  tarjeta_fisica: "#0a2540",
  kiosco: "#f59e0b",
  agente: "#3b82f6",
};
const METHOD_ICON: Record<string, React.ReactNode> = {
  app_movil: <Smartphone className="h-4 w-4" />,
  tarjeta_fisica: <CreditCard className="h-4 w-4" />,
  kiosco: <Building className="h-4 w-4" />,
  agente: <UserRound className="h-4 w-4" />,
};

function MediosPagoPage() {
  const [days, setDays] = useState<30 | 60 | 90>(30);

  const dates = useMemo(() => Array.from(new Set(MEDIOS_PAGO.map(m => m.fecha))).sort(), []);
  const window = useMemo(() => dates.slice(-days), [dates, days]);
  const data = useMemo(() => MEDIOS_PAGO.filter(m => window.includes(m.fecha)), [window]);

  const byMethod = useMemo(() => {
    const m: Record<string, { tx: number; monto: number }> = {};
    for (const r of data) {
      const e = (m[r.metodo_pago_codigo] ??= { tx: 0, monto: 0 });
      e.tx += r.transacciones;
      e.monto += r.monto_total_usd;
    }
    const total = Object.values(m).reduce((a, b) => a + b.monto, 0);
    return Object.entries(m).map(([k, v]) => ({
      key: k,
      name: PAYMENT_METHOD_LABEL[k] ?? k,
      tx: v.tx,
      monto: +v.monto.toFixed(2),
      ticket: +(v.monto / Math.max(v.tx, 1)).toFixed(2),
      pct: +((v.monto / Math.max(total, 1)) * 100).toFixed(1),
    })).sort((a, b) => b.monto - a.monto);
  }, [data]);

  const totals = useMemo(() => {
    const tx = data.reduce((a, b) => a + b.transacciones, 0);
    const monto = data.reduce((a, b) => a + b.monto_total_usd, 0);
    return { tx, monto, ticket: +(monto / Math.max(tx, 1)).toFixed(2) };
  }, [data]);

  const trend = useMemo(() => {
    return window.map(d => {
      const day = data.filter(x => x.fecha === d);
      const out: Record<string, number | string> = { date: d.slice(5) };
      for (const m of day) {
        out[m.metodo_pago_codigo] = (Number(out[m.metodo_pago_codigo]) || 0) + m.monto_total_usd;
      }
      return out;
    });
  }, [window, data]);

  const byZone = useMemo(() => {
    const z: Record<string, Record<string, number>> = {};
    for (const r of data) {
      const e = (z[r.zona] ??= {});
      e[r.metodo_pago_codigo] = (e[r.metodo_pago_codigo] ?? 0) + r.monto_total_usd;
    }
    return Object.entries(z).map(([zona, vals]) => ({
      zona,
      app_movil: +(vals.app_movil ?? 0).toFixed(2),
      tarjeta_fisica: +(vals.tarjeta_fisica ?? 0).toFixed(2),
      kiosco: +(vals.kiosco ?? 0).toFixed(2),
      agente: +(vals.agente ?? 0).toFixed(2),
    }));
  }, [data]);

  return (
    <div className="h-full flex flex-col bg-surface overflow-auto">
      <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-[18px] font-semibold text-primary">Análisis de Medios de Pago</h1>
          <p className="text-[12px] text-muted-foreground">Recaudación y canales de pago activos en el sistema · ventana de {days} días</p>
        </div>
        <div className="inline-flex rounded-md border border-border overflow-hidden text-[12px]">
          {[30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d as 30 | 60 | 90)} className={"px-3 h-8 " + (days === d ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary text-muted-foreground")}>
              {d} días
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile label="Transacciones" value={fmtInt(totals.tx)} sub={`${days} días`} icon={<Receipt className="h-4 w-4" />} accent="primary" />
          <KpiTile label="Recaudación total" value={fmtUSD(totals.monto)} sub="USD" icon={<DollarSign className="h-4 w-4" />} accent="success" />
          <KpiTile label="Ticket promedio" value={`$${totals.ticket}`} sub="por transacción" accent="accent" />
          {byMethod.slice(0, 3).map(m => (
            <KpiTile key={m.key} label={m.name} value={`${m.pct}%`} sub={fmtUSD(m.monto)} icon={METHOD_ICON[m.key]} accent="primary" />
          ))}
        </div>
      </div>

      <div className="px-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="Recaudación diaria por canal" className="lg:col-span-2 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} formatter={(v) => fmtUSD(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="app_movil" stackId="1" stroke={METHOD_COLORS.app_movil} fill={METHOD_COLORS.app_movil} fillOpacity={0.6} name="App móvil" />
              <Area type="monotone" dataKey="tarjeta_fisica" stackId="1" stroke={METHOD_COLORS.tarjeta_fisica} fill={METHOD_COLORS.tarjeta_fisica} fillOpacity={0.6} name="Tarjeta física" />
              <Area type="monotone" dataKey="kiosco" stackId="1" stroke={METHOD_COLORS.kiosco} fill={METHOD_COLORS.kiosco} fillOpacity={0.6} name="Kiosco" />
              <Area type="monotone" dataKey="agente" stackId="1" stroke={METHOD_COLORS.agente} fill={METHOD_COLORS.agente} fillOpacity={0.6} name="Agente" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Participación por canal" className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byMethod} dataKey="monto" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {byMethod.map(m => <Cell key={m.key} fill={METHOD_COLORS[m.key]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} formatter={(v) => fmtUSD(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="Recaudación por zona y canal" className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byZone} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="zona" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} formatter={(v) => fmtUSD(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="app_movil" stackId="a" fill={METHOD_COLORS.app_movil} name="App móvil" />
              <Bar dataKey="tarjeta_fisica" stackId="a" fill={METHOD_COLORS.tarjeta_fisica} name="Tarjeta" />
              <Bar dataKey="kiosco" stackId="a" fill={METHOD_COLORS.kiosco} name="Kiosco" />
              <Bar dataKey="agente" stackId="a" fill={METHOD_COLORS.agente} name="Agente" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Ticket promedio por canal" className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend.map(d => {
              const out: Record<string, number | string> = { date: d.date };
              for (const k of ["app_movil","tarjeta_fisica","kiosco","agente"]) {
                const day = data.filter(x => x.fecha.slice(5) === d.date && x.metodo_pago_codigo === k);
                const tx = day.reduce((a, b) => a + b.transacciones, 0);
                const monto = day.reduce((a, b) => a + b.monto_total_usd, 0);
                out[k] = tx ? +(monto / tx).toFixed(2) : 0;
              }
              return out;
            })} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit="$" />
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="app_movil" stroke={METHOD_COLORS.app_movil} strokeWidth={2} dot={false} name="App móvil" />
              <Line type="monotone" dataKey="tarjeta_fisica" stroke={METHOD_COLORS.tarjeta_fisica} strokeWidth={2} dot={false} name="Tarjeta" />
              <Line type="monotone" dataKey="kiosco" stroke={METHOD_COLORS.kiosco} strokeWidth={2} dot={false} name="Kiosco" />
              <Line type="monotone" dataKey="agente" stroke={METHOD_COLORS.agente} strokeWidth={2} dot={false} name="Agente" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="px-4 pb-4">
        <Panel title="Resumen por canal" padded={false}>
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Canal</th>
                <th className="text-right font-medium px-3 py-2">Transacciones</th>
                <th className="text-right font-medium px-3 py-2">Recaudación</th>
                <th className="text-right font-medium px-3 py-2">Ticket promedio</th>
                <th className="text-right font-medium px-3 py-2">Participación</th>
                <th className="px-3 py-2 w-40">Distribución</th>
              </tr>
            </thead>
            <tbody>
              {byMethod.map(m => (
                <tr key={m.key} className="border-t border-border">
                  <td className="px-3 py-2 font-medium inline-flex items-center gap-2">
                    <span className="grid place-items-center h-6 w-6 rounded" style={{ background: METHOD_COLORS[m.key] + "22", color: METHOD_COLORS[m.key] }}>{METHOD_ICON[m.key]}</span>
                    {m.name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(m.tx)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtUSD(m.monto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${m.ticket.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{m.pct}%</td>
                  <td className="px-3 py-2">
                    <div className="h-1.5 w-full rounded bg-secondary overflow-hidden">
                      <div className="h-full" style={{ width: `${m.pct}%`, background: METHOD_COLORS[m.key] }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
