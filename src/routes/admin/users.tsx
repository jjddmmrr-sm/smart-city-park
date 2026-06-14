import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
  ssr: false,
});

type UserRow = {
  id: string;
  email: string;
  name: string;
  status: string;
  roles?: string[];
  createdAt: string;
};

function friendlyId(id: string) {
  return `USR-${id.slice(0, 8).toUpperCase()}`;
}

function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "Temporal123",
    roleCode: "SUPER_ADMIN",
    status: "active",
  });

  const loadUsers = () => {
    apiGetAuth<UserRow[]>("/users")
      .then(setUsers)
      .catch((error) => console.error("Error loading users", error));
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    loadUsers();
  }, [navigate]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      password: "Temporal123",
      roleCode: "SUPER_ADMIN",
      status: "active",
    });
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      roleCode: u.roles?.[0] ?? "SUPER_ADMIN",
      status: u.status,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name || !form.email) return;

    if (editing) {
      await apiPatchAuth(`/users/${editing.id}`, {
        name: form.name,
        email: form.email,
        roleCode: form.roleCode,
        status: form.status,
        ...(form.password ? { password: form.password } : {}),
      });
    } else {
      await apiPostAuth("/users", form);
    }

    setShowForm(false);
    resetForm();
    loadUsers();
  };

  const toggleStatus = async (u: UserRow) => {
    await apiPatchAuth(`/users/${u.id}`, {
      status: u.status === "active" ? "inactive" : "active",
    });
    loadUsers();
  };

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Usuarios Administrativos</h1>
            <p className="text-[12px] text-muted-foreground">CRUD inicial conectado a JWT + PostgreSQL.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={openCreate} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90">
              Nuevo Usuario
            </button>
            <Link to="/admin" className="h-8 px-3 rounded-md border border-border text-[12px] inline-flex items-center hover:bg-secondary">
              Volver
            </Link>
          </div>
        </div>

        {showForm && (
          <Panel title={editing ? "Editar usuario" : "Nuevo usuario"}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[12px]">
              <Input label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Input label="Correo" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Input label="Contraseña" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
              <Select label="Rol" value={form.roleCode} onChange={(v) => setForm({ ...form, roleCode: v })} options={["SUPER_ADMIN", "ADMIN", "AUDITOR", "OPERADOR"]} />
              <Select label="Estado" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["active", "inactive"]} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); resetForm(); }} className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-secondary">
                Cancelar
              </button>
              <button onClick={save} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90">
                Guardar
              </button>
            </div>
          </Panel>
        )}

        <Panel title="Usuarios registrados" padded={false}>
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Código</Th>
                <Th>Nombre</Th>
                <Th>Correo</Th>
                <Th>Rol</Th>
                <Th>Creado</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{friendlyId(u.id)}</td>
                  <td className="px-3 py-2 font-medium">{u.name}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2">{u.roles?.join(", ") || "Sin rol"}</td>
                  <td className="px-3 py-2">{new Date(u.createdAt).toLocaleString("es-EC")}</td>
                  <td className="px-3 py-2"><StatusPill status={u.status === "active" ? "activo" : "inactivo"} /></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)} className="h-7 px-2 rounded border border-border hover:bg-secondary">
                        Editar
                      </button>
                      <button onClick={() => toggleStatus(u)} className="h-7 px-2 rounded border border-border hover:bg-secondary">
                        {u.status === "active" ? "Inactivar" : "Activar"}
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

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
