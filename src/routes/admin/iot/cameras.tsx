import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";
import { IotPageShell } from "@/components/iot/IotSideNav";

export const Route = createFileRoute("/admin/iot/cameras")({
  component: IotCamerasPage,
  ssr: false,
});

type RefOption = { id: string; name: string | null; code?: string };

type CameraRow = {
  id: string;
  code: string | null;
  name: string | null;
  location: string | null;
  deviceId: string;
  ipAddress: string | null;
  macAddress: string | null;
  manufacturer: string | null;
  model: string | null;
  firmwareVersion: string | null;
  status: string;
  registrationStatus: string;
  lastSeenAt: string | null;
  tenantId: string | null;
  cityId: string | null;
  zoneId: string | null;
  providerId: string;
  gatewayId: string | null;
  groupId: string | null;
  provider: RefOption | null;
  gateway: RefOption | null;
  group: RefOption | null;
  zone: RefOption | null;
};

type CameraDetail = CameraRow & {
  lastEventsByType: {
    eventType: string;
    receivedAt: string;
    processingStatus: string;
    validationStatus: string;
  }[];
};

type Me = {
  tenant: { id: string; name: string } | null;
  city: { id: string; name: string } | null;
};

type Filters = {
  q: string;
  providerId: string;
  gatewayId: string;
  groupId: string;
  zoneId: string;
  registrationStatus: string;
  online: string;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  providerId: "",
  gatewayId: "",
  groupId: "",
  zoneId: "",
  registrationStatus: "",
  online: "",
};

type EditForm = {
  name: string;
  code: string;
  location: string;
  status: string;
  providerId: string;
  gatewayId: string;
  groupId: string;
  zoneId: string;
};

function IotCamerasPage() {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<CameraRow[]>([]);
  const [providers, setProviders] = useState<RefOption[]>([]);
  const [gateways, setGateways] = useState<RefOption[]>([]);
  const [groups, setGroups] = useState<RefOption[]>([]);
  const [zones, setZones] = useState<RefOption[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [detail, setDetail] = useState<CameraDetail | null>(null);
  const [editing, setEditing] = useState<CameraRow | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.providerId) params.set("providerId", filters.providerId);
    if (filters.gatewayId) params.set("gatewayId", filters.gatewayId);
    if (filters.groupId) params.set("groupId", filters.groupId);
    if (filters.zoneId) params.set("zoneId", filters.zoneId);
    if (filters.registrationStatus) {
      params.set("registrationStatus", filters.registrationStatus);
    }
    if (filters.online) params.set("online", filters.online);
    const qs = params.toString();

    apiGetAuth<CameraRow[]>(`/iot-device-management/cameras${qs ? `?${qs}` : ""}`)
      .then(setCameras)
      .catch((error) => console.error("Error loading cameras", error));
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    apiGetAuth<RefOption[]>("/iot-device-management/providers")
      .then(setProviders)
      .catch(() => {});
    apiGetAuth<RefOption[]>("/iot-device-management/gateways")
      .then(setGateways)
      .catch(() => {});
    apiGetAuth<RefOption[]>("/iot-device-management/groups")
      .then(setGroups)
      .catch(() => {});
    apiGetAuth<RefOption[]>("/parking/zones")
      .then(setZones)
      .catch(() => {});
    apiGetAuth<Me>("/auth/me")
      .then(setMe)
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const openDetail = (camera: CameraRow) => {
    apiGetAuth<CameraDetail>(`/iot-device-management/cameras/${camera.id}`)
      .then(setDetail)
      .catch((error) => console.error("Error loading camera detail", error));
  };

  const openEdit = (camera: CameraRow) => {
    setEditing(camera);
    setForm({
      name: camera.name ?? "",
      code: camera.code ?? "",
      location: camera.location ?? "",
      status: camera.status,
      providerId: camera.providerId,
      gatewayId: camera.gatewayId ?? "",
      groupId: camera.groupId ?? "",
      zoneId: camera.zoneId ?? "",
    });
    setFormError(null);
  };

  const save = async () => {
    if (!editing || !form) return;
    try {
      await apiPatchAuth(`/iot-device-management/cameras/${editing.id}`, {
        name: form.name.trim() || undefined,
        code: form.code.trim() || undefined,
        location: form.location.trim() || undefined,
        status: form.status,
        providerId: form.providerId || undefined,
        gatewayId: form.gatewayId,
        groupId: form.groupId,
        zoneId: form.zoneId,
      });
      setEditing(null);
      setForm(null);
      load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Error al guardar");
    }
  };

  const assignToMyTenant = async (camera: CameraRow) => {
    if (!me?.tenant || !me.city) return;
    await apiPatchAuth(`/iot-device-management/cameras/${camera.id}`, {
      tenantId: me.tenant.id,
      cityId: me.city.id,
    });
    load();
    if (detail?.id === camera.id) openDetail(camera);
  };

  const approve = async (camera: CameraRow) => {
    await apiPostAuth(`/iot-device-management/cameras/${camera.id}/approve`, {});
    load();
    if (detail?.id === camera.id) openDetail(camera);
  };

  const toggleActive = async (camera: CameraRow) => {
    await apiPatchAuth(`/iot-device-management/cameras/${camera.id}`, {
      status: camera.status === "active" ? "inactive" : "active",
    });
    load();
    if (detail?.id === camera.id) openDetail(camera);
  };

  const onlineThresholdMs = 5 * 60 * 1000;
  const isOnline = (c: { lastSeenAt: string | null }) =>
    !!c.lastSeenAt && Date.now() - new Date(c.lastSeenAt).getTime() < onlineThresholdMs;

  const zoneOptions = useMemo(() => zones, [zones]);

  return (
    <IotPageShell
      title="Cameras"
      description="Inventario de cámaras. tenantId/cityId/zoneId se administran únicamente desde aquí — nunca desde un evento de cámara."
    >
      <Panel title="Buscar y filtrar">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
          <label className="block">
            <span className="text-[11px] text-muted-foreground">Buscar</span>
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="nombre, código, DeviceID, IP"
              className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
            />
          </label>
          <FilterSelect
            label="Provider"
            value={filters.providerId}
            onChange={(v) => setFilters({ ...filters, providerId: v })}
            options={providers.map((p) => ({ value: p.id, label: p.name ?? p.id }))}
          />
          <FilterSelect
            label="Gateway"
            value={filters.gatewayId}
            onChange={(v) => setFilters({ ...filters, gatewayId: v })}
            options={gateways.map((g) => ({ value: g.id, label: g.name ?? g.id }))}
          />
          <FilterSelect
            label="Grupo"
            value={filters.groupId}
            onChange={(v) => setFilters({ ...filters, groupId: v })}
            options={groups.map((g) => ({ value: g.id, label: g.name ?? g.id }))}
          />
          <FilterSelect
            label="Zona"
            value={filters.zoneId}
            onChange={(v) => setFilters({ ...filters, zoneId: v })}
            options={zoneOptions.map((z) => ({ value: z.id, label: z.name ?? z.id }))}
          />
          <FilterSelect
            label="Registro"
            value={filters.registrationStatus}
            onChange={(v) => setFilters({ ...filters, registrationStatus: v })}
            options={[
              { value: "pending_review", label: "Pendiente" },
              { value: "active", label: "Aprobada" },
            ]}
          />
          <FilterSelect
            label="Conectividad"
            value={filters.online}
            onChange={(v) => setFilters({ ...filters, online: v })}
            options={[
              { value: "true", label: "Online" },
              { value: "false", label: "Offline" },
            ]}
          />
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

      {editing && form && (
        <Panel title={`Editar — ${editing.name ?? editing.deviceId}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
            <TextField
              label="Nombre"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            <TextField
              label="Código"
              value={form.code}
              onChange={(v) => setForm({ ...form, code: v })}
            />
            <TextField
              label="Ubicación"
              value={form.location}
              onChange={(v) => setForm({ ...form, location: v })}
            />
            <SelectField
              label="Provider"
              value={form.providerId}
              onChange={(v) => setForm({ ...form, providerId: v })}
              options={providers.map((p) => ({ value: p.id, label: p.name ?? p.id }))}
            />
            <SelectField
              label="Gateway"
              value={form.gatewayId}
              onChange={(v) => setForm({ ...form, gatewayId: v })}
              options={[
                { value: "", label: "Sin gateway" },
                ...gateways.map((g) => ({ value: g.id, label: g.name ?? g.id })),
              ]}
            />
            <SelectField
              label="Grupo"
              value={form.groupId}
              onChange={(v) => setForm({ ...form, groupId: v })}
              options={[
                { value: "", label: "Sin grupo" },
                ...groups.map((g) => ({ value: g.id, label: g.name ?? g.id })),
              ]}
            />
            <SelectField
              label="Zona"
              value={form.zoneId}
              onChange={(v) => setForm({ ...form, zoneId: v })}
              options={[
                { value: "", label: "Sin zona" },
                ...zoneOptions.map((z) => ({ value: z.id, label: z.name ?? z.id })),
              ]}
            />
            <SelectField
              label="Estado"
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={[
                { value: "active", label: "active" },
                { value: "inactive", label: "inactive" },
              ]}
            />
          </div>
          {formError && <p className="mt-2 text-[12px] text-destructive">{formError}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                setEditing(null);
                setForm(null);
              }}
              className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90"
            >
              Guardar
            </button>
          </div>
        </Panel>
      )}

      {detail && (
        <Panel
          title={`Detalle — ${detail.name ?? detail.deviceId}`}
          action={
            <button
              onClick={() => setDetail(null)}
              className="h-6 px-2 rounded border border-border text-[11px] hover:bg-secondary"
            >
              Cerrar
            </button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
            <div className="space-y-1.5">
              <DetailRow label="DeviceID" value={detail.deviceId} />
              <DetailRow label="IP" value={detail.ipAddress ?? "—"} />
              <DetailRow label="MAC" value={detail.macAddress ?? "—"} />
              <DetailRow label="Fabricante" value={detail.manufacturer ?? "—"} />
              <DetailRow label="Modelo" value={detail.model ?? "—"} />
              <DetailRow label="Firmware" value={detail.firmwareVersion ?? "—"} />
              <DetailRow label="Registro" value={detail.registrationStatus} />
              <DetailRow
                label="Último visto"
                value={
                  detail.lastSeenAt ? new Date(detail.lastSeenAt).toLocaleString("es-EC") : "—"
                }
              />
              <DetailRow label="Tenant" value={detail.tenantId ?? "sin asignar"} />
              <DetailRow label="Ciudad" value={detail.cityId ?? "sin asignar"} />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Últimos eventos por tipo</div>
              {detail.lastEventsByType.length === 0 ? (
                <p className="text-muted-foreground">Sin eventos todavía.</p>
              ) : (
                <table className="w-full">
                  <tbody>
                    {detail.lastEventsByType.map((e) => (
                      <tr key={e.eventType} className="border-t border-border">
                        <td className="py-1 pr-2 font-medium">{e.eventType}</td>
                        <td className="py-1 pr-2 tabular-nums">
                          {new Date(e.receivedAt).toLocaleString("es-EC")}
                        </td>
                        <td className="py-1">
                          <StatusPill status={e.processingStatus.toLowerCase()} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {detail.registrationStatus === "pending_review" && (
              <button
                onClick={() => approve(detail)}
                className="h-7 px-2 rounded border border-border text-[12px] hover:bg-secondary"
              >
                Aprobar
              </button>
            )}
            {!detail.tenantId && me?.tenant && (
              <button
                onClick={() => assignToMyTenant(detail)}
                className="h-7 px-2 rounded border border-border text-[12px] hover:bg-secondary"
              >
                Asignar a {me.tenant.name}
              </button>
            )}
            <button
              onClick={() => toggleActive(detail)}
              className="h-7 px-2 rounded border border-border text-[12px] hover:bg-secondary"
            >
              {detail.status === "active" ? "Desactivar" : "Activar"}
            </button>
            <a
              href={`/admin/iot/configuration?cameraId=${detail.id}`}
              className="h-7 px-2 rounded border border-border text-[12px] inline-flex items-center hover:bg-secondary"
            >
              Ver configuración
            </a>
            <a
              href={`/admin/iot/mappings?cameraId=${detail.id}`}
              className="h-7 px-2 rounded border border-border text-[12px] inline-flex items-center hover:bg-secondary"
            >
              Ver mappings
            </a>
            <a
              href={`/admin/iot/monitor?cameraId=${detail.id}`}
              className="h-7 px-2 rounded border border-border text-[12px] inline-flex items-center hover:bg-secondary"
            >
              Ver eventos
            </a>
          </div>
        </Panel>
      )}

      <Panel title={`Cámaras registradas (${cameras.length})`} padded={false}>
        <table className="w-full text-[12px]">
          <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Código</Th>
              <Th>Nombre</Th>
              <Th>Proveedor</Th>
              <Th>Gateway</Th>
              <Th>Grupo</Th>
              <Th>Zona</Th>
              <Th>Estado</Th>
              <Th>Último KeepAlive</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {cameras.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-surface-2">
                <td className="px-3 py-2 font-mono text-muted-foreground">
                  {c.code ?? c.deviceId}
                </td>
                <td className="px-3 py-2 font-medium">{c.name ?? "—"}</td>
                <td className="px-3 py-2">{c.provider?.name ?? "—"}</td>
                <td className="px-3 py-2">{c.gateway?.name ?? "—"}</td>
                <td className="px-3 py-2">{c.group?.name ?? "—"}</td>
                <td className="px-3 py-2">{c.zone?.name ?? "—"}</td>
                <td className="px-3 py-2 space-x-1">
                  <StatusPill status={isOnline(c) ? "activo" : "inactivo"} />
                  {c.registrationStatus === "pending_review" && <StatusPill status="pendiente" />}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {c.lastSeenAt ? new Date(c.lastSeenAt).toLocaleString("es-EC") : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openDetail(c)}
                      className="h-7 px-2 rounded border border-border hover:bg-secondary"
                    >
                      Ver detalle
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="h-7 px-2 rounded border border-border hover:bg-secondary"
                    >
                      Editar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </IotPageShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2">{children}</th>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[110px]">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
      />
    </label>
  );
}

function SelectField({
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
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
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
