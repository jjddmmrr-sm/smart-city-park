import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Panel, StatusPill } from "@/components/ui-bits";
import { VEHICLES, ZONES, type Vehicle } from "@/lib/data";
import { fmtInt } from "@/lib/format";
import { Download, Search, X } from "lucide-react";

export const Route = createFileRoute("/vehicles")({
  head: () => ({
    meta: [
      { title: "Vehículos — Smart Park Chone" },
      { name: "description", content: "Registros de parqueo, estado de pago y cumplimiento de vehículos." },
    ],
  }),
  component: VehiclesPage,
  ssr: false,
});

function VehiclesPage() {
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("all");
  const [payment, setPayment] = useState("all");
  const [comp, setComp] = useState("all");
  const [date, setDate] = useState("all");
  const [selected, setSelected] = useState<Vehicle | null>(null);

  const dates = useMemo(() => Array.from(new Set(VEHICLES.map((v) => v.date))).sort().reverse(), []);

  const rows = useMemo(() => {
    const Q = q.trim().toUpperCase();
    return VEHICLES.filter((v) =>
      (Q === "" || v.plate.includes(Q) || v.brand.toUpperCase().includes(Q) || v.model.toUpperCase().includes(Q)) &&
      (zone === "all" || v.zone_id === zone) &&
      (payment === "all" || v.payment === payment) &&
      (comp === "all" || v.compliance === comp) &&
      (date === "all" || v.date === date)
    );
  }, [q, zone, payment, comp, date]);

  const visible = rows.slice(0, 400);

  function exportCsv() {
    const header = ["placa","marca","modelo","color","tipo","zona","calle","fecha","inicio","fin","duracion_min","pago","cumplimiento"];
    const csv = [header.join(",")].concat(
      rows.slice(0, 5000).map(v => [v.plate,v.brand,v.model,v.color,v.type,v.zone,v.street,v.date,v.start,v.end,v.duration,v.payment,v.compliance].join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "smartpark-vehiculos.csv";
    a.click();
  }

  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px] max-w-xs relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar placa, marca, modelo…"
            className="w-full h-8 pl-7 pr-2 text-[12px] rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Sel value={zone} onChange={setZone} options={[{ v: "all", l: "Todas las zonas" }, ...ZONES.map((z) => ({ v: z.zone_id, l: z.zone_name }))]} />
        <Sel value={payment} onChange={setPayment} options={[{ v: "all", l: "Todos los pagos" }, { v: "paid", l: "Pagado" }, { v: "partial", l: "Parcial" }, { v: "unpaid", l: "No pagado" }]} />
        <Sel value={comp} onChange={setComp} options={[{ v: "all", l: "Todo cumplimiento" }, { v: "valid", l: "Válido" }, { v: "overstay", l: "Exceso de tiempo" }, { v: "no_payment", l: "Sin pago" }]} />
        <Sel value={date} onChange={setDate} options={[{ v: "all", l: "Todas las fechas" }, ...dates.map((d) => ({ v: d, l: d }))]} />
        <div className="flex-1" />
        <span className="text-[12px] text-muted-foreground tabular-nums">{fmtInt(rows.length)} registros</span>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] rounded-md border border-border hover:bg-secondary">
          <Download className="h-3.5 w-3.5" /> Exportar
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 p-3">
        <Panel padded={false} className="overflow-hidden">
          <div className="overflow-auto h-full">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 z-10 bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Placa</Th><Th>Vehículo</Th><Th>Tipo</Th><Th>Zona</Th><Th>Calle</Th>
                  <Th>Fecha</Th><Th>Inicio</Th><Th>Fin</Th><Th className="text-right">Min</Th>
                  <Th>Pago</Th><Th>Cumplimiento</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((v, i) => (
                  <tr key={v.id} onClick={() => setSelected(v)} className={"border-t border-border hover:bg-surface-2 cursor-pointer " + (i % 2 ? "bg-surface-2/40" : "")}>
                    <td className="px-3 py-1.5 font-mono font-medium">{v.plate}</td>
                    <td className="px-3 py-1.5">{v.brand} <span className="text-muted-foreground">{v.model}</span></td>
                    <td className="px-3 py-1.5 text-muted-foreground">{v.type}</td>
                    <td className="px-3 py-1.5">{v.zone}</td>
                    <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[180px]">{v.street}</td>
                    <td className="px-3 py-1.5 tabular-nums">{v.date}</td>
                    <td className="px-3 py-1.5 tabular-nums">{v.start}</td>
                    <td className="px-3 py-1.5 tabular-nums">{v.end}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{v.duration}</td>
                    <td className="px-3 py-1.5"><StatusPill status={v.payment} /></td>
                    <td className="px-3 py-1.5"><StatusPill status={v.compliance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 400 && (
              <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                Mostrando los primeros 400 de {fmtInt(rows.length)} registros — refine los filtros para reducir.
              </div>
            )}
          </div>
        </Panel>

        <Panel title={selected ? "Detalle del vehículo" : "Seleccione un registro"}>
          {selected ? (
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-mono font-semibold">{selected.plate}</span>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <Row k="Vehículo" v={`${selected.brand} ${selected.model}`} />
              <Row k="Color" v={selected.color} />
              <Row k="Tipo" v={selected.type} />
              <div className="my-1 border-t border-border" />
              <Row k="Zona" v={`${selected.zone_id} · ${selected.zone}`} />
              <Row k="Calle" v={selected.street} />
              <div className="my-1 border-t border-border" />
              <Row k="Fecha" v={selected.date} />
              <Row k="Ventana" v={`${selected.start} → ${selected.end}`} />
              <Row k="Duración" v={`${selected.duration} min`} />
              <Row k="Pago" v={<StatusPill status={selected.payment} />} />
              <Row k="Cumplimiento" v={<StatusPill status={selected.compliance} />} />
            </div>
          ) : (
            <div className="text-[12px] text-muted-foreground">Haga clic en una fila para inspeccionar el detalle del registro.</div>
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
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-[12px] rounded-md border border-border bg-card px-2 focus:outline-none focus:ring-2 focus:ring-ring">
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right truncate ml-2">{v}</span></div>;
}
