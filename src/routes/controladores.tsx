import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { KpiTile, Panel, StatusPill } from "@/components/ui-bits";
import { fmtInt } from "@/lib/format";
import { apiGet } from "@/lib/api";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UserCog, Activity, ShieldCheck, MapPin, Clock, X } from "lucide-react";

export const Route = createFileRoute("/controladores")({
  head: () => ({
    meta: [
      { title: "Controladores — Smart Park Chone" },
      { name: "description", content: "Gestión de controladores en sitio." },
    ],
  }),
  component: ControladoresPage,
  ssr: false,
});

type ControllerRow = {
  controlador_id: string;
  nombre: string;
  zona_asignada: string;
  turno: string;
  estado: string;
  fecha_ingreso: string;
  dispositivo_id: string;
};

function friendlyId(id: string) {
  return `CTRL-${id.slice(0, 8).toUpperCase()}`;
}

function estadoEs(status: string) {
  if (status === "active" || status === "activo") return "activo";
  if (status === "inactive" || status === "inactivo") return "inactivo";
  return status;
}

function fechaEs(value: string) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("es-EC");
}

function ControladoresPage() {
  const [rows, setRows] = useState<ControllerRow[]>([]);
  const [zona, setZona] = useState("all");
  const [turno, setTurno] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<ControllerRow[]>("/frontend/controllers")
      .then(setRows)
      .catch((error) => console.error("Error loading controllers", error))
      .finally(() => setLoading(false));
  }, []);

  const zonas = useMemo(() => {
    return Array.from(new Set(rows.map(c => c.zona_asignada).filter(Boolean))).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(c => {
      if (zona !== "all" && c.zona_asignada !== zona) return false;
      if (turno !== "all" && c.turno !== turno) return false;
      return true;
    });
  }, [rows, zona, turno]);

  const totals = useMemo(() => {
    const activos = rows.filter(c => estadoEs(c.estado) === "activo").length;
    const zonasAsignadas = new Set(rows.map(c => c.zona_asignada).filter(z => z && z !== "Sin zona asignada")).size;
    const dispositivos = rows.filter(c => c.dispositivo_id && c.dispositivo_id !== "N/A").length;
    return {
      total: rows.length,
      activos,
      inactivos: rows.length - activos,
      zonasAsignadas,
      dispositivos,
      cobertura: rows.length ? Math.round((activos / rows.length) * 100) : 0,
    };
  }, [rows]);

  const chartByZone = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of rows) {
      const z = c.zona_asignada || "Sin zona";
      map[z] = (map[z] || 0) + 1;
    }
    return Object.entries(map).map(([zona, total]) => ({ zona, total }));
  }, [rows]);

  const selectedDetail = useMemo(() => {
    return rows.find(c => c.controlador_id === selected) || null;
  }, [rows, selected]);

  return (
    <div className="h-full flex flex-col bg-surface overflow-auto">
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile label="Controladores" value={fmtInt(totals.total)} sub="plantilla total" icon={<UserCog className="h-4 w-4" />} accent="primary" />
          <KpiTile label="Activos" value={fmtInt(totals.activos)} sub="operativos" icon={<Activity className="h-4 w-4" />} accent="success" />
          <KpiTile label="Inactivos" value={fmtInt(totals.inactivos)} sub="fuera de operación" icon={<ShieldCheck className="h-4 w-4" />} accent="warning" />
          <KpiTile label="Zonas asignadas" value={fmtInt(totals.zonasAsignadas)} sub="cobertura territorial" icon={<MapPin className="h-4 w-4" />} accent="accent" />
          <KpiTile label="Dispositivos" value={fmtInt(totals.dispositivos)} sub="vinculados" icon={<Clock className="h-4 w-4" />} accent="primary" />
          <KpiTile label="Cobertura activa" value={`${totals.cobertura}%`} sub="activos / total" icon={<ShieldCheck className="h-4 w-4" />} accent="success" />
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="Controladores por zona" className="lg:col-span-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartByZone} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="zona" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="total" fill="#00d4aa" name="Controladores" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Resumen operativo" className="h-64">
          <div className="space-y-3 text-[12px]">
            <Row k="Estado del módulo" v={loading ? "Cargando..." : "Conectado a PostgreSQL"} />
            <Row k="Endpoint" v="/frontend/controllers" />
            <Row k="Fuente" v="API NestJS + Prisma" />
            <Row k="Registros" v={fmtInt(rows.length)} />
            <Row k="Filtros activos" v={`${zona !== "all" ? 1 : 0 + (turno !== "all" ? 1 : 0)}`} />
            <div className="border-t border-border pt-3 text-muted-foreground">
              Este módulo ya no usa datos mock. Los controladores se cargan desde backend real.
            </div>
          </div>
        </Panel>
      </div>

      <div className="px-4 py-2 border-y border-border bg-card flex items-center gap-2 flex-wrap">
        <Sel value={zona} onChange={setZona} options={[{ v: "all", l: "Todas las zonas" }, ...zonas.map(z => ({ v: z, l: z }))]} />
        <Sel value={turno} onChange={setTurno} options={[{ v: "all", l: "Todos los turnos" }, { v: "mañana", l: "Mañana" }, { v: "tarde", l: "Tarde" }, { v: "mixto", l: "Mixto" }]} />
        <div className="flex-1" />
        <span className="text-[12px] text-muted-foreground tabular-nums">{filtered.length} controladores</span>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 p-3">
        <Panel title="Plantilla de controladores" padded={false}>
          <div className="overflow-auto max-h-[55vh]">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Código</Th><Th>Controlador</Th><Th>Zona</Th><Th>Turno</Th><Th>Dispositivo</Th><Th>Ingreso</Th><Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.controlador_id} onClick={() => setSelected(r.controlador_id)} className={"border-t border-border hover:bg-surface-2 cursor-pointer " + (i % 2 ? "bg-surface-2/40" : "")}>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{friendlyId(r.controlador_id)}</td>
                    <td className="px-3 py-1.5 font-medium">{r.nombre}</td>
                    <td className="px-3 py-1.5">{r.zona_asignada}</td>
                    <td className="px-3 py-1.5 capitalize text-muted-foreground">{r.turno}</td>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.dispositivo_id}</td>
                    <td className="px-3 py-1.5">{fechaEs(r.fecha_ingreso)}</td>
                    <td className="px-3 py-1.5"><StatusPill status={estadoEs(r.estado)} /></td>
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
                  <div className="text-[14px] font-semibold">{selectedDetail.nombre}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{friendlyId(selectedDetail.controlador_id)}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <Row k="Zona asignada" v={selectedDetail.zona_asignada} />
              <Row k="Turno" v={<span className="capitalize">{selectedDetail.turno}</span>} />
              <Row k="Estado" v={<StatusPill status={estadoEs(selectedDetail.estado)} />} />
              <Row k="Dispositivo" v={selectedDetail.dispositivo_id} />
              <Row k="Ingreso" v={fechaEs(selectedDetail.fecha_ingreso)} />
              <div className="my-2 border-t border-border" />
              <div className="text-muted-foreground">
                Próximo incremento: productividad real por controlador cuando el backend exponga inspecciones, multas y tiempos de respuesta por agente.
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-muted-foreground">Haga clic en cualquier controlador para ver su detalle operativo.</div>
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
