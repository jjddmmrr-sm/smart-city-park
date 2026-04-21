import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { KpiTile, Panel, StatusPill } from "@/components/ui-bits";
import { FilterBar, FilterField, FilterSelect, FilterDate, FilterDivider, FilterBtn } from "@/components/FilterBar";
import { MULTAS, MULTAS_RESUMEN, ZONES, type Multa } from "@/lib/data";
import { fmtInt, fmtUSD, ISSUE_LABEL } from "@/lib/format";
import { Receipt, FileWarning, AlertTriangle, CheckCircle2, X, Camera, Download, RotateCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/multas")({
  head: () => ({
    meta: [
      { title: "Multas — Smart Park Chone" },
      { name: "description", content: "Gestión de multas: sin pago, exceso de tiempo, zona prohibida y reservada." },
    ],
  }),
  component: MultasPage,
  ssr: false,
});

const MOTIVO_COLORS: Record<string, string> = {
  sin_pago: "#ef4444",
  exceso_tiempo: "#f59e0b",
  zona_prohibida: "#0a2540",
  zona_reservada: "#00d4aa",
};

function MultasPage() {
  const [motivo, setMotivo] = useState("all");
  const [estado, setEstado] = useState("all");
  const [prioridad, setPrioridad] = useState("all");
  const [zona, setZona] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Multa | null>(null);

  const dates = useMemo(() => Array.from(new Set(MULTAS.map((m) => m.fecha_hora.slice(0, 10)))).sort(), []);
  const minD = dates[0] ?? "";
  const maxD = dates[dates.length - 1] ?? "";
  const [from, setFrom] = useState(minD);
  const [to, setTo] = useState(maxD);

  const inRange = (d: string) => (from === "" || d >= from) && (to === "" || d <= to);

  const filtered = useMemo(() => MULTAS.filter((m) => inRange(m.fecha_hora.slice(0, 10))), [from, to]);

  const kpis = useMemo(() => {
    const k = { total: filtered.length, monto: 0, pendientes: 0, pagadas: 0, apeladas: 0, alta: 0 };
    for (const m of filtered) {
      k.monto += m.valor_multa_usd;
      if (m.estado_multa === "pendiente") k.pendientes++;
      if (m.estado_multa === "pagada") k.pagadas++;
      if (m.estado_multa === "apelada") k.apeladas++;
      if (m.prioridad === "alta") k.alta++;
    }
    return k;
  }, [filtered]);

  const trend30 = useMemo(() => {
    const ds = Array.from(new Set(MULTAS_RESUMEN.filter((m) => inRange(m.fecha)).map(m => m.fecha))).sort().slice(-30);
    return ds.map(d => {
      const day = MULTAS_RESUMEN.filter(x => x.fecha === d);
      return {
        date: d.slice(5),
        sin_pago: day.reduce((a, b) => a + b.multas_sin_pago, 0),
        exceso_tiempo: day.reduce((a, b) => a + b.multas_exceso_tiempo, 0),
        zona_prohibida: day.reduce((a, b) => a + b.multas_zona_prohibida, 0),
        zona_reservada: day.reduce((a, b) => a + b.multas_zona_reservada, 0),
      };
    });
  }, [from, to]);

  const breakdown = useMemo(() => {
    const m: Record<string, number> = { sin_pago: 0, exceso_tiempo: 0, zona_prohibida: 0, zona_reservada: 0 };
    for (const x of filtered) m[x.motivo_codigo] = (m[x.motivo_codigo] ?? 0) + 1;
    return Object.entries(m).map(([k, v]) => ({ name: ISSUE_LABEL[k] ?? k, value: v, key: k }));
  }, [filtered]);

  const rows = useMemo(() => {
    const Q = q.trim().toUpperCase();
    return filtered.filter(m =>
      (motivo === "all" || m.motivo_codigo === motivo) &&
      (estado === "all" || m.estado_multa === estado) &&
      (prioridad === "all" || m.prioridad === prioridad) &&
      (zona === "all" || m.zona === zona) &&
      (Q === "" || m.placa.includes(Q) || m.multa_id.includes(Q))
    );
  }, [filtered, motivo, estado, prioridad, zona, q]);

  function reset() {
    setMotivo("all"); setEstado("all"); setPrioridad("all"); setZona("all"); setQ(""); setFrom(minD); setTo(maxD);
  }

  function exportCsv() {
    const header = ["multa_id","fecha_hora","placa","zona","calle","motivo","valor_usd","controlador","evidencia","estado","prioridad"];
    const csv = [header.join(",")].concat(
      rows.slice(0, 5000).map(m => [m.multa_id,m.fecha_hora,m.placa,m.zona,m.calle,m.motivo_codigo,m.valor_multa_usd,m.controlador_id,m.evidencia_foto,m.estado_multa,m.prioridad].join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "smartpark-multas.csv";
    a.click();
  }

  return (
    <div className="h-full flex flex-col bg-surface overflow-auto">
      {/* KPIs */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile label="Multas totales (30d)" value={fmtInt(kpis.total)} sub="emitidas" icon={<Receipt className="h-4 w-4" />} accent="primary" />
          <KpiTile label="Monto recaudable" value={fmtUSD(kpis.monto)} sub="USD" icon={<FileWarning className="h-4 w-4" />} accent="accent" />
          <KpiTile label="Pendientes" value={fmtInt(kpis.pendientes)} sub="por cobrar" icon={<AlertTriangle className="h-4 w-4" />} accent="warning" />
          <KpiTile label="Pagadas" value={fmtInt(kpis.pagadas)} sub="liquidadas" icon={<CheckCircle2 className="h-4 w-4" />} accent="success" />
          <KpiTile label="Apeladas" value={fmtInt(kpis.apeladas)} sub="en disputa" accent="accent" />
          <KpiTile label="Alta prioridad" value={fmtInt(kpis.alta)} sub="atención inmediata" accent="destructive" />
        </div>
      </div>

      {/* Charts */}
      <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="Tendencia diaria por motivo (30d)" className="lg:col-span-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend30} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="sin_pago" stackId="a" fill={MOTIVO_COLORS.sin_pago} name="Sin pago" />
              <Bar dataKey="exceso_tiempo" stackId="a" fill={MOTIVO_COLORS.exceso_tiempo} name="Exceso de tiempo" />
              <Bar dataKey="zona_prohibida" stackId="a" fill={MOTIVO_COLORS.zona_prohibida} name="Zona prohibida" />
              <Bar dataKey="zona_reservada" stackId="a" fill={MOTIVO_COLORS.zona_reservada} name="Zona reservada" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Distribución por motivo" className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {breakdown.map((b) => <Cell key={b.key} fill={MOTIVO_COLORS[b.key]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-y border-border bg-card flex items-center gap-2 flex-wrap">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar placa o ID multa…"
          className="h-8 px-2 text-[12px] rounded-md border border-border bg-card w-56 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Sel value={motivo} onChange={setMotivo} options={[{ v: "all", l: "Todos los motivos" }, { v: "sin_pago", l: "Sin pago" }, { v: "exceso_tiempo", l: "Exceso de tiempo" }, { v: "zona_prohibida", l: "Zona prohibida" }, { v: "zona_reservada", l: "Zona reservada" }]} />
        <Sel value={estado} onChange={setEstado} options={[{ v: "all", l: "Todos los estados" }, { v: "pendiente", l: "Pendiente" }, { v: "notificada", l: "Notificada" }, { v: "pagada", l: "Pagada" }, { v: "apelada", l: "Apelada" }, { v: "anulada", l: "Anulada" }]} />
        <Sel value={prioridad} onChange={setPrioridad} options={[{ v: "all", l: "Todas prioridades" }, { v: "alta", l: "Alta" }, { v: "media", l: "Media" }, { v: "baja", l: "Baja" }]} />
        <Sel value={zona} onChange={setZona} options={[{ v: "all", l: "Todas las zonas" }, ...ZONES.map(z => ({ v: z.zone_name, l: z.zone_name }))]} />
        <div className="flex-1" />
        <span className="text-[12px] text-muted-foreground tabular-nums">{fmtInt(rows.length)} multas</span>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] rounded-md border border-border hover:bg-secondary">
          <Download className="h-3.5 w-3.5" /> Exportar
        </button>
      </div>

      {/* Table + detail */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 p-3">
        <Panel padded={false} className="overflow-hidden min-h-[300px]">
          <div className="overflow-auto h-full max-h-[60vh]">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 z-10 bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>ID</Th><Th>Fecha/Hora</Th><Th>Placa</Th><Th>Zona</Th><Th>Calle</Th>
                  <Th>Motivo</Th><Th className="text-right">Valor</Th><Th>Controlador</Th>
                  <Th>Evidencia</Th><Th>Prioridad</Th><Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((m, i) => (
                  <tr key={m.multa_id} onClick={() => setSelected(m)} className={"border-t border-border hover:bg-surface-2 cursor-pointer " + (i % 2 ? "bg-surface-2/40" : "")}>
                    <td className="px-3 py-1.5 font-mono text-[11px]">{m.multa_id}</td>
                    <td className="px-3 py-1.5 tabular-nums">{m.fecha_hora.replace(" ", " · ")}</td>
                    <td className="px-3 py-1.5 font-mono font-medium">{m.placa}</td>
                    <td className="px-3 py-1.5">{m.zona}</td>
                    <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[160px]">{m.calle}</td>
                    <td className="px-3 py-1.5">{ISSUE_LABEL[m.motivo_codigo] ?? m.motivo_codigo}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">${m.valor_multa_usd.toFixed(2)}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px]">{m.controlador_id}</td>
                    <td className="px-3 py-1.5">{m.evidencia_foto === "si" ? <span className="inline-flex items-center gap-1 text-success"><Camera className="h-3 w-3" /> Sí</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-1.5"><StatusPill status={m.prioridad} /></td>
                    <td className="px-3 py-1.5"><StatusPill status={m.estado_multa} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 500 && (
              <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                Mostrando las primeras 500 de {fmtInt(rows.length)} multas — refine los filtros.
              </div>
            )}
          </div>
        </Panel>

        <Panel title={selected ? "Detalle de multa" : "Seleccione una multa"}>
          {selected ? (
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-mono font-semibold">{selected.multa_id}</span>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <Row k="Placa" v={<span className="font-mono">{selected.placa}</span>} />
              <Row k="Fecha/hora" v={selected.fecha_hora} />
              <Row k="Zona" v={selected.zona} />
              <Row k="Calle" v={selected.calle} />
              <Row k="Motivo" v={ISSUE_LABEL[selected.motivo_codigo] ?? selected.motivo_codigo} />
              <Row k="Valor" v={`$${selected.valor_multa_usd.toFixed(2)}`} />
              <Row k="Controlador" v={selected.controlador_id} />
              <Row k="Evidencia foto" v={selected.evidencia_foto === "si" ? "Sí" : "No"} />
              <Row k="Prioridad" v={<StatusPill status={selected.prioridad} />} />
              <Row k="Estado" v={<StatusPill status={selected.estado_multa} />} />
              <div className="my-2 border-t border-border" />
              <div className="text-muted-foreground">Observación</div>
              <div className="text-[12px] bg-surface-2 rounded p-2 border border-border">{selected.observacion}</div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button className="h-8 text-[12px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Notificar</button>
                <button className="h-8 text-[12px] rounded-md border border-border hover:bg-secondary">Marcar pagada</button>
                <button className="h-8 text-[12px] rounded-md border border-border hover:bg-secondary">Anular</button>
                <button className="h-8 text-[12px] rounded-md border border-border hover:bg-secondary">Ver evidencia</button>
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-muted-foreground">Haga clic en cualquier multa para ver el detalle, evidencia y disparar acciones.</div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={"text-left font-medium px-3 py-2 " + className}>{children}</th>;
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-[12px] rounded-md border border-border bg-card px-2">
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right truncate ml-2">{v}</span></div>;
}
