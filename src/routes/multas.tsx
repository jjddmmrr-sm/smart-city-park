import { RequirePermission } from "@/components/RequirePermission";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { KpiTile, Panel, StatusPill } from "@/components/ui-bits";
import {
  FilterBar,
  FilterField,
  FilterSelect,
  FilterDate,
  FilterDivider,
  FilterBtn,
} from "@/components/FilterBar";
import { type Multa, type Zone } from "@/lib/data";
import { apiGetAuth, apiPatchAuth } from "@/lib/api";
import { fmtInt, fmtUSD, ISSUE_LABEL } from "@/lib/format";
import {
  Receipt,
  FileWarning,
  AlertTriangle,
  CheckCircle2,
  X,
  Camera,
  Download,
  RotateCcw,
} from "lucide-react";
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

export const Route = createFileRoute("/multas")({
  head: () => ({
    meta: [
      { title: "Multas — Smart Park Chone" },
      {
        name: "description",
        content: "Gestión de multas: sin pago, exceso de tiempo, zona prohibida y reservada.",
      },
    ],
  }),
  component: MultasPageProtected,
  ssr: false,
});

const MOTIVO_COLORS: Record<string, string> = {
  sin_pago: "#ef4444",
  exceso_tiempo: "#f59e0b",
  zona_prohibida: "#0a2540",
  zona_reservada: "#00d4aa",
};

function shortId(value: string) {
  if (!value) return "—";
  return value.length > 8 ? value.slice(0, 8).toUpperCase() : value;
}

function fineCode(value: string) {
  if (!value) return "MUL-000000";
  return `MUL-${value.slice(0, 8).toUpperCase()}`;
}

function controllerCode(value: string) {
  if (!value || value === "N/A") return "Sin asignar";
  return `CTR-${value.slice(0, 6).toUpperCase()}`;
}

function evidenceLabel(value: string) {
  return value === "si" ? "📷 Disponible" : "Sin evidencia";
}

function cleanZone(value: string) {
  return value === "Smart City Demo" ? "Zona Centro" : value;
}

function fmtDateTime(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeMotivo(value: string) {
  if (value === "no_payment") return "sin_pago";
  if (value === "overstay") return "exceso_tiempo";
  return value;
}

function normalizeStatus(value: string) {
  if (value === "pending") return "pendiente";
  if (value === "paid") return "pagada";
  if (value === "appealed") return "apelada";
  if (value === "cancelled") return "anulada";
  return value;
}

function normalizePriority(value: string) {
  if (value === "high") return "alta";
  if (value === "medium") return "media";
  if (value === "low") return "baja";
  return value;
}

function normalizeMulta(m: Multa): Multa {
  return {
    ...m,
    motivo_codigo: normalizeMotivo(m.motivo_codigo) as Multa["motivo_codigo"],
    estado_multa: normalizeStatus(m.estado_multa) as Multa["estado_multa"],
    prioridad: normalizePriority(m.prioridad) as Multa["prioridad"],
  };
}

function MultasPage() {
  const [multas, setMultas] = useState<Multa[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  async function loadFines() {
    const [multasData, zonesData] = await Promise.all([
      apiGetAuth<Multa[]>("/frontend/fines"),
      apiGetAuth<Zone[]>("/frontend/zones"),
    ]);

    const normalized = multasData.map(normalizeMulta);
    setMultas(normalized);
    setZones(zonesData);

    const loadedDates = Array.from(
      new Set(normalized.map((m) => m.fecha_hora.slice(0, 10))),
    ).sort();
    if (loadedDates.length > 0) {
      setFrom(loadedDates[0]);
      setTo(loadedDates[loadedDates.length - 1]);
    }

    return normalized;
  }

  useEffect(() => {
    loadFines().catch((error) => console.error("Error loading fines", error));
  }, []);

  const [motivo, setMotivo] = useState("all");
  const [estado, setEstado] = useState("all");
  const [prioridad, setPrioridad] = useState("all");
  const [zona, setZona] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Multa | null>(null);

  const dates = useMemo(
    () => Array.from(new Set(multas.map((m) => m.fecha_hora.slice(0, 10)))).sort(),
    [],
  );
  const minD = dates[0] ?? "";
  const maxD = dates[dates.length - 1] ?? "";
  const [from, setFrom] = useState(minD);
  const [to, setTo] = useState(maxD);

  const inRange = (d: string) => (from === "" || d >= from) && (to === "" || d <= to);

  const filtered = useMemo(
    () => multas.filter((m) => inRange(m.fecha_hora.slice(0, 10))),
    [from, to],
  );

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
    const ds = Array.from(new Set(filtered.map((m) => m.fecha_hora.slice(0, 10))))
      .sort()
      .slice(-30);
    return ds.map((d) => {
      const day = filtered.filter((x) => x.fecha_hora.slice(0, 10) === d);
      return {
        date: d.slice(5),
        sin_pago: day.filter((x) => x.motivo_codigo === "sin_pago").length,
        exceso_tiempo: day.filter((x) => x.motivo_codigo === "exceso_tiempo").length,
        zona_prohibida: day.filter((x) => x.motivo_codigo === "zona_prohibida").length,
        zona_reservada: day.filter((x) => x.motivo_codigo === "zona_reservada").length,
      };
    });
  }, [filtered]);

  const breakdown = useMemo(() => {
    const m: Record<string, number> = {
      sin_pago: 0,
      exceso_tiempo: 0,
      zona_prohibida: 0,
      zona_reservada: 0,
    };
    for (const x of filtered) m[x.motivo_codigo] = (m[x.motivo_codigo] ?? 0) + 1;
    return Object.entries(m).map(([k, v]) => ({ name: ISSUE_LABEL[k] ?? k, value: v, key: k }));
  }, [filtered]);

  const rows = useMemo(() => {
    const Q = q.trim().toUpperCase();
    return filtered.filter(
      (m) =>
        (motivo === "all" || m.motivo_codigo === motivo) &&
        (estado === "all" || m.estado_multa === estado) &&
        (prioridad === "all" || m.prioridad === prioridad) &&
        (zona === "all" || m.zona === zona) &&
        (Q === "" || m.placa.includes(Q) || m.multa_id.includes(Q)),
    );
  }, [filtered, motivo, estado, prioridad, zona, q]);

  function reset() {
    setMotivo("all");
    setEstado("all");
    setPrioridad("all");
    setZona("all");
    setQ("");
    setFrom(minD);
    setTo(maxD);
  }

  async function markSelectedPaid() {
    if (!selected) return;

    await apiPatchAuth(`/frontend/fines/${selected.multa_id}/status`, {
      status: "paid",
    });

    const updatedRows = await loadFines();
    const updatedSelected = updatedRows.find((m) => m.multa_id === selected.multa_id);

    if (updatedSelected) {
      setSelected(updatedSelected);
    }
  }

  function notifySelected() {
    if (!selected) return;
    alert(
      `Notificación generada para la multa ${fineCode(selected.multa_id)} de la placa ${selected.placa}`,
    );
  }

  function exportCsv() {
    const header = [
      "multa_id",
      "fecha_hora",
      "placa",
      "zona",
      "calle",
      "motivo",
      "valor_usd",
      "controlador",
      "evidencia",
      "estado",
      "prioridad",
    ];
    const csv = [header.join(",")]
      .concat(
        rows
          .slice(0, 5000)
          .map((m) =>
            [
              m.multa_id,
              m.fecha_hora,
              m.placa,
              m.zona,
              m.calle,
              m.motivo_codigo,
              m.valor_multa_usd,
              m.controlador_id,
              m.evidencia_foto,
              m.estado_multa,
              m.prioridad,
            ].join(","),
          ),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "smartpark-multas.csv";
    a.click();
  }

  return (
    <div className="h-full flex flex-col bg-surface overflow-auto">
      {/* Date filter bar */}
      <FilterBar>
        <FilterField label="Desde">
          <FilterDate value={from} onChange={setFrom} min={minD} max={maxD} />
        </FilterField>
        <FilterField label="Hasta">
          <FilterDate value={to} onChange={setTo} min={minD} max={maxD} />
        </FilterField>
        <FilterBtn
          onClick={() => {
            setFrom(minD);
            setTo(maxD);
          }}
        >
          <RotateCcw className="h-3 w-3" /> Rango total
        </FilterBtn>
        <FilterDivider />
        <span className="text-[11px] text-muted-foreground tabular-nums">
          Periodo: {from || "—"} → {to || "—"}
        </span>
      </FilterBar>

      {/* KPIs */}
      <div className="px-3 py-2 border-b border-border bg-card">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <KpiTile
            label="Multas totales"
            value={fmtInt(kpis.total)}
            sub="emitidas"
            icon={<Receipt className="h-4 w-4" />}
            accent="primary"
          />
          <KpiTile
            label="Monto recaudable"
            value={fmtUSD(kpis.monto)}
            sub="USD"
            icon={<FileWarning className="h-4 w-4" />}
            accent="accent"
          />
          <KpiTile
            label="Pendientes"
            value={fmtInt(kpis.pendientes)}
            sub="por cobrar"
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="warning"
          />
          <KpiTile
            label="Pagadas"
            value={fmtInt(kpis.pagadas)}
            sub="liquidadas"
            icon={<CheckCircle2 className="h-4 w-4" />}
            accent="success"
          />
          <KpiTile
            label="Apeladas"
            value={fmtInt(kpis.apeladas)}
            sub="en disputa"
            accent="accent"
          />
          <KpiTile
            label="Alta prioridad"
            value={fmtInt(kpis.alta)}
            sub="atención inmediata"
            accent="destructive"
          />
        </div>
      </div>

      {/* Charts */}
      <div className="px-3 py-2 grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Panel title="Tendencia diaria por motivo" className="lg:col-span-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend30} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="sin_pago" stackId="a" fill={MOTIVO_COLORS.sin_pago} name="Sin pago" />
              <Bar
                dataKey="exceso_tiempo"
                stackId="a"
                fill={MOTIVO_COLORS.exceso_tiempo}
                name="Exceso de tiempo"
              />
              <Bar
                dataKey="zona_prohibida"
                stackId="a"
                fill={MOTIVO_COLORS.zona_prohibida}
                name="Zona prohibida"
              />
              <Bar
                dataKey="zona_reservada"
                stackId="a"
                fill={MOTIVO_COLORS.zona_reservada}
                name="Zona reservada"
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Distribución por motivo" className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={breakdown}
                dataKey="value"
                nameKey="name"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
              >
                {breakdown.map((b) => (
                  <Cell key={b.key} fill={MOTIVO_COLORS[b.key]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 6, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Filters */}
      <FilterBar>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar placa o ID…"
          className="h-7 px-2 text-[12px] rounded border border-border bg-card w-44 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <FilterDivider />
        <FilterField label="Motivo">
          <FilterSelect
            value={motivo}
            onChange={setMotivo}
            options={[
              { v: "all", l: "Todos" },
              { v: "sin_pago", l: "Sin pago" },
              { v: "exceso_tiempo", l: "Exceso tiempo" },
              { v: "zona_prohibida", l: "Z. prohibida" },
              { v: "zona_reservada", l: "Z. reservada" },
            ]}
          />
        </FilterField>
        <FilterField label="Estado">
          <FilterSelect
            value={estado}
            onChange={setEstado}
            options={[
              { v: "all", l: "Todos" },
              { v: "pendiente", l: "Pendiente" },
              { v: "notificada", l: "Notificada" },
              { v: "pagada", l: "Pagada" },
              { v: "apelada", l: "Apelada" },
              { v: "anulada", l: "Anulada" },
            ]}
          />
        </FilterField>
        <FilterField label="Prioridad">
          <FilterSelect
            value={prioridad}
            onChange={setPrioridad}
            options={[
              { v: "all", l: "Todas" },
              { v: "alta", l: "Alta" },
              { v: "media", l: "Media" },
              { v: "baja", l: "Baja" },
            ]}
          />
        </FilterField>
        <FilterField label="Zona">
          <FilterSelect
            value={zona}
            onChange={setZona}
            options={[
              { v: "all", l: "Todas" },
              ...zones.map((z) => ({ v: z.zone_name, l: z.zone_name })),
            ]}
          />
        </FilterField>
        <FilterBtn onClick={reset}>
          <RotateCcw className="h-3 w-3" /> Limpiar
        </FilterBtn>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {fmtInt(rows.length)} multas
        </span>
        <FilterBtn onClick={exportCsv} variant="primary">
          <Download className="h-3 w-3" /> Exportar
        </FilterBtn>
      </FilterBar>

      {/* Table + detail */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 p-3">
        <Panel padded={false} className="overflow-hidden min-h-[300px]">
          <div className="overflow-auto h-full max-h-[60vh]">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 z-10 bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>ID</Th>
                  <Th>Fecha/Hora</Th>
                  <Th>Placa</Th>
                  <Th>Zona</Th>
                  <Th>Calle</Th>
                  <Th>Motivo</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Controlador</Th>
                  <Th>Evidencia</Th>
                  <Th>Prioridad</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((m, i) => (
                  <tr
                    key={m.multa_id}
                    onClick={() => setSelected(m)}
                    className={
                      "border-t border-border hover:bg-surface-2 cursor-pointer " +
                      (i % 2 ? "bg-surface-2/40" : "")
                    }
                  >
                    <td className="px-3 py-1.5 font-mono text-[11px]">{fineCode(m.multa_id)}</td>
                    <td className="px-3 py-1.5 tabular-nums">{fmtDateTime(m.fecha_hora)}</td>
                    <td className="px-3 py-1.5 font-mono font-medium">{m.placa}</td>
                    <td className="px-3 py-1.5">{cleanZone(m.zona)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[160px]">
                      {m.calle}
                    </td>
                    <td className="px-3 py-1.5">
                      {ISSUE_LABEL[m.motivo_codigo] ?? m.motivo_codigo}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {fmtUSD(m.valor_multa_usd)}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px]">
                      {controllerCode(m.controlador_id)}
                    </td>
                    <td className="px-3 py-1.5">
                      {m.evidencia_foto === "si" ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Camera className="h-3 w-3" /> Disponible
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sin evidencia</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusPill status={m.prioridad} />
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusPill status={m.estado_multa} />
                    </td>
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
                <span className="text-[14px] font-mono font-semibold">
                  {fineCode(selected.multa_id)}
                </span>
                <button
                  onClick={() => setSelected(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Row k="Placa" v={<span className="font-mono">{selected.placa}</span>} />
              <Row k="Fecha/hora" v={fmtDateTime(selected.fecha_hora)} />
              <Row k="Zona" v={cleanZone(selected.zona)} />
              <Row k="Calle" v={selected.calle} />
              <Row k="Motivo" v={ISSUE_LABEL[selected.motivo_codigo] ?? selected.motivo_codigo} />
              <Row k="Valor" v={fmtUSD(selected.valor_multa_usd)} />
              <Row k="Controlador" v={controllerCode(selected.controlador_id)} />
              <Row k="Evidencia" v={evidenceLabel(selected.evidencia_foto)} />
              <Row k="Prioridad" v={<StatusPill status={selected.prioridad} />} />
              <Row k="Estado" v={<StatusPill status={selected.estado_multa} />} />
              <div className="my-2 border-t border-border" />
              <div className="text-muted-foreground">Observación</div>
              <div className="text-[12px] bg-surface-2 rounded p-2 border border-border">
                {selected.observacion}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={notifySelected}
                  className="h-8 text-[12px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Notificar
                </button>
                <button
                  onClick={markSelectedPaid}
                  className="h-8 text-[12px] rounded-md border border-border hover:bg-secondary"
                >
                  Marcar pagada
                </button>
                <button className="h-8 text-[12px] rounded-md border border-border hover:bg-secondary">
                  Anular
                </button>
                <button className="h-8 text-[12px] rounded-md border border-border hover:bg-secondary">
                  Ver evidencia
                </button>
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-muted-foreground">
              Haga clic en cualquier multa para ver el detalle, evidencia y disparar acciones.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={"text-left font-medium px-3 py-2 " + className}>{children}</th>;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right truncate ml-2">{v}</span>
    </div>
  );
}

function MultasPageProtected() {
  return (
    <RequirePermission permission="VIEW_FINES">
      <MultasPage />
    </RequirePermission>
  );
}
