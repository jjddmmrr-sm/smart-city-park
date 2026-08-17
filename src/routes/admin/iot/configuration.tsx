import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { apiGetAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel } from "@/components/ui-bits";
import { IotPageShell } from "@/components/iot/IotSideNav";

export const Route = createFileRoute("/admin/iot/configuration")({
  component: IotConfigurationPage,
  ssr: false,
});

type GatewayRow = {
  id: string;
  name: string;
  publicBaseUrl: string;
  privateBaseUrl: string | null;
  basePath: string;
  active: boolean;
  provider: {
    name: string;
    active: boolean;
    endpointTemplates: Record<string, string>;
  };
};

type CameraOption = {
  id: string;
  name: string | null;
  code: string | null;
  deviceId: string;
  ipAddress: string | null;
  authMode: string;
  gatewayId: string | null;
};

type LastEvent = { receivedAt: string; externalEventType: string; processingStatus: string };

/**
 * Labels match the Dahua ITSAPI wire vocabulary — see
 * docs/architecture/iot-device-management-foundation.md. Composed as
 * gateway.publicBaseUrl + gateway.basePath + provider.endpointTemplates[key],
 * same rule already implemented by the real ingestion routes. OCCUPANCY_SNAPSHOT
 * has no seeded endpointTemplates entry yet, so it falls back to `/${label}`
 * below — which already resolves to the correct real route
 * (.../NotificationInfo/TimedParkingSpaceInfo).
 */
const CANONICAL_EVENTS: Array<{ key: string; label: string; description?: string }> = [
  { key: "DEVICE_HANDSHAKE", label: "DeviceInfo" },
  { key: "HEARTBEAT", label: "KeepAlive" },
  {
    key: "OCCUPANCY_SNAPSHOT",
    label: "TimedParkingSpaceInfo",
    description: "Estado de plazas — ocupación/liberación.",
  },
  {
    key: "OCCUPANCY_UPDATE",
    label: "ParkingInfo",
    description: "Eventos especiales — principalmente estacionamiento ilegal/zona prohibida.",
  },
];

function getQueryCameraId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("cameraId") ?? "";
}

function IotConfigurationPage() {
  const navigate = useNavigate();
  const [gateways, setGateways] = useState<GatewayRow[]>([]);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [selectedGatewayId, setSelectedGatewayId] = useState<string>("");
  const [selectedCameraId, setSelectedCameraId] = useState<string>(getQueryCameraId());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [lastEvent, setLastEvent] = useState<LastEvent | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    apiGetAuth<GatewayRow[]>("/iot-device-management/gateways")
      .then((rows) => {
        setGateways(rows);
        if (rows.length > 0 && !selectedGatewayId) setSelectedGatewayId(rows[0].id);
      })
      .catch((error) => console.error("Error loading gateways", error));
    apiGetAuth<CameraOption[]>("/iot-device-management/cameras")
      .then(setCameras)
      .catch((error) => console.error("Error loading cameras", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId) ?? null;

  // Selecting a camera pins the gateway configuration to that camera's own
  // assigned gateway, so the URLs shown are exactly what that camera needs.
  useEffect(() => {
    if (selectedCamera?.gatewayId) {
      setSelectedGatewayId(selectedCamera.gatewayId);
    }
  }, [selectedCamera]);

  useEffect(() => {
    if (!selectedCameraId) {
      setLastEvent(null);
      return;
    }
    apiGetAuth<LastEvent[]>(
      `/iot-device-management/monitor/events?cameraId=${selectedCameraId}&limit=1`,
    )
      .then((rows) => setLastEvent(rows[0] ?? null))
      .catch(() => setLastEvent(null));
  }, [selectedCameraId]);

  const selected = gateways.find((g) => g.id === selectedGatewayId) ?? null;

  const endpoints = useMemo(() => {
    if (!selected) return [];
    return CANONICAL_EVENTS.map(({ key, label, description }) => ({
      key,
      label,
      description,
      url:
        selected.publicBaseUrl.replace(/\/$/, "") +
        selected.basePath +
        "/" +
        (selected.provider.endpointTemplates[key] ?? `/${label}`).replace(/^\/+/, ""),
    }));
  }, [selected]);

  const fullConfigText = useMemo(() => {
    if (!selected) return "";
    const lines = [
      `Gateway: ${selected.name}`,
      `Provider: ${selected.provider.name}`,
      `Public URL: ${selected.publicBaseUrl}`,
      `Private URL: ${selected.privateBaseUrl ?? "—"}`,
      ...(selectedCamera
        ? [`DeviceID: ${selectedCamera.deviceId}`, `Auth Mode: ${selectedCamera.authMode}`]
        : []),
      "",
      ...endpoints.map((e) => `${e.label}: ${e.url}`),
    ];
    return lines.join("\n");
  }, [selected, endpoints, selectedCamera]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch (error) {
      console.error("No se pudo copiar al portapapeles", error);
    }
  };

  const testEndpoint = async () => {
    if (!selected) return;
    setTesting(true);
    setTestResult(null);
    const started = performance.now();
    try {
      const response = await fetch(`${selected.publicBaseUrl.replace(/\/$/, "")}/api/v1/health`);
      const elapsed = Math.round(performance.now() - started);
      setTestResult(
        response.ok
          ? { ok: true, message: `Servidor accesible en ${elapsed} ms (HTTP ${response.status}).` }
          : { ok: false, message: `El servidor respondió HTTP ${response.status}.` },
      );
    } catch {
      setTestResult({
        ok: false,
        message:
          "No se pudo alcanzar publicBaseUrl desde este navegador. Si la cámara está en otra red, esto no confirma que ella tampoco pueda — pero si falla incluso desde aquí, revisá firewall/puerto.",
      });
    } finally {
      setTesting(false);
    }
  };

  const isLocalhost = selected ? /localhost|127\.0\.0\.1/.test(selected.publicBaseUrl) : false;

  return (
    <IotPageShell
      title="Configuration"
      description="Configuración lista para copiar en el equipo físico — DeviceInfo, KeepAlive, TimedParkingSpaceInfo y ParkingInfo, compuestos a partir del Provider y Gateway."
    >
      <Panel title="Selección">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
          <label className="block">
            <span className="text-[11px] text-muted-foreground">Provider / Gateway</span>
            <select
              value={selectedGatewayId}
              onChange={(e) => setSelectedGatewayId(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
            >
              {gateways.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.provider.name} — {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-muted-foreground">Cámara (opcional)</span>
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
            >
              <option value="">Ninguna — solo Provider/Gateway</option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.code ?? c.deviceId}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              onClick={testEndpoint}
              disabled={!selected || testing}
              className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-secondary disabled:opacity-50"
            >
              {testing ? "Probando…" : "Probar endpoint"}
            </button>
          </div>
        </div>

        {testResult && (
          <p className={`mt-2 text-[12px] ${testResult.ok ? "text-success" : "text-destructive"}`}>
            {testResult.message}
          </p>
        )}

        {lastEvent && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Último evento recibido de esta cámara: <strong>{lastEvent.externalEventType}</strong> el{" "}
            {new Date(lastEvent.receivedAt).toLocaleString("es-EC")} ({lastEvent.processingStatus})
          </p>
        )}
      </Panel>

      {selected && (
        <>
          {(isLocalhost ||
            !selected.active ||
            !selected.provider.active ||
            (selectedCamera && !selectedCamera.deviceId)) && (
            <Panel title="Validaciones">
              <ul className="space-y-1.5 text-[12px]">
                {isLocalhost && (
                  <Warning text="publicBaseUrl usa localhost — no es alcanzable desde una cámara física en otra red. Actualizá el Gateway con una IP o dominio público antes de configurar el equipo." />
                )}
                {!selected.active && <Warning text="Este Gateway está INACTIVO." />}
                {!selected.provider.active && <Warning text="Este Provider está INACTIVO." />}
                {selectedCamera && !selectedCamera.deviceId && (
                  <Warning text="La cámara seleccionada no tiene DeviceID." />
                )}
              </ul>
            </Panel>
          )}

          <Panel
            title="Configuración completa"
            action={
              <button
                onClick={() => copy("full", fullConfigText)}
                className="h-6 px-2 rounded border border-border text-[11px] hover:bg-secondary inline-flex items-center gap-1"
              >
                {copiedKey === "full" ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copiedKey === "full" ? "Copiado" : "Copiar configuración completa"}
              </button>
            }
          >
            <div className="text-[12px] space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <DetailRow label="Provider" value={selected.provider.name} />
                <CopyRow
                  label="Public URL"
                  value={selected.publicBaseUrl}
                  copied={copiedKey === "server"}
                  onCopy={() => copy("server", selected.publicBaseUrl)}
                />
                <DetailRow label="Private URL" value={selected.privateBaseUrl ?? "—"} />
                <DetailRow label="Base Path" value={selected.basePath} />
                {selectedCamera && <DetailRow label="DeviceID" value={selectedCamera.deviceId} />}
                {selectedCamera && <DetailRow label="Auth Mode" value={selectedCamera.authMode} />}
                {selectedCamera && (
                  <DetailRow label="IP registrada" value={selectedCamera.ipAddress ?? "—"} />
                )}
              </div>
              <div className="border-t border-border pt-3 space-y-3">
                {endpoints.map((e) => (
                  <CopyRow
                    key={e.key}
                    label={e.label}
                    value={e.url}
                    description={e.description}
                    mono
                    copied={copiedKey === e.key}
                    onCopy={() => copy(e.key, e.url)}
                  />
                ))}
              </div>
            </div>
          </Panel>
        </>
      )}
    </IotPageShell>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-warning">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{text}</span>
    </li>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[100px]">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/**
 * Fixed 3-line structure — label / optional description / URL+copy — so all
 * rows share the same columns regardless of whether a row has a
 * description. The URL+copy line never varies in height, keeping the copy
 * button vertically centered the same way on every row.
 */
function CopyRow({
  label,
  value,
  description,
  mono,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  description?: string;
  mono?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="text-muted-foreground font-medium">{label}</div>
      {description && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{description}</p>}
      <div className="mt-1 flex items-center gap-2">
        <code
          className={`flex-1 ${mono ? "font-mono" : ""} text-[11px] bg-surface-2 rounded px-1.5 py-0.5 truncate`}
        >
          {value}
        </code>
        <button
          onClick={onCopy}
          className="h-6 w-6 shrink-0 rounded border border-border grid place-items-center hover:bg-secondary"
          title={`Copiar ${label}`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}
