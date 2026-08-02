import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";
import { IotPageShell } from "@/components/iot/IotSideNav";

export const Route = createFileRoute("/admin/iot/mappings")({
  component: IotMappingsPage,
  ssr: false,
});

type CameraOption = { id: string; name: string | null; deviceId: string; code: string | null };
type SpaceOption = { id: string; code: string; label: string | null; status: string };

type MappingRow = {
  id: string;
  externalStallCode: string;
  mappingStatus: string;
  active: boolean;
  firstReportedAt: string;
  lastReportedAt: string;
  parkingSpaceId: string | null;
  parkingSpace: SpaceOption | null;
};

function getQueryCameraId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("cameraId") ?? "";
}

function IotMappingsPage() {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [candidates, setCandidates] = useState<SpaceOption[]>([]);
  const [assigning, setAssigning] = useState<MappingRow | null>(null);
  const [assignSpaceId, setAssignSpaceId] = useState<string>("");
  const [newCode, setNewCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    apiGetAuth<CameraOption[]>("/iot-device-management/cameras")
      .then((rows) => {
        setCameras(rows);
        const fromQuery = getQueryCameraId();
        if (fromQuery && rows.some((r) => r.id === fromQuery)) {
          setSelectedCameraId(fromQuery);
        } else if (rows.length > 0) {
          setSelectedCameraId(rows[0].id);
        }
      })
      .catch((error_) => console.error("Error loading cameras", error_));
  }, [navigate]);

  const loadMappings = (cameraId: string) => {
    if (!cameraId) return;
    apiGetAuth<MappingRow[]>(`/iot-device-management/mappings?cameraId=${cameraId}`)
      .then(setMappings)
      .catch((error_) => console.error("Error loading mappings", error_));
    apiGetAuth<SpaceOption[]>(
      `/iot-device-management/mappings/parking-space-candidates/${cameraId}`,
    )
      .then(setCandidates)
      .catch((error_) => console.error("Error loading parking space candidates", error_));
  };

  useEffect(() => {
    loadMappings(selectedCameraId);
  }, [selectedCameraId]);

  const createMapping = async () => {
    if (!selectedCameraId || !newCode.trim()) return;
    setError(null);
    try {
      await apiPostAuth("/iot-device-management/mappings", {
        cameraId: selectedCameraId,
        externalStallCode: newCode.trim(),
      });
      setNewCode("");
      loadMappings(selectedCameraId);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "No se pudo crear el mapping");
    }
  };

  const openAssign = (mapping: MappingRow) => {
    setAssigning(mapping);
    setAssignSpaceId(mapping.parkingSpaceId ?? "");
  };

  const saveAssign = async () => {
    if (!assigning) return;
    setError(null);
    try {
      await apiPatchAuth(`/iot-device-management/mappings/${assigning.id}`, {
        parkingSpaceId: assignSpaceId || undefined,
        mappingStatus: assignSpaceId ? "MAPPED" : "DISCOVERED",
      });
      setAssigning(null);
      loadMappings(selectedCameraId);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "No se pudo mapear la plaza");
    }
  };

  const setStatus = async (mapping: MappingRow, mappingStatus: string) => {
    setError(null);
    try {
      await apiPatchAuth(`/iot-device-management/mappings/${mapping.id}`, { mappingStatus });
      loadMappings(selectedCameraId);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "No se pudo cambiar el estado");
    }
  };

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId);

  return (
    <IotPageShell
      title="Camera Stall Mappings"
      description="Vínculo entre el código de plaza reportado por la cámara (externalStallCode) y una plaza real (ParkingSpace)."
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
        {selectedCamera && candidates.length === 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Esta cámara no tiene tenant/ciudad/zona asignados todavía (o su zona no tiene plazas) —
            asignalos desde Cameras antes de mapear.
          </p>
        )}
      </Panel>

      <Panel title="Nuevo mapping manual">
        <div className="flex items-end gap-2 text-[12px]">
          <label className="block">
            <span className="text-[11px] text-muted-foreground">externalStallCode</span>
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="ej. A004"
              className="mt-1 h-8 w-48 rounded-md border border-border bg-card px-2 text-[12px]"
            />
          </label>
          <button
            onClick={createMapping}
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90"
          >
            Crear mapping
          </button>
        </div>
        {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
      </Panel>

      {assigning && (
        <Panel
          title={`Mapear ${assigning.externalStallCode}`}
          action={
            <button
              onClick={() => setAssigning(null)}
              className="h-6 px-2 rounded border border-border text-[11px] hover:bg-secondary"
            >
              Cerrar
            </button>
          }
        >
          <div className="flex items-end gap-2 text-[12px]">
            <label className="block">
              <span className="text-[11px] text-muted-foreground">
                Parking Space (mismo tenant/ciudad/zona que la cámara)
              </span>
              <select
                value={assignSpaceId}
                onChange={(e) => setAssignSpaceId(e.target.value)}
                className="mt-1 h-8 w-64 rounded-md border border-border bg-card px-2 text-[12px]"
              >
                <option value="">Sin asignar</option>
                {candidates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} {s.label ? `— ${s.label}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={saveAssign}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90"
            >
              Guardar
            </button>
          </div>
        </Panel>
      )}

      <Panel title={`Mappings (${mappings.length})`} padded={false}>
        <table className="w-full text-[12px]">
          <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Código externo</Th>
              <Th>Parking Space</Th>
              <Th>Estado</Th>
              <Th>Primer reporte</Th>
              <Th>Último reporte</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.id} className="border-t border-border hover:bg-surface-2">
                <td className="px-3 py-2 font-mono text-muted-foreground">{m.externalStallCode}</td>
                <td className="px-3 py-2">
                  {m.parkingSpace ? (m.parkingSpace.label ?? m.parkingSpace.code) : "Sin vincular"}
                </td>
                <td className="px-3 py-2">
                  <StatusPill status={m.mappingStatus.toLowerCase()} />
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {new Date(m.firstReportedAt).toLocaleString("es-EC")}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {new Date(m.lastReportedAt).toLocaleString("es-EC")}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => openAssign(m)}
                      className="h-7 px-2 rounded border border-border hover:bg-secondary"
                    >
                      Mapear
                    </button>
                    {m.mappingStatus !== "ACTIVE" && m.parkingSpaceId && (
                      <button
                        onClick={() => setStatus(m, "ACTIVE")}
                        className="h-7 px-2 rounded border border-border hover:bg-secondary"
                      >
                        Activar
                      </button>
                    )}
                    {m.mappingStatus === "ACTIVE" && (
                      <button
                        onClick={() => setStatus(m, "DISABLED")}
                        className="h-7 px-2 rounded border border-border hover:bg-secondary"
                      >
                        Desactivar
                      </button>
                    )}
                    {m.mappingStatus !== "CONFLICT" && (
                      <button
                        onClick={() => setStatus(m, "CONFLICT")}
                        className="h-7 px-2 rounded border border-border text-destructive hover:bg-secondary"
                      >
                        Marcar conflicto
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {mappings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Todavía no hay códigos reportados por esta cámara.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </IotPageShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2">{children}</th>;
}
