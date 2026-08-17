import { RequirePermission } from "@/components/RequirePermission";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Panel, KpiTile, StatusPill } from "@/components/ui-bits";
import { apiGetAuth } from "@/lib/api";
import { fmtInt, fmtUSD, fmtPct, ISSUE_LABEL } from "@/lib/format";
import {
  Activity,
  AlertTriangle,
  Car,
  DollarSign,
  MapPin,
  ShieldAlert,
  Timer,
  TrendingUp,
  Receipt,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Resumen General — Smart Park Chone" },
      { name: "description", content: "Resumen ejecutivo real de operaciones Smart Park Chone." },
    ],
  }),
  component: OverviewPageProtected,
  ssr: false,
});

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

type Enforcement = {
  id: string;
  date: string;
  plate: string;
  zone: string;
  street: string;
  issue: string;
  detected: string;
  status: string;
  priority: string;
};

type Payment = {
  fecha: string;
  zona: string;
  metodo_pago_codigo: string;
  metodo_pago_descripcion: string;
  transacciones: number;
  monto_total_usd: number;
};

type Fine = {
  multa_id: string;
  zona: string;
  valor_multa_usd: number;
  estado_multa: string;
};

type Vehicle = {
  id: string;
  zone: string;
  street: string;
  duration: number;
  compliance: string;
};

const COLORS = ["#0a2540", "#00d4aa", "#f59e0b", "#ef4444", "#3b82f6"];

function fechaEs(value: string) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("es-EC");
}

function priorityEs(value: string) {
  const map: Record<string, string> = { high: "alta", medium: "media", low: "baja" };
  return map[value] ?? value;
}

function statusEs(value: string) {
  const map: Record<string, string> = {
    pending: "pendiente",
    reviewing: "en revisión",
    fined: "multado",
    resolved: "resuelto",
  };
  return map[value] ?? value;
}

function OverviewPage() {
  const [overview, setOverview] = useState<OverviewApi | null>(null);
  const [enforcement, setEnforcement] = useState<Enforcement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    Promise.all([
      apiGetAuth<OverviewApi>("/frontend/overview"),
      apiGetAuth<Enforcement[]>("/frontend/enforcement"),
      apiGetAuth<Payment[]>("/frontend/payments"),
      apiGetAuth<Fine[]>("/frontend/fines"),
      apiGetAuth<Vehicle[]>("/frontend/vehicles"),
    ])
      .then(([o, e, p, f, v]) => {
        setOverview(o);
        setEnforcement(e);
        setPayments(p);
        setFines(f);
        setVehicles(v);
      })
      .catch((error) => console.error("Error loading overview", error));
  }, []);

  const avgDuration = useMemo(() => {
    if (!vehicles.length) return 0;
    return Math.round(vehicles.reduce((a, b) => a + (b.duration || 0), 0) / vehicles.length);
  }, [vehicles]);

  const paymentsByMethod = useMemo(() => {
    const map: Record<string, { label: string; amount: number; tx: number }> = {};
    for (const p of payments) {
      const e = (map[p.metodo_pago_codigo] ??= {
        label: p.metodo_pago_descripcion,
        amount: 0,
        tx: 0,
      });
      e.amount += p.monto_total_usd;
      e.tx += p.transacciones;
    }
    return Object.entries(map).map(([key, v]) => ({
      key,
      metodo: v.label,
      monto: +v.amount.toFixed(2),
      transacciones: v.tx,
    }));
  }, [payments]);

  const alertsByPriority = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of enforcement) map[e.priority] = (map[e.priority] || 0) + 1;
    return Object.entries(map).map(([name, value]) => ({ name: priorityEs(name), value }));
  }, [enforcement]);

  const zoneSummary = useMemo(() => {
    const map: Record<
      string,
      { vehicles: number; fines: number; revenue: number; alerts: number }
    > = {};

    for (const v of vehicles) {
      const e = (map[v.zone] ??= { vehicles: 0, fines: 0, revenue: 0, alerts: 0 });
      e.vehicles += 1;
    }

    for (const f of fines) {
      const e = (map[f.zona] ??= { vehicles: 0, fines: 0, revenue: 0, alerts: 0 });
      e.fines += 1;
    }

    for (const p of payments) {
      const e = (map[p.zona] ??= { vehicles: 0, fines: 0, revenue: 0, alerts: 0 });
      e.revenue += p.monto_total_usd;
    }

    for (const a of enforcement) {
      const e = (map[a.zone] ??= { vehicles: 0, fines: 0, revenue: 0, alerts: 0 });
      e.alerts += 1;
    }

    return Object.entries(map)
      .map(([zona, v]) => ({
        zona,
        vehicles: v.vehicles,
        fines: v.fines,
        alerts: v.alerts,
        revenue: +v.revenue.toFixed(2),
      }))
      .sort((a, b) => b.alerts + b.fines - (a.alerts + a.fines));
  }, [vehicles, fines, payments, enforcement]);

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Resumen General Ejecutivo</h1>
            <p className="text-[12px] text-muted-foreground">
              Datos reales desde PostgreSQL · operación actual · todas las zonas
            </p>
          </div>
          <Link
            to="/"
            className="text-[12px] inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Abrir Mapa en Vivo
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiTile
            label="Espacios totales"
            value={fmtInt(overview?.totalSpaces ?? 0)}
            sub="inventario ciudad"
            icon={<MapPin className="h-4 w-4" />}
            accent="primary"
          />
          <KpiTile
            label="Ocupados ahora"
            value={fmtInt(overview?.occupiedSpaces ?? 0)}
            sub={`${fmtPct((overview?.occupancyRate ?? 0) / 100, 1)} ocupación`}
            icon={<Car className="h-4 w-4" />}
            accent="destructive"
          />
          <KpiTile
            label="Disponibles ahora"
            value={fmtInt(overview?.availableSpaces ?? 0)}
            sub="listos para uso"
            icon={<Activity className="h-4 w-4" />}
            accent="success"
          />
          <KpiTile
            label="Vehículos hoy"
            value={fmtInt(overview?.vehiclesToday ?? vehicles.length)}
            sub={`${avgDuration} min promedio`}
            icon={<TrendingUp className="h-4 w-4" />}
            accent="accent"
          />
          <KpiTile
            label="Ingresos hoy"
            value={fmtUSD(overview?.revenueToday ?? 0)}
            sub="todas las zonas"
            icon={<DollarSign className="h-4 w-4" />}
            accent="success"
          />
          <KpiTile
            label="Alertas activas"
            value={fmtInt(overview?.activeAlerts ?? enforcement.length)}
            sub="pendientes"
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="warning"
          />
          <KpiTile
            label="Excesos de tiempo"
            value={fmtInt(overview?.overstayCases ?? 0)}
            sub="hoy"
            icon={<Timer className="h-4 w-4" />}
            accent="warning"
          />
          <KpiTile
            label="Casos sin pago"
            value={fmtInt(overview?.unpaidCases ?? 0)}
            sub="hoy"
            icon={<ShieldAlert className="h-4 w-4" />}
            accent="destructive"
          />
          <KpiTile
            label="Multas emitidas"
            value={fmtInt(overview?.ticketsIssued ?? fines.length)}
            sub={fmtUSD(overview?.ticketsAmount ?? 0)}
            icon={<Receipt className="h-4 w-4" />}
            accent="primary"
          />
          <KpiTile
            label="Duración promedio"
            value={`${avgDuration} min`}
            sub="sesiones registradas"
            icon={<Timer className="h-4 w-4" />}
            accent="primary"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="Recaudación por método de pago" className="lg:col-span-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={paymentsByMethod}
                margin={{ top: 6, right: 12, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="metodo" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 6, fontSize: 12 }}
                  formatter={(v) => fmtUSD(Number(v))}
                />
                <Bar dataKey="monto" fill="#00d4aa" radius={[3, 3, 0, 0]} name="Recaudación" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Alertas por prioridad" className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={alertsByPriority}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                >
                  {alertsByPriority.map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="Resumen real por zona" className="lg:col-span-1">
            <table className="w-full text-[12px]">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium pb-2">Zona</th>
                  <th className="text-right font-medium pb-2">Vehículos</th>
                  <th className="text-right font-medium pb-2">Alertas</th>
                  <th className="text-right font-medium pb-2">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {zoneSummary.map((z) => (
                  <tr key={z.zona} className="border-t border-border">
                    <td className="py-2 font-medium">{z.zona}</td>
                    <td className="text-right tabular-nums">{fmtInt(z.vehicles)}</td>
                    <td className="text-right tabular-nums">{fmtInt(z.alerts)}</td>
                    <td className="text-right tabular-nums">{fmtUSD(z.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Alertas recientes" className="lg:col-span-2" padded={false}>
            <table className="w-full text-[12px]">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-surface-2">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Detectado</th>
                  <th className="text-left font-medium px-3 py-2">Placa</th>
                  <th className="text-left font-medium px-3 py-2">Zona</th>
                  <th className="text-left font-medium px-3 py-2">Motivo</th>
                  <th className="text-left font-medium px-3 py-2">Prioridad</th>
                  <th className="text-left font-medium px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {enforcement.slice(0, 10).map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-surface-2">
                    <td className="px-3 py-1.5 tabular-nums">{fechaEs(c.detected)}</td>
                    <td className="px-3 py-1.5 font-mono">{c.plate}</td>
                    <td className="px-3 py-1.5">{c.zone}</td>
                    <td className="px-3 py-1.5">{ISSUE_LABEL[c.issue] ?? c.issue}</td>
                    <td className="px-3 py-1.5">
                      <StatusPill status={priorityEs(c.priority)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusPill status={statusEs(c.status)} />
                    </td>
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

function OverviewPageProtected() {
  return (
    <RequirePermission permission="VIEW_OVERVIEW">
      <OverviewPage />
    </RequirePermission>
  );
}
