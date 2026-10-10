import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpDown, Check, CheckCheck, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { sim, useSim } from "@/lib/sim/engine";
import { PARAM_LABEL, REACTORS, REACTOR_IDS, type ReactorId, type Severity } from "@/lib/sim/types";
import { download } from "@/lib/sim/csv";
import { eventsCSV } from "@/lib/sim/exports";
import { Empty, PageHeader, Panel, Select, SeverityPill, StatusPill, fmtDateTime } from "@/components/bio/ui";
import { toast } from "sonner";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Event & Alarm Center — BIOREFINE AI" },
      { name: "description", content: "Filter, sort and acknowledge AI anomaly and operating-limit events." },
      { property: "og:title", content: "Event & Alarm Center — BIOREFINE AI" },
      { property: "og:description", content: "AI anomaly and operating-limit event management." },
    ],
  }),
  component: Events,
});

type SortKey = "ts" | "severity" | "reactor";
const SEV_RANK: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };

function Events() {
  const events = useSim((s) => s.events);
  const [sev, setSev] = useState<Severity | "all">("all");
  const [reactor, setReactor] = useState<ReactorId | "plant" | "all">("all");
  const [ack, setAck] = useState<"all" | "open" | "ack">("all");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "ts", dir: -1 });

  const rows = useMemo(() => {
    const f = events.filter((e) => (sev === "all" || e.severity === sev) && (reactor === "all" || e.reactor === reactor) && (ack === "all" || (ack === "ack" ? e.acknowledged : !e.acknowledged)));
    return [...f].sort((a, b) => {
      const v = sort.k === "ts" ? a.ts - b.ts : sort.k === "severity" ? SEV_RANK[a.severity] - SEV_RANK[b.severity] : a.reactor.localeCompare(b.reactor);
      return v * sort.dir;
    });
  }, [events, sev, reactor, ack, sort]);

  const th = (k: SortKey, label: string) => (
    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>
      {label} <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Event & Alarm Center"
        sub={`${events.length} stored events · ${events.filter((e) => !e.acknowledged).length} unacknowledged`}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => { sim.acknowledgeAll(); toast.success("All events acknowledged"); }}><CheckCheck className="h-3.5 w-3.5" /> Ack all</Button>
            <Button size="sm" variant="outline" onClick={() => download(`biorefine-events-${Date.now()}.csv`, eventsCSV(rows))}><Download className="h-3.5 w-3.5" /> CSV</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Trash2 className="h-3.5 w-3.5" /> Clear demo events</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all demo events?</AlertDialogTitle>
                  <AlertDialogDescription>This permanently removes all {events.length} stored events. Sensor history is kept.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { sim.clearEvents(); toast.success("Events cleared"); }}>Clear events</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select label="Severity" value={sev} onChange={setSev} options={[{ value: "all", label: "All severities" }, { value: "critical", label: "Critical" }, { value: "warning", label: "Warning" }, { value: "info", label: "Info" }]} />
        <Select label="Reactor" value={reactor} onChange={setReactor} options={[{ value: "all", label: "All sources" }, { value: "plant", label: "Plant / system" }, ...REACTOR_IDS.map((id) => ({ value: id, label: REACTORS[id].name }))]} />
        <Select label="Acknowledgement" value={ack} onChange={setAck} options={[{ value: "all", label: "All" }, { value: "open", label: "Unacknowledged" }, { value: "ack", label: "Acknowledged" }]} />
      </div>
      <Panel>
        {rows.length === 0 ? <Empty>No events match the filters</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-xs">
              <thead className="label-tech text-left">
                <tr className="border-b">
                  <th className="py-2">{th("ts", "Timestamp")}</th><th>{th("reactor", "Reactor")}</th><th>{th("severity", "Severity")}</th><th>Type</th><th>Parameter / value</th><th>Limit</th><th>AI class</th><th className="w-[30%]">Explanation</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((e) => (
                  <tr key={e.id} className={`border-b border-border/50 align-top ${e.acknowledged ? "opacity-60" : ""}`}>
                    <td className="num py-2 pr-2 whitespace-nowrap">{fmtDateTime(e.ts)}</td>
                    <td className="pr-2">{e.reactor === "plant" ? "Plant" : REACTORS[e.reactor].short}</td>
                    <td className="pr-2"><SeverityPill s={e.severity} /></td>
                    <td className="pr-2">{e.type}</td>
                    <td className="num pr-2">{e.parameter ? `${PARAM_LABEL[e.parameter]}: ${e.value}` : "—"}</td>
                    <td className="num pr-2">{e.limit ?? "—"}</td>
                    <td className="pr-2">{e.aiClass ?? "—"}</td>
                    <td className="pr-2 text-muted-foreground">{e.explanation}</td>
                    <td>
                      {e.acknowledged ? <StatusPill tone="muted">Ack</StatusPill> : (
                        <button onClick={() => sim.acknowledge(e.id)} className="inline-flex items-center gap-1 rounded border border-telemetry/50 px-2 py-0.5 text-telemetry hover:bg-telemetry/10"><Check className="h-3 w-3" /> Ack</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 300 && <p className="mt-2 text-xs text-muted-foreground">Showing 300 of {rows.length}. Export CSV for all.</p>}
          </div>
        )}
      </Panel>
    </div>
  );
}
