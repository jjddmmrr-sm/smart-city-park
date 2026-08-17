import { RequirePermission } from "@/components/RequirePermission";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Panel, StatusPill } from "@/components/ui-bits";
import {
  FilterBar,
  FilterField,
  FilterSelect,
  FilterDate,
  FilterDivider,
  FilterBtn,
} from "@/components/FilterBar";
import { type Vehicle, type Zone } from "@/lib/data";
import { apiGetAuth } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import { Download, Search, X, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/vehicles")({
  head: () => ({
    meta: [
      { title: "Vehículos — Smart Park Chone" },
      {
        name: "description",
        content: "Registros de parqueo, estado de pago y cumplimiento de vehículos.",
      },
    ],
  }),
  component: VehiclesPageProtected,
  ssr: false,
});

function fmtDateOnly(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

function cleanValue(value: string) {
  return !value || value === "N/A" ? "No registrado" : value;
}

function cleanVehicle(v: Vehicle) {
  const brand = cleanValue(v.brand);
  const model = cleanValue(v.model);
  if (brand === "No registrado" && model === "No registrado") return "No registrado";
  return `${brand} ${model}`;
}

function cleanType(value: string) {
  if (value === "vehicle") return "Vehículo";
  if (value === "motorcycle") return "Motocicleta";
  return value;
}

function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    Promise.all([
      apiGetAuth<Vehicle[]>("/frontend/vehicles"),
      apiGetAuth<Zone[]>("/frontend/zones"),
    ])
      .then(([vehiclesData, zonesData]) => {
        setVehicles(vehiclesData);
        setZones(zonesData);
      })
      .catch((error) => console.error("Error loading vehicles", error));
  }, []);

  const [q, setQ] = useState("");
  const [zone, setZone] = useState("all");
  const [payment, setPayment] = useState("all");
  const [comp, setComp] = useState("all");
  const dates = useMemo(() => Array.from(new Set(vehicles.map((v) => v.date))).sort(), [vehicles]);
  const minD = dates[0] ?? "";
  const maxD = dates[dates.length - 1] ?? "";
  const [from, setFrom] = useState(minD);
  const [to, setTo] = useState(maxD);
  const [selected, setSelected] = useState<Vehicle | null>(null);

  const rows = useMemo(() => {
    const Q = q.trim().toUpperCase();
    return vehicles.filter(
      (v) =>
        (Q === "" ||
          v.plate.includes(Q) ||
          v.brand.toUpperCase().includes(Q) ||
          v.model.toUpperCase().includes(Q)) &&
        (zone === "all" || v.zone_id === zone) &&
        (payment === "all" || v.payment === payment) &&
        (comp === "all" || v.compliance === comp) &&
        (from === "" || v.date >= from) &&
        (to === "" || v.date <= to),
    );
  }, [vehicles, q, zone, payment, comp, from, to]);

  const visible = rows.slice(0, 400);

  function reset() {
    setQ("");
    setZone("all");
    setPayment("all");
    setComp("all");
    setFrom(minD);
    setTo(maxD);
  }

  function exportCsv() {
    const header = [
      "placa",
      "marca",
      "modelo",
      "color",
      "tipo",
      "zona",
      "calle",
      "fecha",
      "inicio",
      "fin",
      "duracion_min",
      "pago",
      "cumplimiento",
    ];
    const csv = [header.join(",")]
      .concat(
        rows
          .slice(0, 5000)
          .map((v) =>
            [
              v.plate,
              v.brand,
              v.model,
              v.color,
              v.type,
              v.zone,
              v.street,
              v.date,
              v.start,
              v.end,
              v.duration,
              v.payment,
              v.compliance,
            ].join(","),
          ),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "smartpark-vehiculos.csv";
    a.click();
  }

  return (
    <div className="h-full flex flex-col bg-surface">
      <FilterBar>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar placa, marca, modelo…"
            className="w-full h-7 pl-7 pr-2 text-[12px] rounded border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <FilterDivider />
        <FilterField label="Desde">
          <FilterDate value={from} onChange={setFrom} min={minD} max={maxD} />
        </FilterField>
        <FilterField label="Hasta">
          <FilterDate value={to} onChange={setTo} min={minD} max={maxD} />
        </FilterField>
        <FilterDivider />
        <FilterField label="Zona">
          <FilterSelect
            value={zone}
            onChange={setZone}
            options={[
              { v: "all", l: "Todas" },
              ...zones.map((z) => ({ v: z.zone_id, l: z.zone_name })),
            ]}
          />
        </FilterField>
        <FilterField label="Pago">
          <FilterSelect
            value={payment}
            onChange={setPayment}
            options={[
              { v: "all", l: "Todos" },
              { v: "paid", l: "Pagado" },
              { v: "partial", l: "Parcial" },
              { v: "unpaid", l: "No pagado" },
            ]}
          />
        </FilterField>
        <FilterField label="Cumpl.">
          <FilterSelect
            value={comp}
            onChange={setComp}
            options={[
              { v: "all", l: "Todo" },
              { v: "valid", l: "Válido" },
              { v: "overstay", l: "Exceso" },
              { v: "no_payment", l: "Sin pago" },
            ]}
          />
        </FilterField>
        <FilterBtn onClick={reset}>
          <RotateCcw className="h-3 w-3" /> Limpiar
        </FilterBtn>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {fmtInt(rows.length)} registros
        </span>
        <FilterBtn onClick={exportCsv} variant="primary">
          <Download className="h-3 w-3" /> Exportar
        </FilterBtn>
      </FilterBar>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 p-3">
        <Panel padded={false} className="overflow-hidden">
          <div className="overflow-auto h-full">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 z-10 bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Placa</Th>
                  <Th>Vehículo</Th>
                  <Th>Tipo</Th>
                  <Th>Zona</Th>
                  <Th>Calle</Th>
                  <Th>Fecha</Th>
                  <Th>Inicio</Th>
                  <Th>Fin</Th>
                  <Th className="text-right">Min</Th>
                  <Th>Pago</Th>
                  <Th>Cumplimiento</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((v, i) => (
                  <tr
                    key={v.id}
                    onClick={() => setSelected(v)}
                    className={
                      "border-t border-border hover:bg-surface-2 cursor-pointer " +
                      (i % 2 ? "bg-surface-2/40" : "")
                    }
                  >
                    <td className="px-3 py-1.5 font-mono font-medium">{v.plate}</td>
                    <td className="px-3 py-1.5">{cleanVehicle(v)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{cleanType(v.type)}</td>
                    <td className="px-3 py-1.5">{v.zone}</td>
                    <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[180px]">
                      {v.street}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">{v.date}</td>
                    <td className="px-3 py-1.5 tabular-nums">{fmtDateTime(v.start)}</td>
                    <td className="px-3 py-1.5 tabular-nums">{fmtDateTime(v.end)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{v.duration}</td>
                    <td className="px-3 py-1.5">
                      <StatusPill status={v.payment} />
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusPill status={v.compliance} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 400 && (
              <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                Mostrando los primeros 400 de {fmtInt(rows.length)} registros — refine los filtros
                para reducir.
              </div>
            )}
          </div>
        </Panel>

        <Panel title={selected ? "Detalle del vehículo" : "Seleccione un registro"}>
          {selected ? (
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-mono font-semibold">{selected.plate}</span>
                <button
                  onClick={() => setSelected(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Row k="Vehículo" v={cleanVehicle(selected)} />
              <Row k="Color" v={cleanValue(selected.color)} />
              <Row k="Tipo" v={cleanType(selected.type)} />
              <div className="my-1 border-t border-border" />
              <Row k="Zona" v={selected.zone} />
              <Row k="Calle" v={selected.street} />
              <div className="my-1 border-t border-border" />
              <Row k="Fecha" v={fmtDateOnly(selected.date)} />
              <Row
                k="Ventana"
                v={`${fmtDateTime(selected.start)} → ${fmtDateTime(selected.end)}`}
              />
              <Row k="Duración" v={`${selected.duration} min`} />
              <Row k="Pago" v={<StatusPill status={selected.payment} />} />
              <Row k="Cumplimiento" v={<StatusPill status={selected.compliance} />} />
            </div>
          ) : (
            <div className="text-[12px] text-muted-foreground">
              Haga clic en una fila para inspeccionar el detalle del registro.
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

function VehiclesPageProtected() {
  return (
    <RequirePermission permission="VIEW_VEHICLES">
      <VehiclesPage />
    </RequirePermission>
  );
}
