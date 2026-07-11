import { RequirePermission } from "@/components/RequirePermission";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { KpiTile, Panel } from "@/components/ui-bits";
import { fmtInt, fmtUSD } from "@/lib/format";
import { apiGet } from "@/lib/api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CreditCard, Smartphone, Building, UserRound, DollarSign, Receipt } from "lucide-react";

export const Route = createFileRoute("/medios-pago")({
  head: () => ({
    meta: [
      { title: "Medios de Pago — Smart Park Chone" },
      { name: "description", content: "Análisis de canales de pago reales del sistema." },
    ],
  }),
  component: MediosPagoPageProtected,
  ssr: false,
});

type PaymentRow = {
  fecha: string;
  zona: string;
  metodo_pago_codigo: string;
  metodo_pago_descripcion: string;
  transacciones: number;
  monto_total_usd: number;
  tickets_promedio_usd: number;
  porcentaje_participacion: number;
};

const METHOD_COLORS: Record<string, string> = {
  app: "#00d4aa",
  app_movil: "#00d4aa",
  card: "#0a2540",
  tarjeta_fisica: "#0a2540",
  kiosk: "#f59e0b",
  kiosco: "#f59e0b",
  agent: "#3b82f6",
  agente: "#3b82f6",
};

const METHOD_ICON: Record<string, React.ReactNode> = {
  app: <Smartphone className="h-4 w-4" />,
  app_movil: <Smartphone className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
  tarjeta_fisica: <CreditCard className="h-4 w-4" />,
  kiosk: <Building className="h-4 w-4" />,
  kiosco: <Building className="h-4 w-4" />,
  agent: <UserRound className="h-4 w-4" />,
  agente: <UserRound className="h-4 w-4" />,
};

function methodColor(key: string) {
  return METHOD_COLORS[key] ?? "#64748b";
}

function methodIcon(key: string) {
  return METHOD_ICON[key] ?? <CreditCard className="h-4 w-4" />;
}

function MediosPagoPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<PaymentRow[]>("/frontend/payments")
      .then(setRows)
      .catch((error) => console.error("Error loading payments", error))
      .finally(() => setLoading(false));
  }, []);

  const dates = useMemo(() => Array.from(new Set(rows.map((m) => m.fecha))).sort(), [rows]);
  const windowDates = useMemo(() => dates.slice(-days), [dates, days]);
  const data = useMemo(
    () => rows.filter((m) => windowDates.includes(m.fecha)),
    [rows, windowDates],
  );

  const byMethod = useMemo(() => {
    const m: Record<string, { tx: number; monto: number; descripcion: string }> = {};
    for (const r of data) {
      const e = (m[r.metodo_pago_codigo] ??= {
        tx: 0,
        monto: 0,
        descripcion: r.metodo_pago_descripcion || r.metodo_pago_codigo,
      });
      e.tx += r.transacciones;
      e.monto += r.monto_total_usd;
    }
    const total = Object.values(m).reduce((a, b) => a + b.monto, 0);
    return Object.entries(m)
      .map(([k, v]) => ({
        key: k,
        name: v.descripcion,
        tx: v.tx,
        monto: +v.monto.toFixed(2),
        ticket: +(v.monto / Math.max(v.tx, 1)).toFixed(2),
        pct: +((v.monto / Math.max(total, 1)) * 100).toFixed(1),
      }))
      .sort((a, b) => b.monto - a.monto);
  }, [data]);

  const totals = useMemo(() => {
    const tx = data.reduce((a, b) => a + b.transacciones, 0);
    const monto = data.reduce((a, b) => a + b.monto_total_usd, 0);
    return {
      tx,
      monto,
      ticket: +(monto / Math.max(tx, 1)).toFixed(2),
      canales: byMethod.length,
      zonas: new Set(data.map((x) => x.zona)).size,
    };
  }, [data, byMethod]);

  const trend = useMemo(() => {
    return windowDates.map((d) => {
      const day = data.filter((x) => x.fecha === d);
      return {
        date: d.slice(5),
        transacciones: day.reduce((a, b) => a + b.transacciones, 0),
        monto: +day.reduce((a, b) => a + b.monto_total_usd, 0).toFixed(2),
      };
    });
  }, [windowDates, data]);

  const byZone = useMemo(() => {
    const z: Record<string, { tx: number; monto: number }> = {};
    for (const r of data) {
      const e = (z[r.zona] ??= { tx: 0, monto: 0 });
      e.tx += r.transacciones;
      e.monto += r.monto_total_usd;
    }
    return Object.entries(z).map(([zona, vals]) => ({
      zona,
      transacciones: vals.tx,
      monto: +vals.monto.toFixed(2),
    }));
  }, [data]);

  return (
    <div className="h-full flex flex-col bg-surface overflow-auto">
      <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-[18px] font-semibold text-primary">Análisis de Medios de Pago</h1>
          <p className="text-[12px] text-muted-foreground">
            Recaudación y canales de pago activos en PostgreSQL · ventana de {days} días
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border overflow-hidden text-[12px]">
          {[30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d as 30 | 60 | 90)}
              className={
                "px-3 h-8 " +
                (days === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-secondary text-muted-foreground")
              }
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile
            label="Transacciones"
            value={fmtInt(totals.tx)}
            sub={`${days} días`}
            icon={<Receipt className="h-4 w-4" />}
            accent="primary"
          />
          <KpiTile
            label="Recaudación total"
            value={fmtUSD(totals.monto)}
            sub="USD"
            icon={<DollarSign className="h-4 w-4" />}
            accent="success"
          />
          <KpiTile
            label="Ticket promedio"
            value={`$${totals.ticket.toFixed(2)}`}
            sub="por transacción"
            accent="accent"
          />
          <KpiTile
            label="Canales activos"
            value={fmtInt(totals.canales)}
            sub="métodos usados"
            icon={<CreditCard className="h-4 w-4" />}
            accent="primary"
          />
          <KpiTile
            label="Zonas con pago"
            value={fmtInt(totals.zonas)}
            sub="cobertura"
            icon={<Building className="h-4 w-4" />}
            accent="warning"
          />
          <KpiTile
            label="Estado"
            value={loading ? "..." : "Online"}
            sub="/frontend/payments"
            icon={<Smartphone className="h-4 w-4" />}
            accent="success"
          />
        </div>
      </div>

      <div className="px-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="Recaudación diaria" className="lg:col-span-2 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip
                contentStyle={{ borderRadius: 6, fontSize: 12 }}
                formatter={(v) => fmtUSD(Number(v))}
              />
              <Bar dataKey="monto" fill="#00d4aa" name="Recaudación" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Participación por canal" className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={byMethod}
                dataKey="monto"
                nameKey="name"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {byMethod.map((m) => (
                  <Cell key={m.key} fill={methodColor(m.key)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 6, fontSize: 12 }}
                formatter={(v) => fmtUSD(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="Recaudación por zona" className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byZone} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="zona" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip
                contentStyle={{ borderRadius: 6, fontSize: 12 }}
                formatter={(v) => fmtUSD(Number(v))}
              />
              <Bar dataKey="monto" fill="#0a2540" name="Recaudación" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Transacciones por zona" className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byZone} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="zona" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
              <Bar
                dataKey="transacciones"
                fill="#3b82f6"
                name="Transacciones"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
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
              {byMethod.map((m) => (
                <tr key={m.key} className="border-t border-border">
                  <td className="px-3 py-2 font-medium inline-flex items-center gap-2">
                    <span
                      className="grid place-items-center h-6 w-6 rounded"
                      style={{ background: methodColor(m.key) + "22", color: methodColor(m.key) }}
                    >
                      {methodIcon(m.key)}
                    </span>
                    {m.name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(m.tx)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtUSD(m.monto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${m.ticket.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{m.pct}%</td>
                  <td className="px-3 py-2">
                    <div className="h-1.5 w-full rounded bg-secondary overflow-hidden">
                      <div
                        className="h-full"
                        style={{ width: `${m.pct}%`, background: methodColor(m.key) }}
                      />
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

function MediosPagoPageProtected() {
  return (
    <RequirePermission permission="VIEW_PAYMENTS">
      <MediosPagoPage />
    </RequirePermission>
  );
}
