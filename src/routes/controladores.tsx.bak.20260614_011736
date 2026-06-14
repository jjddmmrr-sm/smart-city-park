import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { KpiTile, Panel, StatusPill } from "@/components/ui-bits";
import { CONTROLADORES, CONTROLADORES_PROD, CONTROLADOR_BY_ID } from "@/lib/data";
import { fmtInt } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UserCog, Activity, ShieldCheck, Receipt, Trophy, Clock, X } from "lucide-react";

export const Route = createFileRoute("/controladores")({
  head: () => ({
    meta: [
      { title: "Controladores — Smart Park Chone" },
      { name: "description", content: "Gestión y productividad de controladores en sitio." },
    ],
  }),
  component: ControladoresPage,
  ssr: false,
});

function ControladoresPage() {
  const [zona, setZona] = useState("all");
  const [turno, setTurno] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const ranking = useMemo(() => {
    const map: Record<string, { id: string; insp: number; veh: number; alertas: number; multas: number; resp: number; cierre: number; km: number; days: number }> = {};
    for (const p of CONTROLADORES_PROD) {
      const c = CONTROLADOR_BY_ID[p.controlador_id];
      if (!c) continue;
      if (zona !== "all" && c.zona_asignada !== zona) continue;
      if (turno !== "all" && c.turno !== turno) continue;
      const e = (map[p.controlador_id] ??= { id: p.controlador_id, insp: 0, veh: 0, alertas: 0, multas: 0, resp: 0, cierre: 0, km: 0, days: 0 });
      e.insp += p.inspecciones_realizadas;
      e.veh += p.vehiculos_validados;
      e.alertas += p.alertas_emitidas;
      e.multas += p.multas_generadas;
      e.resp += p.tiempo_promedio_respuesta_min;
      e.cierre += p.porcentaje_casos_cerrados;
      e.km += p.recorrido_km;
      e.days += 1;
    }
    return Object.values(map).map(e => {
      const c = CONTROLADOR_BY_ID[e.id];
      const eficiencia = e.days ? +(((e.veh / Math.max(e.insp, 1)) * 0.5 + (e.cierre / e.days / 100) * 0.5) * 100).toFixed(1) : 0;
      return {
        ...e,
        nombre: c.nombre,
        zona: c.zona_asignada,
        turno: c.turno,
        estado: c.estado,
        resp_avg: e.days ? +(e.resp / e.days).toFixed(1) : 0,
        cierre_avg: e.days ? +(e.cierre / e.days).toFixed(1) : 0,
        eficiencia,
      };
    }).sort((a, b) => b.eficiencia - a.eficiencia);
  }, [zona, turno]);

  const totals = useMemo(() => ({
    activos: CONTROLADORES.filter(c => c.estado === "activo").length,
    inspecciones: ranking.reduce((a, b) => a + b.insp, 0),
    multas: ranking.reduce((a, b) => a + b.multas, 0),
    validados: ranking.reduce((a, b) => a + b.veh, 0),
    resp_avg: ranking.length ? +(ranking.reduce((a, b) => a + b.resp_avg, 0) / ranking.length).toFixed(1) : 0,
    cierre_avg: ranking.length ? +(ranking.reduce((a, b) => a + b.cierre_avg, 0) / ranking.length).toFixed(1) : 0,
  }), [ranking]);

  const trendByDay = useMemo(() => {
    const dates = Array.from(new Set(CONTROLADORES_PROD.map(p => p.fecha))).sort().slice(-30);
    return dates.map(d => {
      const day = CONTROLADORES_PROD.filter(x => x.fecha === d);
      return {
        date: d.slice(5),
        inspecciones: day.reduce((a, b) => a + b.inspecciones_realizadas, 0),
        multas: day.reduce((a, b) => a + b.multas_generadas, 0),
      };
    });
  }, []);

  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    const c = CONTROLADOR_BY_ID[selected];
    const last30 = CONTROLADORES_PROD.filter(p => p.controlador_id === selected).slice(-30);
    return { c, series: last30.map(p => ({ date: p.fecha.slice(5), insp: p.inspecciones_realizadas, multas: p.multas_generadas })) };
  }, [selected]);

  const zonas = Array.from(new Set(CONTROLADORES.map(c => c.zona_asignada)));

  return (
    <div className="h-full flex flex-col bg-surface overflow-auto">
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile label="Controladores activos" value={fmtInt(totals.activos)} sub={`${CONTROLADORES.length} en plantilla`} icon={<UserCog className="h-4 w-4" />} accent="primary" />
          <KpiTile label="Inspecciones (60d)" value={fmtInt(totals.inspecciones)} sub="realizadas" icon={<Activity className="h-4 w-4" />} accent="accent" />
          <KpiTile label="Vehículos validados" value={fmtInt(totals.validados)} sub="control en sitio" icon={<ShieldCheck className="h-4 w-4" />} accent="success" />
          <KpiTile label="Multas generadas" value={fmtInt(totals.multas)} sub="emitidas" icon={<Receipt className="h-4 w-4" />} accent="destructive" />
          <KpiTile label="Resp. promedio" value={`${totals.resp_avg} min`} sub="tiempo de atención" icon={<Clock className="h-4 w-4" />} accent="warning" />
          <KpiTile label="Cierre de casos" value={`${totals.cierre_avg}%`} sub="promedio" icon={<Trophy className="h-4 w-4" />} accent="primary" />
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="Tendencia agregada (30d)" className="lg:col-span-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendByDay} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="inspecciones" stroke="#0a2540" strokeWidth={2} dot={false} name="Inspecciones" />
              <Line type="monotone" dataKey="multas" stroke="#ef4444" strokeWidth={2} dot={false} name="Multas" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top 10 por eficiencia" className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ranking.slice(0, 10).map(r => ({ name: r.nombre.split(" ")[0], eficiencia: r.eficiencia }))} layout="vertical" margin={{ top: 4, right: 12, left: 50, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} width={50} />
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="eficiencia" fill="#00d4aa" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="px-4 py-2 border-y border-border bg-card flex items-center gap-2 flex-wrap">
        <Sel value={zona} onChange={setZona} options={[{ v: "all", l: "Todas las zonas" }, ...zonas.map(z => ({ v: z, l: z }))]} />
        <Sel value={turno} onChange={setTurno} options={[{ v: "all", l: "Todos los turnos" }, { v: "mañana", l: "Mañana" }, { v: "tarde", l: "Tarde" }, { v: "mixto", l: "Mixto" }]} />
        <div className="flex-1" />
        <span className="text-[12px] text-muted-foreground tabular-nums">{ranking.length} controladores</span>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 p-3">
        <Panel title="Ranking de productividad (60 días)" padded={false}>
          <div className="overflow-auto max-h-[55vh]">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>#</Th><Th>Controlador</Th><Th>Zona</Th><Th>Turno</Th>
                  <Th className="text-right">Inspec.</Th><Th className="text-right">Validados</Th>
                  <Th className="text-right">Alertas</Th><Th className="text-right">Multas</Th>
                  <Th className="text-right">Resp.</Th><Th className="text-right">Cierre</Th>
                  <Th className="text-right">Eficiencia</Th><Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.id} onClick={() => setSelected(r.id)} className={"border-t border-border hover:bg-surface-2 cursor-pointer " + (i % 2 ? "bg-surface-2/40" : "")}>
                    <td className="px-3 py-1.5 text-muted-foreground tabular-nums w-8">
                      {i < 3 ? <span className={"font-semibold " + (i === 0 ? "text-warning" : i === 1 ? "text-muted-foreground" : "text-accent")}>#{i + 1}</span> : <>#{i + 1}</>}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="font-medium">{r.nombre}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{r.id}</div>
                    </td>
                    <td className="px-3 py-1.5">{r.zona}</td>
                    <td className="px-3 py-1.5 capitalize text-muted-foreground">{r.turno}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(r.insp)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(r.veh)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(r.alertas)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(r.multas)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.resp_avg} min</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.cierre_avg}%</td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <div className="h-1.5 w-16 rounded bg-secondary overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${r.eficiencia}%` }} />
                        </div>
                        <span className="tabular-nums font-medium">{r.eficiencia}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5"><StatusPill status={r.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title={selectedDetail ? "Detalle del controlador" : "Seleccione un controlador"}>
          {selectedDetail ? (
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-semibold">{selectedDetail.c.nombre}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{selectedDetail.c.controlador_id}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <Row k="Zona asignada" v={selectedDetail.c.zona_asignada} />
              <Row k="Turno" v={<span className="capitalize">{selectedDetail.c.turno}</span>} />
              <Row k="Estado" v={<StatusPill status={selectedDetail.c.estado} />} />
              <Row k="Dispositivo" v={selectedDetail.c.dispositivo_id} />
              <Row k="Ingreso" v={selectedDetail.c.fecha_ingreso} />
              <div className="my-2 border-t border-border" />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Actividad últimos 30 días</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selectedDetail.series} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#64748b" }} />
                    <Tooltip contentStyle={{ borderRadius: 6, fontSize: 11 }} />
                    <Bar dataKey="insp" fill="#0a2540" name="Inspec." />
                    <Bar dataKey="multas" fill="#ef4444" name="Multas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-muted-foreground">Haga clic en cualquier controlador para ver su detalle e historial de actividad.</div>
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
