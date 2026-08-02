import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiDeleteAuth, apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";
import { IotPageShell } from "@/components/iot/IotSideNav";

export const Route = createFileRoute("/admin/iot/groups")({
  component: IotGroupsPage,
  ssr: false,
});

type ZoneOption = { id: string; name: string };
type GatewayOption = { id: string; name: string };

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  zoneId: string | null;
  zone: ZoneOption | null;
  gatewayId: string | null;
  gateway: GatewayOption | null;
  active: boolean;
  createdAt: string;
};

type FormState = {
  name: string;
  description: string;
  zoneId: string;
  gatewayId: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  zoneId: "",
  gatewayId: "",
  active: true,
};

function IotGroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [gateways, setGateways] = useState<GatewayOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    apiGetAuth<GroupRow[]>("/iot-device-management/groups")
      .then(setGroups)
      .catch((error) => console.error("Error loading groups", error));
    apiGetAuth<ZoneOption[]>("/parking/zones")
      .then(setZones)
      .catch((error) => console.error("Error loading zones", error));
    apiGetAuth<GatewayOption[]>("/iot-device-management/gateways")
      .then(setGateways)
      .catch((error) => console.error("Error loading gateways", error));
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    load();
  }, [navigate]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (group: GroupRow) => {
    setEditing(group);
    setForm({
      name: group.name,
      description: group.description ?? "",
      zoneId: group.zoneId ?? "",
      gatewayId: group.gatewayId ?? "",
      active: group.active,
    });
    setFormError(null);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name) {
      setFormError("El nombre es obligatorio.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      zoneId: form.zoneId || undefined,
      gatewayId: form.gatewayId || undefined,
      active: form.active,
    };

    try {
      if (editing) {
        await apiPatchAuth(`/iot-device-management/groups/${editing.id}`, payload);
      } else {
        await apiPostAuth("/iot-device-management/groups", payload);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Error al guardar");
    }
  };

  const remove = async (group: GroupRow) => {
    if (!confirm(`¿Eliminar el grupo ${group.name}?`)) return;
    try {
      await apiDeleteAuth(`/iot-device-management/groups/${group.id}`);
      load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  };

  return (
    <IotPageShell
      title="Camera Groups"
      description="Agrupación operativa de cámaras (sitio, lote de instalación)."
      actions={
        <button
          onClick={openCreate}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90"
        >
          Nuevo Grupo
        </button>
      }
    >
      {showForm && (
        <Panel title={editing ? "Editar grupo" : "Nuevo grupo"}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
            <Input
              label="Nombre"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            <Input
              label="Descripción"
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
            />
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Zona</span>
              <select
                value={form.zoneId}
                onChange={(e) => setForm({ ...form, zoneId: e.target.value })}
                className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
              >
                <option value="">Sin zona</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Gateway</span>
              <select
                value={form.gatewayId}
                onChange={(e) => setForm({ ...form, gatewayId: e.target.value })}
                className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
              >
                <option value="">Sin gateway</option>
                {gateways.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <Select
              label="Estado"
              value={form.active ? "active" : "inactive"}
              onChange={(v) => setForm({ ...form, active: v === "active" })}
              options={["active", "inactive"]}
            />
          </div>
          {formError && <p className="mt-2 text-[12px] text-destructive">{formError}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
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

      <Panel title="Grupos registrados" padded={false}>
        <table className="w-full text-[12px]">
          <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Nombre</Th>
              <Th>Zona</Th>
              <Th>Gateway</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className="border-t border-border hover:bg-surface-2">
                <td className="px-3 py-2 font-medium">{g.name}</td>
                <td className="px-3 py-2">{g.zone?.name ?? "—"}</td>
                <td className="px-3 py-2">{g.gateway?.name ?? "—"}</td>
                <td className="px-3 py-2">
                  <StatusPill status={g.active ? "activo" : "inactivo"} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(g)}
                      className="h-7 px-2 rounded border border-border hover:bg-secondary"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(g)}
                      className="h-7 px-2 rounded border border-border text-destructive hover:bg-secondary"
                    >
                      Eliminar
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

function Input({
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

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
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
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
