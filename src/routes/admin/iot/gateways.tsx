import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiDeleteAuth, apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";
import { IotPageShell } from "@/components/iot/IotSideNav";

export const Route = createFileRoute("/admin/iot/gateways")({
  component: IotGatewaysPage,
  ssr: false,
});

type ProviderOption = { id: string; name: string; code: string };

type GatewayRow = {
  id: string;
  providerId: string;
  provider: ProviderOption;
  code: string;
  name: string;
  protocol: string;
  publicBaseUrl: string;
  privateBaseUrl: string | null;
  basePath: string;
  active: boolean;
  createdAt: string;
};

type FormState = {
  providerId: string;
  code: string;
  name: string;
  protocol: string;
  publicBaseUrl: string;
  privateBaseUrl: string;
  basePath: string;
  active: boolean;
};

function emptyForm(defaultProviderId: string): FormState {
  return {
    providerId: defaultProviderId,
    code: "",
    name: "",
    protocol: "",
    publicBaseUrl: "",
    privateBaseUrl: "",
    basePath: "",
    active: true,
  };
}

function IotGatewaysPage() {
  const navigate = useNavigate();
  const [gateways, setGateways] = useState<GatewayRow[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GatewayRow | null>(null);
  const [viewing, setViewing] = useState<GatewayRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(""));
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    apiGetAuth<GatewayRow[]>("/iot-device-management/gateways")
      .then(setGateways)
      .catch((error) => console.error("Error loading gateways", error));
    apiGetAuth<ProviderOption[]>("/iot-device-management/providers")
      .then(setProviders)
      .catch((error) => console.error("Error loading providers", error));
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
    setForm(emptyForm(providers[0]?.id ?? ""));
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (gateway: GatewayRow) => {
    setEditing(gateway);
    setForm({
      providerId: gateway.providerId,
      code: gateway.code,
      name: gateway.name,
      protocol: gateway.protocol,
      publicBaseUrl: gateway.publicBaseUrl,
      privateBaseUrl: gateway.privateBaseUrl ?? "",
      basePath: gateway.basePath,
      active: gateway.active,
    });
    setFormError(null);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.providerId || !form.code || !form.name || !form.publicBaseUrl || !form.basePath) {
      setFormError("Provider, código, nombre, Public URL y Base Path son obligatorios.");
      return;
    }

    const payload = {
      providerId: form.providerId,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      protocol: form.protocol.trim(),
      publicBaseUrl: form.publicBaseUrl.trim(),
      privateBaseUrl: form.privateBaseUrl.trim() || undefined,
      basePath: form.basePath.trim(),
      active: form.active,
    };

    try {
      if (editing) {
        await apiPatchAuth(`/iot-device-management/gateways/${editing.id}`, payload);
      } else {
        await apiPostAuth("/iot-device-management/gateways", payload);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Error al guardar");
    }
  };

  const remove = async (gateway: GatewayRow) => {
    if (!confirm(`¿Eliminar el gateway ${gateway.name}?`)) return;
    try {
      await apiDeleteAuth(`/iot-device-management/gateways/${gateway.id}`);
      load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  };

  return (
    <IotPageShell
      title="Camera Gateways"
      description="Puntos de entrada técnicos del Camera Gateway, por proveedor."
      actions={
        <button
          onClick={openCreate}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90"
        >
          Nuevo Gateway
        </button>
      }
    >
      {showForm && (
        <Panel title={editing ? "Editar gateway" : "Nuevo gateway"}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Provider</span>
              <select
                value={form.providerId}
                onChange={(e) => setForm({ ...form, providerId: e.target.value })}
                className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
              >
                <option value="">Seleccionar…</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Código"
              value={form.code}
              onChange={(v) => setForm({ ...form, code: v })}
            />
            <Input
              label="Nombre"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            <Input
              label="Protocolo"
              value={form.protocol}
              onChange={(v) => setForm({ ...form, protocol: v })}
            />
            <Input
              label="Public Base URL"
              value={form.publicBaseUrl}
              onChange={(v) => setForm({ ...form, publicBaseUrl: v })}
            />
            <Input
              label="Private Base URL"
              value={form.privateBaseUrl}
              onChange={(v) => setForm({ ...form, privateBaseUrl: v })}
            />
            <Input
              label="Base Path"
              value={form.basePath}
              onChange={(v) => setForm({ ...form, basePath: v })}
            />
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

      {viewing && (
        <Panel
          title={`Detalle — ${viewing.name}`}
          action={
            <button
              onClick={() => setViewing(null)}
              className="h-6 px-2 rounded border border-border text-[11px] hover:bg-secondary"
            >
              Cerrar
            </button>
          }
        >
          <div className="text-[12px] space-y-1.5">
            <DetailRow label="Código" value={viewing.code} />
            <DetailRow label="Provider" value={viewing.provider?.name ?? viewing.providerId} />
            <DetailRow label="Protocolo" value={viewing.protocol} />
            <DetailRow label="Public Base URL" value={viewing.publicBaseUrl} />
            <DetailRow label="Private Base URL" value={viewing.privateBaseUrl ?? "—"} />
            <DetailRow label="Base Path" value={viewing.basePath} />
          </div>
        </Panel>
      )}

      <Panel title="Gateways registrados" padded={false}>
        <table className="w-full text-[12px]">
          <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Código</Th>
              <Th>Nombre</Th>
              <Th>Provider</Th>
              <Th>Public URL</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {gateways.map((g) => (
              <tr key={g.id} className="border-t border-border hover:bg-surface-2">
                <td className="px-3 py-2 font-mono text-muted-foreground">{g.code}</td>
                <td className="px-3 py-2 font-medium">{g.name}</td>
                <td className="px-3 py-2">{g.provider?.name ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{g.publicBaseUrl}</td>
                <td className="px-3 py-2">
                  <StatusPill status={g.active ? "activo" : "inactivo"} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewing(g)}
                      className="h-7 px-2 rounded border border-border hover:bg-secondary"
                    >
                      Ver detalle
                    </button>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[140px]">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
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
