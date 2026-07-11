import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";

export const Route = createFileRoute("/admin/zones")({
  component: AdminZonesPage,
  ssr: false,
});

type ZoneRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  spaces?: unknown[];
  createdAt: string;
};

function AdminZonesPage() {
  const navigate = useNavigate();
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ZoneRow | null>(null);
  const [form, setForm] = useState({ name: "", code: "", status: "active" });

  const loadZones = () => {
    apiGetAuth<ZoneRow[]>("/parking/zones")
      .then(setZones)
      .catch((error) => console.error("Error loading zones", error));
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    loadZones();
  }, [navigate]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "", status: "active" });
    setShowForm(true);
  };

  const openEdit = (zone: ZoneRow) => {
    setEditing(zone);
    setForm({ name: zone.name, code: zone.code, status: zone.status });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name || !form.code) return;

    const payload = {
      name: form.name,
      code: form.code.trim().toUpperCase().replaceAll(" ", "_"),
      status: form.status,
    };

    if (editing) {
      await apiPatchAuth(`/parking/zones/${editing.id}`, payload);
    } else {
      await apiPostAuth("/parking/zones", payload);
    }

    setShowForm(false);
    setEditing(null);
    setForm({ name: "", code: "", status: "active" });
    loadZones();
  };

  const toggleStatus = async (zone: ZoneRow) => {
    await apiPatchAuth(`/parking/zones/${zone.id}`, {
      status: zone.status === "active" ? "inactive" : "active",
    });
    loadZones();
  };

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Zonas</h1>
            <p className="text-[12px] text-muted-foreground">
              Administración de zonas operativas de parqueo.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openCreate}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90"
            >
              Nueva Zona
            </button>
            <Link
              to="/admin"
              className="h-8 px-3 rounded-md border border-border text-[12px] inline-flex items-center hover:bg-secondary"
            >
              Volver
            </Link>
          </div>
        </div>

        {showForm && (
          <Panel title={editing ? "Editar zona" : "Nueva zona"}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
              <Input
                label="Nombre"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Input
                label="Código"
                value={form.code}
                onChange={(v) => setForm({ ...form, code: v })}
              />
              <Select
                label="Estado"
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
                options={["active", "inactive"]}
              />
            </div>
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

        <Panel title="Zonas registradas" padded={false}>
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Código</Th>
                <Th>Nombre</Th>
                <Th>Espacios</Th>
                <Th>Creado</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{z.code}</td>
                  <td className="px-3 py-2 font-medium">{z.name}</td>
                  <td className="px-3 py-2 tabular-nums">{z.spaces?.length ?? 0}</td>
                  <td className="px-3 py-2">{new Date(z.createdAt).toLocaleString("es-EC")}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={z.status === "active" ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(z)}
                        className="h-7 px-2 rounded border border-border hover:bg-secondary"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleStatus(z)}
                        className="h-7 px-2 rounded border border-border hover:bg-secondary"
                      >
                        {z.status === "active" ? "Inactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
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
