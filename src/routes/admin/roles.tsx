import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel } from "@/components/ui-bits";

export const Route = createFileRoute("/admin/roles")({
  component: AdminRolesPage,
  ssr: false,
});

type RoleRow = {
  id: string;
  name: string;
  code: string;
  description?: string;
  userRoles?: unknown[];
  rolePermissions?: unknown[];
  createdAt: string;
};

function AdminRolesPage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
  });

  const loadRoles = () => {
    apiGetAuth<RoleRow[]>("/roles")
      .then(setRoles)
      .catch((error) => console.error("Error loading roles", error));
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    loadRoles();
  }, [navigate]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "", description: "" });
    setShowForm(true);
  };

  const openEdit = (role: RoleRow) => {
    setEditing(role);
    setForm({
      name: role.name,
      code: role.code,
      description: role.description ?? "",
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name || !form.code) return;

    const payload = {
      name: form.name,
      code: form.code.trim().toUpperCase().replaceAll(" ", "_"),
      description: form.description,
    };

    if (editing) {
      await apiPatchAuth(`/roles/${editing.id}`, payload);
    } else {
      await apiPostAuth("/roles", payload);
    }

    setShowForm(false);
    setEditing(null);
    setForm({ name: "", code: "", description: "" });
    loadRoles();
  };

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Roles</h1>
            <p className="text-[12px] text-muted-foreground">
              Administración de roles del sistema.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openCreate}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90"
            >
              Nuevo Rol
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
          <Panel title={editing ? "Editar rol" : "Nuevo rol"}>
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
              <Input
                label="Descripción"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
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

        <Panel title="Roles registrados" padded={false}>
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Código</Th>
                <Th>Nombre</Th>
                <Th>Descripción</Th>
                <Th>Usuarios</Th>
                <Th>Permisos</Th>
                <Th>Creado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{r.code}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.description ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{r.userRoles?.length ?? 0}</td>
                  <td className="px-3 py-2 tabular-nums">{r.rolePermissions?.length ?? 0}</td>
                  <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString("es-EC")}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => openEdit(r)}
                      className="h-7 px-2 rounded border border-border hover:bg-secondary"
                    >
                      Editar
                    </button>
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
