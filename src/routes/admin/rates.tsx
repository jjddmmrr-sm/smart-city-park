import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { apiGetAuth, apiPatchAuth, apiPostAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel, StatusPill } from "@/components/ui-bits";
import { fmtUSD2 } from "@/lib/format";

export const Route = createFileRoute("/admin/rates")({
  component: AdminRatesPage,
  ssr: false,
});

type RateRow = {
  id: string;
  name: string;
  code: string;
  currency: string;
  pricePerMinute: number;
  minimumMinutes: number;
  status: string;
  createdAt: string;
};

function AdminRatesPage() {
  const navigate = useNavigate();
  const [rates, setRates] = useState<RateRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RateRow | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");

  const [form, setForm] = useState({
    name: "",
    code: "",
    currency: "USD",
    pricePerMinute: "0.03",
    minimumMinutes: "15",
    status: "active",
  });

  const loadRates = () => {
    apiGetAuth<RateRow[]>("/parking/rates")
      .then(setRates)
      .catch((error) => console.error("Error loading rates", error));
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    loadRates();
  }, [navigate]);

  const currencies = useMemo(() => {
    return Array.from(new Set(rates.map((r) => r.currency).filter(Boolean))).sort();
  }, [rates]);

  const filteredRates = useMemo(() => {
    const term = q.trim().toLowerCase();

    return rates.filter((r) => {
      const matchesText =
        !term ||
        r.name.toLowerCase().includes(term) ||
        r.code.toLowerCase().includes(term);

      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const matchesCurrency = currencyFilter === "all" || r.currency === currencyFilter;

      return matchesText && matchesStatus && matchesCurrency;
    });
  }, [rates, q, statusFilter, currencyFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      code: "",
      currency: "USD",
      pricePerMinute: "0.03",
      minimumMinutes: "15",
      status: "active",
    });
    setShowForm(true);
  };

  const openEdit = (rate: RateRow) => {
    setEditing(rate);
    setForm({
      name: rate.name,
      code: rate.code,
      currency: rate.currency,
      pricePerMinute: String(rate.pricePerMinute),
      minimumMinutes: String(rate.minimumMinutes),
      status: rate.status,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name || !form.code) return;

    const payload = {
      name: form.name,
      code: form.code.trim().toUpperCase().replaceAll(" ", "_"),
      currency: form.currency,
      pricePerMinute: Number(form.pricePerMinute),
      minimumMinutes: Number(form.minimumMinutes),
      status: form.status,
    };

    if (editing) await apiPatchAuth(`/parking/rates/${editing.id}`, payload);
    else await apiPostAuth("/parking/rates", payload);

    setShowForm(false);
    setEditing(null);
    loadRates();
  };

  const toggleStatus = async (rate: RateRow) => {
    await apiPatchAuth(`/parking/rates/${rate.id}`, {
      status: rate.status === "active" ? "inactive" : "active",
    });
    loadRates();
  };

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Tarifas</h1>
            <p className="text-[12px] text-muted-foreground">Administración de precios, mínimos y estado de tarifas.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={openCreate} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90">
              Nueva Tarifa
            </button>
            <Link to="/admin" className="h-8 px-3 rounded-md border border-border text-[12px] inline-flex items-center hover:bg-secondary">
              Volver
            </Link>
          </div>
        </div>

        <Panel title="Filtros">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[12px]">
            <Input label="Buscar" value={q} onChange={setQ} />
            <Select label="Estado" value={statusFilter} onChange={setStatusFilter} options={[
              { v: "all", l: "Todos los estados" },
              { v: "active", l: "Activa" },
              { v: "inactive", l: "Inactiva" },
            ]} />
            <Select label="Moneda" value={currencyFilter} onChange={setCurrencyFilter} options={[
              { v: "all", l: "Todas las monedas" },
              ...currencies.map((c) => ({ v: c, l: c })),
            ]} />
            <div className="flex items-end text-[12px] text-muted-foreground">
              {filteredRates.length} de {rates.length} tarifas
            </div>
          </div>
        </Panel>

        {showForm && (
          <Panel title={editing ? "Editar tarifa" : "Nueva tarifa"}>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-[12px]">
              <Input label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Input label="Código" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
              <Input label="Moneda" value={form.currency} onChange={(v) => setForm({ ...form, currency: v.toUpperCase() })} />
              <Input label="Precio/min" value={form.pricePerMinute} onChange={(v) => setForm({ ...form, pricePerMinute: v })} />
              <Input label="Mínimo min" value={form.minimumMinutes} onChange={(v) => setForm({ ...form, minimumMinutes: v })} />
              <Select label="Estado" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[
                { v: "active", l: "Activa" },
                { v: "inactive", l: "Inactiva" },
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

        <Panel title="Tarifas registradas" padded={false}>
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Código</Th>
                <Th>Nombre</Th>
                <Th>Precio/min</Th>
                <Th>Mínimo</Th>
                <Th>Moneda</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filteredRates.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{r.code}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtUSD2(r.pricePerMinute)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.minimumMinutes} min</td>
                  <td className="px-3 py-2">{r.currency}</td>
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
