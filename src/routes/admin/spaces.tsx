import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";

export const Route = createFileRoute("/admin/spaces")({
  component: AdminSpacesPage,
  ssr: false,
});

type ZoneRow = { id: string; name: string; code: string };
type SpaceRow = {
  id: string;
  code: string;
  label?: string;
  type: string;
  status: string;
  latitude?: number;
  longitude?: number;
  zoneId: string;
  zone?: ZoneRow;
  createdAt: string;
};

function AdminSpacesPage() {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editing, setEditing] = useState<SpaceRow | null>(null);
  const [form, setForm] = useState({
    zoneId: "",
    code: "",
    label: "",
    type: "vehicle",
    status: "available",
    latitude: "",
    longitude: "",
  });

  const load = () => {
    apiGetAuth<SpaceRow[]>("/parking/spaces").then(setSpaces);
    apiGetAuth<ZoneRow[]>("/parking/zones").then(setZones);
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
    setForm({
      zoneId: zones[0]?.id ?? "",
      code: "",
      label: "",
      type: "vehicle",
      status: "available",
      latitude: "",
      longitude: "",
    });
    setShowForm(true);
  };

  const openEdit = (s: SpaceRow) => {
    setEditing(s);
    setForm({
      zoneId: s.zoneId,
      code: s.code,
      label: s.label ?? "",
      type: s.type,
      status: s.status,
      latitude: s.latitude?.toString() ?? "",
      longitude: s.longitude?.toString() ?? "",
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.zoneId || !form.code) return;

    const payload = {
      zoneId: form.zoneId,
      code: form.code.trim().toUpperCase(),
      label: form.label,
      type: form.type,
      status: form.status,
      ...(form.latitude ? { latitude: Number(form.latitude) } : {}),
      ...(form.longitude ? { longitude: Number(form.longitude) } : {}),
    };

    if (editing) await apiPatchAuth(`/parking/spaces/${editing.id}`, payload);
    else await apiPostAuth("/parking/spaces", payload);

    setShowForm(false);
    setEditing(null);
    load();
  };

  const toggleStatus = async (s: SpaceRow) => {
    await apiPatchAuth(`/parking/spaces/${s.id}`, {
      status: s.status === "available" ? "out_of_service" : "available",
    });
    load();
  };

  const filteredSpaces = useMemo(() => {
    const term = q.trim().toLowerCase();

    return spaces.filter((s) => {
      const matchesText =
        !term ||
        s.code.toLowerCase().includes(term) ||
        (s.label ?? "").toLowerCase().includes(term) ||
        (s.zone?.name ?? "").toLowerCase().includes(term);

      const matchesZone = zoneFilter === "all" || s.zoneId === zoneFilter;
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      const matchesType = typeFilter === "all" || s.type === typeFilter;

      return matchesText && matchesZone && matchesStatus && matchesType;
    });
  }, [spaces, q, zoneFilter, statusFilter, typeFilter]);

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Espacios</h1>
            <p className="text-[12px] text-muted-foreground">Administración de espacios físicos de parqueo.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={openCreate} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90">
              Nuevo Espacio
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
            <Select label="Estado" value={statusFilter} onChange={setStatusFilter} options={[
              { v: "all", l: "Todos los estados" },
              { v: "available", l: "Disponible" },
              { v: "occupied", l: "Ocupado" },
              { v: "reserved", l: "Reservado" },
              { v: "out_of_service", l: "Fuera de servicio" },
            ]} />
            <Select label="Tipo" value={typeFilter} onChange={setTypeFilter} options={[
              { v: "all", l: "Todos los tipos" },
              { v: "vehicle", l: "Vehículo" },
              { v: "motorcycle", l: "Moto" },
              { v: "disabled", l: "Discapacidad" },
            ]} />
            <div className="flex items-end text-[12px] text-muted-foreground">
              {filteredSpaces.length} de {spaces.length} espacios
            </div>
          </div>
        </Panel>

        {showForm && (
          <Panel title={editing ? "Editar espacio" : "Nuevo espacio"}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[12px]">
              <Select label="Zona" value={form.zoneId} onChange={(v) => setForm({ ...form, zoneId: v })} options={zones.map(z => ({ v: z.id, l: z.name }))} />
              <Input label="Código" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
              <Input label="Etiqueta" value={form.label} onChange={(v) => setForm({ ...form, label: v })} />
              <Select label="Tipo" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={[
                { v: "vehicle", l: "Vehículo" },
                { v: "motorcycle", l: "Moto" },
                { v: "disabled", l: "Discapacidad" },
              ]} />
              <Select label="Estado" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[
                { v: "available", l: "Disponible" },
                { v: "occupied", l: "Ocupado" },
                { v: "reserved", l: "Reservado" },
                { v: "out_of_service", l: "Fuera de servicio" },
              ]} />
              <Input label="Latitud" value={form.latitude} onChange={(v) => setForm({ ...form, latitude: v })} />
              <Input label="Longitud" value={form.longitude} onChange={(v) => setForm({ ...form, longitude: v })} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-secondary">Cancelar</button>
              <button onClick={save} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90">Guardar</button>
            </div>
          </Panel>
        )}

        <Panel title="Espacios registrados" padded={false}>
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Código</Th><Th>Etiqueta</Th><Th>Zona</Th><Th>Tipo</Th><Th>Estado</Th><Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filteredSpaces.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{s.code}</td>
                  <td className="px-3 py-2 font-medium">{s.label ?? "—"}</td>
                  <td className="px-3 py-2">{s.zone?.name ?? s.zoneId}</td>
                  <td className="px-3 py-2">{s.type}</td>
                  <td className="px-3 py-2"><StatusPill status={statusEs(s.status)} /></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)} className="h-7 px-2 rounded border border-border hover:bg-secondary">Editar</button>
                      <button onClick={() => toggleStatus(s)} className="h-7 px-2 rounded border border-border hover:bg-secondary">
                        {s.status === "available" ? "Deshabilitar" : "Habilitar"}
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

function statusEs(s: string) {
  const map: Record<string, string> = {
    available: "disponible",
    occupied: "ocupado",
    reserved: "reservado",
    out_of_service: "fuera de servicio",
  };
  return map[s] ?? s;
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
