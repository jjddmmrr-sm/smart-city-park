import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";

export const Route = createFileRoute("/admin/controllers")({
  component: AdminControllersPage,
  ssr: false,
});

type ZoneRow = { id: string; name: string; code: string };

type ControllerRow = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  deviceId?: string;
  shift: string;
  status: string;
  assignedZoneId?: string | null;
  assignedZone?: ZoneRow | null;
  createdAt: string;
};

function AdminControllersPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ControllerRow[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ControllerRow | null>(null);

  const [q, setQ] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    assignedZoneId: "",
    deviceId: "",
    shift: "mixto",
    status: "active",
  });

  const load = () => {
    apiGetAuth<ControllerRow[]>("/parking/controllers").then(setRows);
    apiGetAuth<ZoneRow[]>("/parking/zones").then(setZones);
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
        r.name.toLowerCase().includes(term) ||
        (r.email ?? "").toLowerCase().includes(term) ||
        (r.phone ?? "").toLowerCase().includes(term) ||
        (r.deviceId ?? "").toLowerCase().includes(term);

      const matchesZone = zoneFilter === "all" || r.assignedZoneId === zoneFilter;
      const matchesShift = shiftFilter === "all" || r.shift === shiftFilter;
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;

      return matchesText && matchesZone && matchesShift && matchesStatus;
    });
  }, [rows, q, zoneFilter, shiftFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      assignedZoneId: zones[0]?.id ?? "",
      deviceId: "",
      shift: "mixto",
      status: "active",
    });
    setShowForm(true);
  };

  const openEdit = (r: ControllerRow) => {
    setEditing(r);
    setForm({
      name: r.name,
      email: r.email ?? "",
      phone: r.phone ?? "",
      assignedZoneId: r.assignedZoneId ?? "",
      deviceId: r.deviceId ?? "",
      shift: r.shift,
      status: r.status,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name) return;

    const payload = {
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      assignedZoneId: form.assignedZoneId || undefined,
      deviceId: form.deviceId || undefined,
      shift: form.shift,
      status: form.status,
    };

    if (editing) await apiPatchAuth(`/parking/controllers/${editing.id}`, payload);
    else await apiPostAuth("/parking/controllers", payload);

    setShowForm(false);
    setEditing(null);
    load();
  };

  const toggleStatus = async (r: ControllerRow) => {
    await apiPatchAuth(`/parking/controllers/${r.id}`, {
      status: r.status === "active" ? "inactive" : "active",
    });
    load();
  };

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Controladores</h1>
            <p className="text-[12px] text-muted-foreground">Administración del equipo operativo de campo.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={openCreate} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90">
              Nuevo Controlador
            </button>
            <Link to="/admin" className="h-8 px-3 rounded-md border border-border text-[12px] inline-flex items-center hover:bg-secondary">
              Volver
            </Link>
          </div>
        </div>

        <Panel title="Filtros">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[12px]">
            <Input label="Buscar" value={q} onChange={setQ} />
            <Select label="Zona" value={zoneFilter} onChange={setZoneFilter} options={[{ v: "all", l: "Todas las zonas" }, ...zones.map((z) => ({ v: z.id, l: z.name }))]} />
            <Select label="Turno" value={shiftFilter} onChange={setShiftFilter} options={[
              { v: "all", l: "Todos los turnos" },
              { v: "mañana", l: "Mañana" },
              { v: "tarde", l: "Tarde" },
              { v: "mixto", l: "Mixto" },
            ]} />
            <Select label="Estado" value={statusFilter} onChange={setStatusFilter} options={[
              { v: "all", l: "Todos los estados" },
              { v: "active", l: "Activo" },
              { v: "inactive", l: "Inactivo" },
            ]} />
            <div className="flex items-end text-[12px] text-muted-foreground">
              {filtered.length} de {rows.length} controladores
            </div>
          </div>
        </Panel>

        {showForm && (
          <Panel title={editing ? "Editar controlador" : "Nuevo controlador"}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[12px]">
              <Input label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Input label="Correo" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Input label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Input label="Dispositivo" value={form.deviceId} onChange={(v) => setForm({ ...form, deviceId: v })} />
              <Select label="Zona asignada" value={form.assignedZoneId} onChange={(v) => setForm({ ...form, assignedZoneId: v })} options={[{ v: "", l: "Sin zona asignada" }, ...zones.map((z) => ({ v: z.id, l: z.name }))]} />
              <Select label="Turno" value={form.shift} onChange={(v) => setForm({ ...form, shift: v })} options={[
                { v: "mañana", l: "Mañana" },
                { v: "tarde", l: "Tarde" },
                { v: "mixto", l: "Mixto" },
              ]} />
              <Select label="Estado" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[
                { v: "active", l: "Activo" },
                { v: "inactive", l: "Inactivo" },
              ]} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-secondary">
                Cancelar
              </button>
              <button onClick={save} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90">
                Guardar
              </button>
            </div>
          </Panel>
        )}

        <Panel title="Controladores registrados" padded={false}>
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Nombre</Th>
                <Th>Correo</Th>
                <Th>Teléfono</Th>
                <Th>Zona</Th>
                <Th>Turno</Th>
                <Th>Dispositivo</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.email ?? "—"}</td>
                  <td className="px-3 py-2">{r.phone ?? "—"}</td>
                  <td className="px-3 py-2">{r.assignedZone?.name ?? "Sin zona"}</td>
                  <td className="px-3 py-2 capitalize">{r.shift}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.deviceId ?? "—"}</td>
                  <td className="px-3 py-2"><StatusPill status={r.status === "active" ? "activo" : "inactivo"} /></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(r)} className="h-7 px-2 rounded border border-border hover:bg-secondary">
                        Editar
                      </button>
                      <button onClick={() => toggleStatus(r)} className="h-7 px-2 rounded border border-border hover:bg-secondary">
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

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}
