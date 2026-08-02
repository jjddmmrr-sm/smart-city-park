import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiDeleteAuth, apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";
import { IotPageShell } from "@/components/iot/IotSideNav";

export const Route = createFileRoute("/admin/iot/providers")({
  component: IotProvidersPage,
  ssr: false,
});

type ProviderRow = {
  id: string;
  code: string;
  name: string;
  protocol: string;
  capabilities: string[];
  defaultAuthMode: string;
  endpointTemplates: Record<string, string>;
  documentationUrl: string | null;
  supportUrl: string | null;
  active: boolean;
  createdAt: string;
};

type FormState = {
  code: string;
  name: string;
  protocol: string;
  capabilities: string;
  defaultAuthMode: string;
  endpointTemplates: string;
  documentationUrl: string;
  supportUrl: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  protocol: "",
  capabilities: "",
  defaultAuthMode: "ip_allowlist",
  endpointTemplates: "{}",
  documentationUrl: "",
  supportUrl: "",
  active: true,
};

function IotProvidersPage() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [viewing, setViewing] = useState<ProviderRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    apiGetAuth<ProviderRow[]>("/iot-device-management/providers")
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
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (provider: ProviderRow) => {
    setEditing(provider);
    setForm({
      code: provider.code,
      name: provider.name,
      protocol: provider.protocol,
      capabilities: provider.capabilities.join(", "),
      defaultAuthMode: provider.defaultAuthMode,
      endpointTemplates: JSON.stringify(provider.endpointTemplates, null, 2),
      documentationUrl: provider.documentationUrl ?? "",
      supportUrl: provider.supportUrl ?? "",
      active: provider.active,
    });
    setFormError(null);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.code || !form.name || !form.protocol) {
      setFormError("Código, nombre y protocolo son obligatorios.");
      return;
    }

    let endpointTemplates: Record<string, string>;
    try {
      endpointTemplates = JSON.parse(form.endpointTemplates || "{}");
    } catch {
      setFormError("endpointTemplates debe ser un JSON válido.");
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      protocol: form.protocol.trim(),
      capabilities: form.capabilities
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      defaultAuthMode: form.defaultAuthMode.trim(),
      endpointTemplates,
      documentationUrl: form.documentationUrl.trim() || undefined,
      supportUrl: form.supportUrl.trim() || undefined,
      active: form.active,
    };

    try {
      if (editing) {
        await apiPatchAuth(`/iot-device-management/providers/${editing.id}`, payload);
      } else {
        await apiPostAuth("/iot-device-management/providers", payload);
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Error al guardar");
    }
  };

  const remove = async (provider: ProviderRow) => {
    if (!confirm(`¿Eliminar el provider ${provider.name}?`)) return;
    try {
      await apiDeleteAuth(`/iot-device-management/providers/${provider.id}`);
      load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  };

  return (
    <IotPageShell
      title="Camera Providers"
      description="Catálogo de fabricantes/protocolos soportados por el Camera Gateway."
      actions={
        <button
          onClick={openCreate}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90"
        >
          Nuevo Provider
        </button>
      }
    >
      {showForm && (
        <Panel title={editing ? "Editar provider" : "Nuevo provider"}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
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
              label="Capabilities (separadas por coma)"
              value={form.capabilities}
              onChange={(v) => setForm({ ...form, capabilities: v })}
            />
            <Input
              label="Default Auth Mode"
              value={form.defaultAuthMode}
              onChange={(v) => setForm({ ...form, defaultAuthMode: v })}
            />
            <Select
              label="Estado"
              value={form.active ? "active" : "inactive"}
              onChange={(v) => setForm({ ...form, active: v === "active" })}
              options={["active", "inactive"]}
            />
            <Input
              label="Documentation URL"
              value={form.documentationUrl}
              onChange={(v) => setForm({ ...form, documentationUrl: v })}
            />
            <Input
              label="Support URL"
              value={form.supportUrl}
              onChange={(v) => setForm({ ...form, supportUrl: v })}
            />
            <label className="block md:col-span-3">
              <span className="text-[11px] text-muted-foreground">
                Endpoint Templates (JSON por tipo de evento canónico)
              </span>
              <textarea
                value={form.endpointTemplates}
                onChange={(e) => setForm({ ...form, endpointTemplates: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-[12px] font-mono"
              />
            </label>
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
            <DetailRow label="Protocolo" value={viewing.protocol} />
            <DetailRow label="Capabilities" value={viewing.capabilities.join(", ")} />
            <DetailRow label="Default Auth Mode" value={viewing.defaultAuthMode} />
            <DetailRow label="Documentation URL" value={viewing.documentationUrl ?? "—"} />
            <DetailRow label="Support URL" value={viewing.supportUrl ?? "—"} />
            <div>
              <span className="text-muted-foreground">Endpoint Templates:</span>
              <pre className="mt-1 bg-surface-2 rounded p-2 text-[11px] overflow-auto">
                {JSON.stringify(viewing.endpointTemplates, null, 2)}
              </pre>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Providers registrados" padded={false}>
        <table className="w-full text-[12px]">
          <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Código</Th>
              <Th>Nombre</Th>
              <Th>Protocolo</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-surface-2">
                <td className="px-3 py-2 font-mono text-muted-foreground">{p.code}</td>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">{p.protocol}</td>
                <td className="px-3 py-2">
                  <StatusPill status={p.active ? "activo" : "inactivo"} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewing(p)}
                      className="h-7 px-2 rounded border border-border hover:bg-secondary"
                    >
                      Ver detalle
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="h-7 px-2 rounded border border-border hover:bg-secondary"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(p)}
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
