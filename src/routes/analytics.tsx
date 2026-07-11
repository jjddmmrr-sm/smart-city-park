import { RequirePermission } from "@/components/RequirePermission";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { KpiTile, Panel } from "@/components/ui-bits";
import { apiGet } from "@/lib/api";
import { fmtInt, fmtUSD } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Car, DollarSign, FileWarning, Receipt, ShieldCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analítica — Smart Park Chone" },
      { name: "description", content: "Analítica ejecutiva con datos reales de Smart Park Chone." },
    ],
  }),
  component: AnalyticsPageProtected,
  ssr: false,
});

type Overview = {
  totalSpaces: number;
  occupiedSpaces: number;
  availableSpaces: number;
  occupancyRate: number;
  vehiclesToday: number;
  revenueToday: number;
  activeAlerts: number;
  unpaidCases: number;
  ticketsIssued: number;
  ticketsAmount: number;
};

type Vehicle = {
  id: string;
  plate: string;
  type: string;
  zone: string;
  street: string;
  payment: string;
  compliance: string;
};

type Fine = {
  multa_id: string;
  fecha_hora: string;
  placa: string;
  zona: string;
  calle: string;
  motivo_codigo: string;
  motivo_descripcion: string;
  valor_multa_usd: number;
  estado_multa: string;
  prioridad: string;
};

type Payment = {
  fecha: string;
  zona: string;
  metodo_pago_codigo: string;
  metodo_pago_descripcion: string;
  transacciones: number;
  monto_total_usd: number;
};

type Enforcement = {
  id: string;
  date: string;
  plate: string;
  zone: string;
  street: string;
  issue: string;
  status: string;
  priority: string;
};

const COLORS = ["#0a2540", "#00d4aa", "#f59e0b", "#ef4444", "#3b82f6"];

function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [enforcement, setEnforcement] = useState<Enforcement[]>([]);

  useEffect(() => {
    Promise.all([
      apiGet<Overview>("/frontend/overview"),
      apiGet<Vehicle[]>("/frontend/vehicles"),
      apiGet<Fine[]>("/frontend/fines"),
      apiGet<Payment[]>("/frontend/payments"),
      apiGet<Enforcement[]>("/frontend/enforcement"),
    ])
      .then(([o, v, f, p, e]) => {
        setOverview(o);
        setVehicles(v);
        setFines(f);
        setPayments(p);
        setEnforcement(e);
      })
      .catch((error) => console.error("Error loading analytics", error));
  }, []);

  const totals = useMemo(() => {
    const paidFines = fines.filter((f) => f.estado_multa === "paid").length;
    const fineAmount = fines.reduce((a, b) => a + b.valor_multa_usd, 0);
    const paidAmount = fines
      .filter((f) => f.estado_multa === "paid")
      .reduce((a, b) => a + b.valor_multa_usd, 0);
    const paymentAmount = payments.reduce((a, b) => a + b.monto_total_usd, 0);
    const validVehicles = vehicles.filter((v) => v.compliance === "valid").length;
    const complianceRate = vehicles.length
      ? Math.round((validVehicles / vehicles.length) * 100)
      : 0;

    return {
      vehicles: vehicles.length,
      fines: fines.length,
      paidFines,
      fineAmount,
      paidAmount,
      paymentAmount,
      enforcement: enforcement.length,
      complianceRate,
      occupancy: overview?.occupancyRate ?? 0,
      availableSpaces: overview?.availableSpaces ?? 0,
    };
  }, [overview, vehicles, fines, payments, enforcement]);

  const finesByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of fines) map[f.estado_multa] = (map[f.estado_multa] || 0) + 1;
    return Object.entries(map).map(([name, value]) => ({
      name: name === "paid" ? "Pagadas" : name,
      value,
    }));
  }, [fines]);

  const finesByZone = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    for (const f of fines) {
      const e = (map[f.zona] ??= { count: 0, amount: 0 });
      e.count += 1;
      e.amount += f.valor_multa_usd;
    }
    return Object.entries(map).map(([zona, v]) => ({
      zona,
      multas: v.count,
      monto: +v.amount.toFixed(2),
    }));
  }, [fines]);

  const paymentsByMethod = useMemo(() => {
    const map: Record<string, { tx: number; amount: number; label: string }> = {};
    for (const p of payments) {
      const e = (map[p.metodo_pago_codigo] ??= {
        tx: 0,
        amount: 0,
        label: p.metodo_pago_descripcion,
      });
      e.tx += p.transacciones;
      e.amount += p.monto_total_usd;
    }
    return Object.entries(map).map(([key, v]) => ({
      key,
      metodo: v.label,
      transacciones: v.tx,
      monto: +v.amount.toFixed(2),
    }));
  }, [payments]);

  const enforcementByPriority = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of enforcement) map[e.priority] = (map[e.priority] || 0) + 1;
    return Object.entries(map).map(([name, value]) => ({
      name: name === "high" ? "Alta" : name,
      value,
    }));
  }, [enforcement]);

  const zoneExecutive = useMemo(() => {
    const map: Record<
      string,
      { vehicles: number; fines: number; payments: number; alerts: number }
    > = {};
    for (const v of vehicles)
      (map[v.zone] ??= { vehicles: 0, fines: 0, payments: 0, alerts: 0 }).vehicles++;
    for (const f of fines)
      (map[f.zona] ??= { vehicles: 0, fines: 0, payments: 0, alerts: 0 }).fines++;
    for (const p of payments)
      (map[p.zona] ??= { vehicles: 0, fines: 0, payments: 0, alerts: 0 }).payments +=
        p.monto_total_usd;
    for (const e of enforcement)
      (map[e.zone] ??= { vehicles: 0, fines: 0, payments: 0, alerts: 0 }).alerts++;

    return Object.entries(map)
      .map(([zona, v]) => ({
        zona,
        vehicles: v.vehicles,
        fines: v.fines,
        payments: +v.payments.toFixed(2),
        alerts: v.alerts,
      }))
      .sort((a, b) => b.fines + b.alerts - (a.fines + a.alerts));
  }, [vehicles, fines, payments, enforcement]);

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div>
          <h1 className="text-[20px] font-semibold text-primary">Analítica Ejecutiva</h1>
          <p className="text-[12px] text-muted-foreground">
            Indicadores reales integrados desde PostgreSQL · Smart Park Chone
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile
            label="Vehículos"
            value={fmtInt(totals.vehicles)}
            sub="registrados"
            icon={<Car className="h-4 w-4" />}
            accent="primary"
          />
          <KpiTile
            label="Multas emitidas"
            value={fmtInt(totals.fines)}
            sub={fmtUSD(totals.fineAmount)}
            icon={<Receipt className="h-4 w-4" />}
            accent="destructive"
          />
          <KpiTile
            label="Multas pagadas"
            value={fmtInt(totals.paidFines)}
            sub={fmtUSD(totals.paidAmount)}
            icon={<ShieldCheck className="h-4 w-4" />}
            accent="success"
          />
          <KpiTile
            label="Pagos recibidos"
            value={fmtUSD(totals.paymentAmount)}
            sub="recaudación directa"
            icon={<DollarSign className="h-4 w-4" />}
            accent="success"
          />
          <KpiTile
            label="Alertas"
            value={fmtInt(totals.enforcement)}
            sub="cumplimiento"
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="warning"
          />
          <KpiTile
            label="Cumplimiento"
            value={`${totals.complianceRate}%`}
            sub={`${totals.availableSpaces} espacios libres`}
            icon={<FileWarning className="h-4 w-4" />}
            accent="accent"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="Multas por zona" className="lg:col-span-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={finesByZone} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="zona" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="multas" fill="#ef4444" name="Multas" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Estado de multas" className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={finesByStatus}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                >
                  {finesByStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel title="Pagos por método" className="h-72">
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
                <Bar dataKey="monto" fill="#00d4aa" name="Recaudación" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Alertas por prioridad" className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={enforcementByPriority}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                >
                  {enforcementByPriority.map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <Panel title="Ranking ejecutivo por zona" padded={false}>
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Zona</th>
                <th className="text-right font-medium px-3 py-2">Vehículos</th>
                <th className="text-right font-medium px-3 py-2">Multas</th>
                <th className="text-right font-medium px-3 py-2">Alertas</th>
                <th className="text-right font-medium px-3 py-2">Recaudación</th>
              </tr>
            </thead>
            <tbody>
              {zoneExecutive.map((z) => (
                <tr key={z.zona} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{z.zona}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(z.vehicles)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(z.fines)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(z.alerts)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtUSD(z.payments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

function AnalyticsPageProtected() {
  return (
    <RequirePermission permission="VIEW_ANALYTICS">
      <AnalyticsPage />
    </RequirePermission>
  );
}
