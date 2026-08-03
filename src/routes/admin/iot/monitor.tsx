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
  parkingSpace: { id: string; code: string } | null;
  validationStatus: string;
  processingStatus: string;
  error: string | null;
  contextIp: string;
  idempotencyKey: string | null;
};

type EventDetail = EventRow & {
  payload: unknown;
  normalizedEvent: unknown;
};

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
  const [viewMode, setViewMode] = useState<"payload" | "normalized" | "error" | null>(null);
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

  const openDetail = (event: EventRow, mode: "payload" | "normalized" | "error") => {
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
            viewMode === "payload"
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
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Fecha</Th>
                <Th>Provider</Th>
                <Th>Cámara</Th>
                <Th>DeviceID</Th>
                <Th>Tipo externo</Th>
                <Th>Tipo canónico</Th>
                <Th>Stall</Th>
                <Th>Space</Th>
                <Th>Validación</Th>
                <Th>Procesamiento</Th>
                <Th>IP origen</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                    {new Date(e.receivedAt).toLocaleString("es-EC")}
                  </td>
                  <td className="px-3 py-2">{e.providerCode ?? "—"}</td>
                  <td className="px-3 py-2">{e.cameraName ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{e.deviceIdRaw}</td>
                  <td className="px-3 py-2">{e.externalEventType}</td>
                  <td className="px-3 py-2">{e.canonicalEventType}</td>
                  <td className="px-3 py-2">{e.externalStallCode ?? "—"}</td>
                  <td className="px-3 py-2">{e.parkingSpace?.code ?? "—"}</td>
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
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
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
                  <td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2 whitespace-nowrap">{children}</th>;
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
