import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Panel, StatusPill, KpiTile } from "@/components/ui-bits";
import { useSim } from "@/lib/sim";
import { ZONES, type EnforcementCase } from "@/lib/data";
import { fmtInt } from "@/lib/format";
import { AlertTriangle, ShieldCheck, Timer, X, FileWarning } from "lucide-react";

export const Route = createFileRoute("/enforcement")({
  head: () => ({
    meta: [
      { title: "Enforcement — Smart Park Chone" },
      { name: "description", content: "Overstay and unpaid case queue with priority and status workflows." },
    ],
  }),
  component: EnforcementPage,
  ssr: false,
});

function EnforcementPage() {
  const { feed } = useSim();
  const [issue, setIssue] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [zone, setZone] = useState("all");
  const [selected, setSelected] = useState<EnforcementCase | null>(null);

  const counts = useMemo(() => {
    const c = { total: feed.length, pending: 0, reviewing: 0, fined: 0, resolved: 0, overstay: 0, no_payment: 0, high: 0 };
    for (const x of feed) {
      c[x.status]++;
      c[x.issue]++;
      if (x.priority === "high") c.high++;
    }
    return c;
  }, [feed]);

  const rows = useMemo(() => feed.filter((c) =>
    (issue === "all" || c.issue === issue) &&
    (status === "all" || c.status === status) &&
    (priority === "all" || c.priority === priority) &&
    (zone === "all" || c.zone_id === zone)
  ), [feed, issue, status, priority, zone]);

  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile label="Total cases" value={fmtInt(counts.total)} sub="last 14 days" icon={<FileWarning className="h-4 w-4" />} accent="primary" />
          <KpiTile label="Pending" value={fmtInt(counts.pending)} sub="awaiting action" icon={<AlertTriangle className="h-4 w-4" />} accent="warning" />
          <KpiTile label="Reviewing" value={fmtInt(counts.reviewing)} sub="being processed" accent="accent" />
          <KpiTile label="Fined" value={fmtInt(counts.fined)} sub="penalty issued" accent="primary" />
          <KpiTile label="High priority" value={fmtInt(counts.high)} sub="immediate" icon={<Timer className="h-4 w-4" />} accent="destructive" />
          <KpiTile label="Resolved" value={fmtInt(counts.resolved)} sub="closed" icon={<ShieldCheck className="h-4 w-4" />} accent="success" />
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border bg-card flex items-center gap-2 flex-wrap">
        <Sel value={issue} onChange={setIssue} options={[{ v: "all", l: "All issues" }, { v: "overstay", l: "Overstay" }, { v: "no_payment", l: "No payment" }]} />
        <Sel value={status} onChange={setStatus} options={[{ v: "all", l: "All statuses" }, { v: "pending", l: "Pending" }, { v: "reviewing", l: "Reviewing" }, { v: "fined", l: "Fined" }, { v: "resolved", l: "Resolved" }]} />
        <Sel value={priority} onChange={setPriority} options={[{ v: "all", l: "All priorities" }, { v: "high", l: "High" }, { v: "medium", l: "Medium" }, { v: "low", l: "Low" }]} />
        <Sel value={zone} onChange={setZone} options={[{ v: "all", l: "All zones" }, ...ZONES.map((z) => ({ v: z.zone_id, l: z.zone_name }))]} />
        <div className="flex-1" />
        <span className="text-[12px] text-muted-foreground tabular-nums">{fmtInt(rows.length)} cases</span>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 p-3">
        <Panel padded={false} className="overflow-hidden">
          <div className="overflow-auto h-full">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 z-10 bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Case</Th><Th>Date</Th><Th>Detected</Th><Th>Plate</Th><Th>Zone</Th>
                  <Th>Street</Th><Th>Issue</Th><Th>Priority</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((c, i) => (
                  <tr key={c.id} onClick={() => setSelected(c)} className={"border-t border-border hover:bg-surface-2 cursor-pointer " + (i % 2 ? "bg-surface-2/40" : "")}>
                    <td className="px-3 py-1.5 font-mono text-[11px]">{c.id}</td>
                    <td className="px-3 py-1.5 tabular-nums">{c.date}</td>
                    <td className="px-3 py-1.5 tabular-nums">{c.detected}</td>
                    <td className="px-3 py-1.5 font-mono font-medium">{c.plate}</td>
                    <td className="px-3 py-1.5">{c.zone}</td>
                    <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[180px]">{c.street}</td>
                    <td className="px-3 py-1.5 capitalize">{c.issue.replace("_", " ")}</td>
                    <td className="px-3 py-1.5"><StatusPill status={c.priority} /></td>
                    <td className="px-3 py-1.5"><StatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title={selected ? "Case detail" : "Select a case"}>
          {selected ? (
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-mono font-semibold">{selected.id}</span>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <Row k="Plate" v={<span className="font-mono">{selected.plate}</span>} />
              <Row k="Zone" v={`${selected.zone_id} · ${selected.zone}`} />
              <Row k="Street" v={selected.street} />
              <Row k="Date" v={selected.date} />
              <Row k="Detected" v={selected.detected} />
              <Row k="Issue" v={<span className="capitalize">{selected.issue.replace("_", " ")}</span>} />
              <Row k="Priority" v={<StatusPill status={selected.priority} />} />
              <Row k="Status" v={<StatusPill status={selected.status} />} />
              <div className="my-2 border-t border-border" />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button className="h-8 text-[12px] rounded-md border border-border hover:bg-secondary">Mark reviewing</button>
                <button className="h-8 text-[12px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Issue fine</button>
                <button className="h-8 text-[12px] rounded-md border border-border hover:bg-secondary">Resolve</button>
                <button className="h-8 text-[12px] rounded-md border border-border hover:bg-secondary">Dispatch agent</button>
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-muted-foreground">Click any case to inspect details and trigger workflows.</div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2">{children}</th>;
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-[12px] rounded-md border border-border bg-card px-2">
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right truncate ml-2">{v}</span></div>;
}
