import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";

export const Route = createFileRoute("/admin/payment-methods")({
  component: AdminPaymentMethodsPage,
  ssr: false,
});

type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
};

function AdminPaymentMethodsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PaymentMethod[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ code: "", name: "", description: "", status: "active" });

  const load = () => {
    apiGetAuth<PaymentMethod[]>("/parking/payment-methods")
      .then(setRows)
      .catch((error) => console.error("Error loading payment methods", error));
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    load();
  }, [navigate]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesText =
        !term ||
        r.code.toLowerCase().includes(term) ||
        r.name.toLowerCase().includes(term) ||
        (r.description ?? "").toLowerCase().includes(term);

      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [rows, q, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", description: "", status: "active" });
    setShowForm(true);
  };

  const openEdit = (row: PaymentMethod) => {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      description: row.description ?? "",
      status: row.status,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.code || !form.name) return;

    const payload = {
      code: form.code.trim().toUpperCase().replaceAll(" ", "_"),
      name: form.name,
      description: form.description,
      status: form.status,
    };

    if (editing) await apiPatchAuth(`/parking/payment-methods/${editing.id}`, payload);
    else await apiPostAuth("/parking/payment-methods", payload);

    setShowForm(false);
    setEditing(null);
    load();
  };

  const toggleStatus = async (row: PaymentMethod) => {
    await apiPatchAuth(`/parking/payment-methods/${row.id}`, {
      status: row.status === "active" ? "inactive" : "active",
    });
    load();
  };

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Medios de Pago</h1>
            <p className="text-[12px] text-muted-foreground">
              Administración de canales de recaudación.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openCreate}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90"
            >
              Nuevo Medio
            </button>
            <Link
              to="/admin"
              className="h-8 px-3 rounded-md border border-border text-[12px] inline-flex items-center hover:bg-secondary"
            >
              Volver
            </Link>
          </div>
        </div>

        <Panel title="Filtros">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
            <Input label="Buscar" value={q} onChange={setQ} />
            <Select
              label="Estado"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { v: "all", l: "Todos los estados" },
                { v: "active", l: "Activo" },
                { v: "inactive", l: "Inactivo" },
              ]}
            />
            <div className="flex items-end text-[12px] text-muted-foreground">
              {filtered.length} de {rows.length} medios
            </div>
          </div>
        </Panel>

        {showForm && (
          <Panel title={editing ? "Editar medio de pago" : "Nuevo medio de pago"}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[12px]">
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
                label="Descripción"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
              />
              <Select
                label="Estado"
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
                options={[
                  { v: "active", l: "Activo" },
                  { v: "inactive", l: "Inactivo" },
                ]}
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

        <Panel title="Medios registrados" padded={false}>
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Código</Th>
                <Th>Nombre</Th>
                <Th>Descripción</Th>
                <Th>Creado</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{r.code}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.description || "—"}</td>
                  <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString("es-EC")}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={r.status === "active" ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        className="h-7 px-2 rounded border border-border hover:bg-secondary"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleStatus(r)}
                        className="h-7 px-2 rounded border border-border hover:bg-secondary"
                      >
                        {r.status === "active" ? "Inactivar" : "Activar"}
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
  options: { v: string; l: string }[];
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
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}
