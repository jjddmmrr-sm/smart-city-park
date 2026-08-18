import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { apiGetAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";
import { IotPageShell } from "@/components/iot/IotSideNav";

export const Route = createFileRoute("/admin/iot/monitor")({
  component: IotMonitorPage,
  ssr: false,
});

const POLL_MS = 5000;

type CameraOption = { id: string; name: string | null; deviceId: string; code: string | null };
type ProviderOption = { id: string; name: string | null };

type OccupancySnapshotSummary = {
  totalSpaces: number;
  mappedCount: number;
  unmappedCount: number;
  occupiedReceived: number;
  freeReceived: number;
  changedCount: number;
};

type OccupancySnapshotSpaceDetail = {
  externalStallCode: string | null;
  spaceType: number | null;
  receivedUsed: boolean | null;
  normalizedStatus: string | null;
  parkingSpaceCode: string | null;
  mappingStatus: string | null;
  previousStatus: string | null;
  finalStatus: string | null;
  changed: boolean;
};

type OccupancySnapshotDetail = OccupancySnapshotSummary & {
  spaces: OccupancySnapshotSpaceDetail[];
};

type EventRow = {
  id: string;
  receivedAt: string;
  providerCode: string | null;
  cameraId: string | null;
  cameraName: string | null;
  deviceIdRaw: string;
  externalEventType: string;
  canonicalEventType: string;
  externalStallCode: string | null;
  externalParkingStatus: number | null;
  normalizedParkingStatus: string | null;
  parkingSpace: { id: string; code: string } | null;
  parkingSpaceCode: string | null;
  parkingSpaceCurrentStatus: string | null;
  statusChanged: boolean;
  duplicate: boolean;
  validationStatus: string;
  processingStatus: string;
  error: string | null;
  contextIp: string;
  idempotencyKey: string | null;
  occupancySnapshot: OccupancySnapshotSummary | null;
};

type MappingUsed = {
  id: string;
  externalStallCode: string;
  mappingStatus: string;
  parkingSpaceCode: string | null;
} | null;

type StatusHistoryEntry = {
  previousStatus: string;
  newStatus: string;
  changedAt: string;
} | null;

type EventDetail = Omit<EventRow, "occupancySnapshot"> & {
  payload: unknown;
  normalizedEvent: unknown;
  mappingUsed: MappingUsed;
  statusHistory: StatusHistoryEntry;
  occupancySnapshot: OccupancySnapshotDetail | null;
};

const PARKING_STATUS_LABEL: Record<number, string> = {
  0: "Ocupada",
  1: "Disponible",
  2: "Desconocida",
  3: "Ilegal",
  4: "Detección",
  7: "Ilegal",
};

const NORMALIZED_STATUS_BADGE: Record<string, { es: string; cls: string }> = {
  OCCUPIED: { es: "Ocupada", cls: "bg-destructive/10 text-destructive" },
  AVAILABLE: { es: "Disponible", cls: "bg-success/10 text-success" },
  UNKNOWN: { es: "Desconocida", cls: "bg-muted text-muted-foreground" },
  ILLEGAL: { es: "Ilegal", cls: "bg-destructive/10 text-destructive" },
  DETECTION: { es: "Detección", cls: "bg-info/10 text-info" },
};

const SPACE_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  occupied: { label: "Ocupada", cls: "bg-destructive/10 text-destructive" },
  available: { label: "Disponible", cls: "bg-success/10 text-success" },
};

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span
      className={
        "inline-flex items-center px-2 h-5 rounded text-[11px] font-medium whitespace-nowrap " +
        className
      }
    >
      {text}
    </span>
  );
}

function StallCell({ event }: { event: EventRow }) {
  if (event.occupancySnapshot) {
    return <span>{event.occupancySnapshot.totalSpaces} plazas</span>;
  }
  return <span>{event.externalStallCode ?? "—"}</span>;
}

function SpaceCell({ event }: { event: EventRow }) {
  if (event.occupancySnapshot) {
    const { mappedCount, unmappedCount } = event.occupancySnapshot;
    return (
      <span>
        {mappedCount} mapeada{mappedCount === 1 ? "" : "s"} / {unmappedCount} sin mapear
      </span>
    );
  }
  return <span>{event.parkingSpaceCode ?? event.parkingSpace?.code ?? "—"}</span>;
}

function ReceivedStatusCell({ event }: { event: EventRow }) {
  if (event.occupancySnapshot) {
    const { occupiedReceived, freeReceived } = event.occupancySnapshot;
    return (
      <Badge
        text={`${occupiedReceived} ocupadas / ${freeReceived} libres`}
        className="bg-muted text-foreground"
      />
    );
  }
  if (event.externalEventType !== "ParkingInfo" || event.externalParkingStatus === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const label = PARKING_STATUS_LABEL[event.externalParkingStatus] ?? "Desconocida";
  return (
    <Badge
      text={`${event.externalParkingStatus} · ${label}`}
      className="bg-muted text-foreground"
    />
  );
}

function NormalizedStatusCell({ event }: { event: EventRow }) {
  if (event.occupancySnapshot) {
    const { occupiedReceived, freeReceived } = event.occupancySnapshot;
    return (
      <Badge
        text={`${occupiedReceived} OCCUPIED / ${freeReceived} AVAILABLE`}
        className="bg-muted text-muted-foreground"
      />
    );
  }
  if (event.externalEventType !== "ParkingInfo" || !event.normalizedParkingStatus) {
    return <span className="text-muted-foreground">—</span>;
  }
  const cfg = NORMALIZED_STATUS_BADGE[event.normalizedParkingStatus] ?? {
    es: event.normalizedParkingStatus,
    cls: "bg-muted text-muted-foreground",
  };
  return <Badge text={`${event.normalizedParkingStatus} / ${cfg.es}`} className={cfg.cls} />;
}

function FinalSpaceStatusCell({ event }: { event: EventRow }) {
  if (event.occupancySnapshot) {
    const { changedCount, mappedCount, unmappedCount } = event.occupancySnapshot;
    const unchangedMapped = mappedCount - changedCount;
    const parts = [`${changedCount} cambio${changedCount === 1 ? "" : "s"}`];
    if (unchangedMapped > 0) parts.push(`${unchangedMapped} sin cambio`);
    if (unmappedCount > 0) parts.push(`${unmappedCount} sin mapear`);
    return (
      <Badge
        text={parts.join(" / ")}
        className={
          changedCount > 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
        }
      />
    );
  }
  if (event.externalEventType !== "ParkingInfo") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (!event.parkingSpaceCurrentStatus) {
    return <Badge text="Desconocida" className="bg-muted text-muted-foreground" />;
  }
  const cfg = SPACE_STATUS_BADGE[event.parkingSpaceCurrentStatus] ?? {
    label: "Desconocida",
    cls: "bg-muted text-muted-foreground",
  };
  return <Badge text={cfg.label} className={cfg.cls} />;
}

function extractParkingInfoBlock(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const picture = (payload as Record<string, unknown>).Picture;
  if (!picture || typeof picture !== "object") return null;
  const parkingInfo = (picture as Record<string, unknown>).ParkingInfo;
  return parkingInfo && typeof parkingInfo === "object"
    ? (parkingInfo as Record<string, unknown>)
    : null;
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-right">{value}</span>
    </div>
  );
}

function ParkingInfoSummary({ detail }: { detail: EventDetail }) {
  const block = extractParkingInfoBlock(detail.payload);
  return (
    <div className="text-[12px] space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
          Payload Picture.ParkingInfo
        </p>
        <SummaryRow label="DeviceID" value={String(block?.DeviceID ?? "—")} />
        <SummaryRow label="ParkingStallsNo" value={String(block?.ParkingStallsNo ?? "—")} />
        <SummaryRow
          label="ParkingStatus"
          value={
            detail.externalParkingStatus !== null
              ? `${detail.externalParkingStatus} (${PARKING_STATUS_LABEL[detail.externalParkingStatus] ?? "?"})`
              : "—"
          }
        />
        <SummaryRow label="SnapTime" value={String(block?.SnapTime ?? "—")} />
        {!block?.ParkingStallsNo && (
          <SummaryRow label="DetectRegionName" value={String(block?.DetectRegionName ?? "—")} />
        )}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
          Mapping utilizado
        </p>
        {detail.mappingUsed ? (
          <>
            <SummaryRow label="mappingId" value={detail.mappingUsed.id} />
            <SummaryRow label="externalStallCode" value={detail.mappingUsed.externalStallCode} />
            <SummaryRow label="mappingStatus" value={detail.mappingUsed.mappingStatus} />
            <SummaryRow label="ParkingSpace" value={detail.mappingUsed.parkingSpaceCode ?? "—"} />
          </>
        ) : (
          <p className="text-muted-foreground">Sin mapping resuelto para este código.</p>
        )}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
          Cambio de estado de la plaza
        </p>
        {detail.statusHistory ? (
          <>
            <SummaryRow label="Estado anterior" value={detail.statusHistory.previousStatus} />
            <SummaryRow label="Estado nuevo" value={detail.statusHistory.newStatus} />
            <SummaryRow
              label="Cambiado el"
              value={new Date(detail.statusHistory.changedAt).toLocaleString("es-EC")}
            />
            <SummaryRow label="¿Creó ParkingSpaceStatusHistory?" value="Sí" />
          </>
        ) : (
          <SummaryRow
            label="¿Creó ParkingSpaceStatusHistory?"
            value={detail.duplicate ? "No (duplicado/idempotente)" : "No (sin cambio de estado)"}
          />
        )}
      </div>
    </div>
  );
}

function ChangedCell({ event }: { event: EventRow }) {
  if (event.occupancySnapshot) {
    const { changedCount } = event.occupancySnapshot;
    return changedCount > 0 ? (
      <Badge text={`Sí (${changedCount})`} className="bg-success/10 text-success" />
    ) : (
      <Badge text="No" className="bg-muted text-muted-foreground" />
    );
  }
  if (event.externalEventType !== "ParkingInfo") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (event.duplicate) {
    return <Badge text="Duplicado" className="bg-warning/10 text-warning" />;
  }
  return event.statusChanged ? (
    <Badge text="Sí" className="bg-success/10 text-success" />
  ) : (
    <Badge text="No" className="bg-muted text-muted-foreground" />
  );
}

function OccupancySnapshotTable({ snapshot }: { snapshot: OccupancySnapshotDetail }) {
  return (
    <div className="text-[12px]">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>{snapshot.totalSpaces} plazas</span>
        <span>
          {snapshot.mappedCount} mapeada{snapshot.mappedCount === 1 ? "" : "s"} /{" "}
          {snapshot.unmappedCount} sin mapear
        </span>
        <span>
          {snapshot.occupiedReceived} ocupadas / {snapshot.freeReceived} libres
        </span>
        <span>
          {snapshot.changedCount} cambio{snapshot.changedCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-auto max-h-80 border border-border rounded">
        <table className="w-full text-[11px]">
          <thead className="bg-surface-2 sticky top-0">
            <tr>
              <Th>Código</Th>
              <Th>Recibido</Th>
              <Th>Normalizado</Th>
              <Th>ParkingSpace</Th>
              <Th>Estado anterior</Th>
              <Th>Estado final</Th>
              <Th>Cambió</Th>
            </tr>
          </thead>
          <tbody>
            {snapshot.spaces.map((s, i) => (
              <tr key={`${s.externalStallCode ?? "?"}-${i}`} className="border-t border-border">
                <td className="px-2 py-1 font-mono whitespace-nowrap">
                  {s.externalStallCode ?? "—"}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {s.receivedUsed === null ? "—" : `Used=${s.receivedUsed}`}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">{s.normalizedStatus ?? "—"}</td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {s.parkingSpaceCode ?? "Sin mapear"}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">{s.previousStatus ?? "—"}</td>
                <td className="px-2 py-1 whitespace-nowrap">{s.finalStatus ?? "—"}</td>
                <td className="px-2 py-1 whitespace-nowrap">{s.changed ? "Sí" : "No"}</td>
              </tr>
            ))}
            {snapshot.spaces.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                  Sin plazas en este snapshot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Filters = {
  cameraId: string;
  providerId: string;
  eventType: string;
  validationStatus: string;
  processingStatus: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = {
  cameraId: "",
  providerId: "",
  eventType: "",
  validationStatus: "",
  processingStatus: "",
  from: "",
  to: "",
};

function getQueryCameraId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("cameraId") ?? "";
}

function IotMonitorPage() {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    cameraId: getQueryCameraId(),
  });
  const [events, setEvents] = useState<EventRow[]>([]);
  const [viewing, setViewing] = useState<EventDetail | null>(null);
  const [viewMode, setViewMode] = useState<"summary" | "payload" | "normalized" | "error" | null>(
    null,
  );
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    apiGetAuth<CameraOption[]>("/iot-device-management/cameras")
      .then(setCameras)
      .catch(() => {});
    apiGetAuth<ProviderOption[]>("/iot-device-management/providers")
      .then(setProviders)
      .catch(() => {});
  }, [navigate]);

  const load = () => {
    const f = filtersRef.current;
    const params = new URLSearchParams();
    if (f.cameraId) params.set("cameraId", f.cameraId);
    if (f.providerId) params.set("providerId", f.providerId);
    if (f.eventType) params.set("eventType", f.eventType);
    if (f.validationStatus) params.set("validationStatus", f.validationStatus);
    if (f.processingStatus) params.set("processingStatus", f.processingStatus);
    if (f.from) params.set("from", new Date(f.from).toISOString());
    if (f.to) params.set("to", new Date(f.to).toISOString());
    const qs = params.toString();

    apiGetAuth<EventRow[]>(`/iot-device-management/monitor/events${qs ? `?${qs}` : ""}`)
      .then(setEvents)
      .catch((error) => console.error("Error loading monitor events", error));
  };

  useEffect(() => {
    if (!isAuthenticated()) return;
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [filters]);

  const openDetail = (event: EventRow, mode: "summary" | "payload" | "normalized" | "error") => {
    apiGetAuth<EventDetail>(`/iot-device-management/monitor/events/${event.id}`)
      .then((detail) => {
        setViewing(detail);
        setViewMode(mode);
      })
      .catch((error) => console.error("Error loading event detail", error));
  };

  return (
    <IotPageShell
      title="Monitor"
      description={`Eventos en tiempo real (actualiza cada ${POLL_MS / 1000}s).`}
      actions={
        <button
          onClick={load}
          className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-secondary"
        >
          Refrescar
        </button>
      }
    >
      <Panel title="Filtros">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
          <FilterSelect
            label="Cámara"
            value={filters.cameraId}
            onChange={(v) => setFilters({ ...filters, cameraId: v })}
            options={cameras.map((c) => ({ value: c.id, label: c.name ?? c.code ?? c.deviceId }))}
          />
          <FilterSelect
            label="Provider"
            value={filters.providerId}
            onChange={(v) => setFilters({ ...filters, providerId: v })}
            options={providers.map((p) => ({ value: p.id, label: p.name ?? p.id }))}
          />
          <FilterSelect
            label="Tipo"
            value={filters.eventType}
            onChange={(v) => setFilters({ ...filters, eventType: v })}
            options={[
              { value: "DeviceInfo", label: "DeviceInfo" },
              { value: "KeepAlive", label: "KeepAlive" },
              { value: "TimedParkingSpaceInfo", label: "TimedParkingSpaceInfo" },
              { value: "ParkingInfo", label: "ParkingInfo" },
            ]}
          />
          <FilterSelect
            label="Validación"
            value={filters.validationStatus}
            onChange={(v) => setFilters({ ...filters, validationStatus: v })}
            options={[
              { value: "VALID", label: "VALID" },
              { value: "INVALID", label: "INVALID" },
              { value: "PENDING", label: "PENDING" },
            ]}
          />
          <FilterSelect
            label="Procesamiento"
            value={filters.processingStatus}
            onChange={(v) => setFilters({ ...filters, processingStatus: v })}
            options={[
              { value: "PENDING", label: "PENDING" },
              { value: "PROCESSED", label: "PROCESSED" },
              { value: "FAILED", label: "FAILED" },
            ]}
          />
          <label className="block">
            <span className="text-[11px] text-muted-foreground">Desde</span>
            <input
              type="datetime-local"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted-foreground">Hasta</span>
            <input
              type="datetime-local"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-secondary"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </Panel>

      {viewing && viewMode && (
        <Panel
          title={
            viewMode === "summary"
              ? "Resumen ParkingInfo"
              : viewMode === "payload"
                ? "Payload RAW"
                : viewMode === "normalized"
                  ? "Evento normalizado"
                  : "Error"
          }
          action={
            <button
              onClick={() => {
                setViewing(null);
                setViewMode(null);
              }}
              className="h-6 px-2 rounded border border-border text-[11px] hover:bg-secondary"
            >
              Cerrar
            </button>
          }
        >
          {viewMode === "error" ? (
            <p className="text-[12px] text-destructive">
              {viewing.error ?? "Sin error registrado."}
            </p>
          ) : viewMode === "summary" ? (
            <ParkingInfoSummary detail={viewing} />
          ) : viewMode === "normalized" && viewing.occupancySnapshot ? (
            <OccupancySnapshotTable snapshot={viewing.occupancySnapshot} />
          ) : (
            <pre className="bg-surface-2 rounded p-2 text-[11px] overflow-auto max-h-80">
              {JSON.stringify(
                viewMode === "payload" ? viewing.payload : viewing.normalizedEvent,
                null,
                2,
              )}
            </pre>
          )}
        </Panel>
      )}

      <Panel title={`Eventos (${events.length})`} padded={false}>
        {/* Scroll (horizontal + vertical) is scoped to this block only — never the page. */}
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full min-w-[2000px] text-[12px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 z-20">
              <tr>
                <Th className="sticky left-0 z-30 min-w-[150px] border-r border-border bg-surface-2">
                  Fecha
                </Th>
                <Th className="min-w-[110px]">Provider</Th>
                <Th className="min-w-[140px]">Cámara</Th>
                <Th className="min-w-[130px]">DeviceID</Th>
                <Th className="min-w-[140px]">Tipo externo</Th>
                <Th className="min-w-[150px]">Tipo canónico</Th>
                <Th className="min-w-[110px]">Stall</Th>
                <Th className="min-w-[170px]">Space</Th>
                <Th className="min-w-[160px]">Estado recibido</Th>
                <Th className="min-w-[180px]">Estado normalizado</Th>
                <Th className="min-w-[180px]">Estado final</Th>
                <Th className="min-w-[110px]">Cambió</Th>
                <Th className="min-w-[110px]">Validación</Th>
                <Th className="min-w-[130px]">Procesamiento</Th>
                <Th className="min-w-[120px]">IP origen</Th>
                <Th className="sticky right-0 z-30 min-w-[230px] border-l border-border bg-surface-2">
                  Acciones
                </Th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="group border-t border-border hover:bg-surface-2">
                  <td className="sticky left-0 z-10 border-r border-border bg-card px-3 py-2 tabular-nums whitespace-nowrap group-hover:bg-surface-2">
                    {new Date(e.receivedAt).toLocaleString("es-EC")}
                  </td>
                  <td className="px-3 py-2">{e.providerCode ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[140px] truncate" title={e.cameraName ?? "—"}>
                    {e.cameraName ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground" title={e.deviceIdRaw}>
                    {e.deviceIdRaw.length > 18
                      ? `${e.deviceIdRaw.slice(0, 8)}…${e.deviceIdRaw.slice(-5)}`
                      : e.deviceIdRaw}
                  </td>
                  <td className="px-3 py-2 max-w-[110px] truncate" title={e.externalEventType}>
                    {e.externalEventType}
                  </td>
                  <td className="px-3 py-2">{e.canonicalEventType}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <StallCell event={e} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <SpaceCell event={e} />
                  </td>
                  <td className="px-3 py-2">
                    <ReceivedStatusCell event={e} />
                  </td>
                  <td className="px-3 py-2">
                    <NormalizedStatusCell event={e} />
                  </td>
                  <td className="px-3 py-2">
                    <FinalSpaceStatusCell event={e} />
                  </td>
                  <td className="px-3 py-2">
                    <ChangedCell event={e} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill
                      status={
                        e.validationStatus === "VALID"
                          ? "activo"
                          : e.validationStatus === "INVALID"
                            ? "unpaid"
                            : "pendiente"
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill
                      status={
                        e.processingStatus === "PROCESSED"
                          ? "activo"
                          : e.processingStatus === "FAILED"
                            ? "unpaid"
                            : "pendiente"
                      }
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{e.contextIp}</td>
                  <td className="sticky right-0 z-10 border-l border-border bg-card px-3 py-2 group-hover:bg-surface-2">
                    <div className="flex flex-wrap gap-1">
                      {e.externalEventType === "ParkingInfo" && (
                        <button
                          onClick={() => openDetail(e, "summary")}
                          className="h-7 px-2 rounded border border-border hover:bg-secondary"
                        >
                          Resumen
                        </button>
                      )}
                      <button
                        onClick={() => openDetail(e, "payload")}
                        className="h-7 px-2 rounded border border-border hover:bg-secondary"
                      >
                        Payload
                      </button>
                      <button
                        onClick={() => openDetail(e, "normalized")}
                        className="h-7 px-2 rounded border border-border hover:bg-secondary"
                      >
                        Normalizado
                      </button>
                      {e.error && (
                        <button
                          onClick={() => openDetail(e, "error")}
                          className="h-7 px-2 rounded border border-border text-destructive hover:bg-secondary"
                        >
                          Error
                        </button>
                      )}
                      {e.cameraId && (
                        <a
                          href={`/admin/iot/cameras`}
                          className="h-7 px-2 rounded border border-border inline-flex items-center hover:bg-secondary"
                        >
                          Cámara
                        </a>
                      )}
                      {e.cameraId && e.externalStallCode && (
                        <a
                          href={`/admin/iot/mappings?cameraId=${e.cameraId}`}
                          className="h-7 px-2 rounded border border-border inline-flex items-center hover:bg-secondary"
                        >
                          Mapping
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={16} className="px-3 py-6 text-center text-muted-foreground">
                    Sin eventos para los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </IotPageShell>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={"text-left font-medium px-3 py-2 whitespace-nowrap " + className}>{children}</th>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
