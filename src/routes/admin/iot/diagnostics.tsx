import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiGetAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";
import { IotPageShell } from "@/components/iot/IotSideNav";

export const Route = createFileRoute("/admin/iot/diagnostics")({
  component: IotDiagnosticsPage,
  ssr: false,
});

type CameraOption = { id: string; name: string | null; deviceId: string; code: string | null };

type Rule = { code: string; severity: "ok" | "warning" | "critical"; message: string };

type Diagnostics = {
  camera: {
    id: string;
    name: string | null;
    code: string | null;
    deviceId: string;
    ipAddress: string | null;
    registrationStatus: string;
    status: string;
    provider: { code: string; active: boolean };
    gateway: { code: string; active: boolean } | null;
  };
  online: boolean;
  lastSeenAt: string | null;
  minutesSinceLastSeen: number | null;
  lastDeviceInfoAt: string | null;
  lastParkingInfoAt: string | null;
  events1h: number;
  events24h: number;
  failed24h: number;
  invalid24h: number;
  duplicates24h: number;
  unmappedStallCodes: number;
  conflictingMappings: number;
  rules: Rule[];
};

function getQueryCameraId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("cameraId") ?? "";
}

function IotDiagnosticsPage() {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(getQueryCameraId());
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    apiGetAuth<CameraOption[]>("/iot-device-management/cameras")
      .then((rows) => {
        setCameras(rows);
        if (!selectedCameraId && rows.length > 0) setSelectedCameraId(rows[0].id);
      })
      .catch((error) => console.error("Error loading cameras", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    if (!selectedCameraId) return;
    apiGetAuth<Diagnostics>(`/iot-device-management/diagnostics/${selectedCameraId}`)
      .then(setDiagnostics)
      .catch((error) => console.error("Error loading diagnostics", error));
  }, [selectedCameraId]);

  return (
    <IotPageShell
      title="Diagnostics"
      description="Salud de una cámara específica, calculada con reglas determinísticas (sin IA)."
    >
      <Panel title="Cámara">
        <label className="block text-[12px] max-w-sm">
          <span className="text-[11px] text-muted-foreground">Seleccionar cámara</span>
          <select
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.code ?? c.deviceId}
              </option>
            ))}
          </select>
        </label>
      </Panel>

      {diagnostics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Estado" value={diagnostics.online ? "Online" : "Offline"} />
            <Metric
              label="Último visto"
              value={
                diagnostics.minutesSinceLastSeen !== null
                  ? `hace ${diagnostics.minutesSinceLastSeen} min`
                  : "nunca"
              }
            />
            <Metric label="Eventos 1h" value={String(diagnostics.events1h)} />
            <Metric label="Eventos 24h" value={String(diagnostics.events24h)} />
            <Metric label="Fallidos 24h" value={String(diagnostics.failed24h)} />
            <Metric label="Inválidos 24h" value={String(diagnostics.invalid24h)} />
            <Metric label="Duplicados 24h" value={String(diagnostics.duplicates24h)} />
            <Metric label="Stalls sin mapear" value={String(diagnostics.unmappedStallCodes)} />
          </div>

          <Panel title="Contexto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[12px]">
              <DetailRow label="IP reportada" value={diagnostics.camera.ipAddress ?? "—"} />
              <DetailRow
                label="Provider"
                value={`${diagnostics.camera.provider.code} (${diagnostics.camera.provider.active ? "activo" : "inactivo"})`}
              />
              <DetailRow
                label="Gateway"
                value={
                  diagnostics.camera.gateway
                    ? `${diagnostics.camera.gateway.code} (${diagnostics.camera.gateway.active ? "activo" : "inactivo"})`
                    : "sin asignar"
                }
              />
              <DetailRow label="Registro" value={diagnostics.camera.registrationStatus} />
              <DetailRow
                label="Último DeviceInfo"
                value={
                  diagnostics.lastDeviceInfoAt
                    ? new Date(diagnostics.lastDeviceInfoAt).toLocaleString("es-EC")
                    : "nunca"
                }
              />
              <DetailRow
                label="Último ParkingInfo"
                value={
                  diagnostics.lastParkingInfoAt
                    ? new Date(diagnostics.lastParkingInfoAt).toLocaleString("es-EC")
                    : "nunca"
                }
              />
              <DetailRow
                label="Mappings en conflicto"
                value={String(diagnostics.conflictingMappings)}
              />
            </div>
          </Panel>

          <Panel title="Diagnóstico automático">
            <ul className="space-y-1.5 text-[12px]">
              {diagnostics.rules.map((rule) => (
                <li key={rule.code} className="flex items-center gap-2">
                  <StatusPill
                    status={
                      rule.severity === "ok"
                        ? "activo"
                        : rule.severity === "critical"
                          ? "unpaid"
                          : "pendiente"
                    }
                  />
                  <span>{rule.message}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </IotPageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[16px] font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[150px]">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
