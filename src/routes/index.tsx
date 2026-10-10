import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { loadHistory, OUTPUTS, type HistoryRow } from "@/lib/yieldModel";
import { displayTemp, useSim } from "@/lib/sim/engine";
import { REACTOR_IDS, REACTORS } from "@/lib/sim/types";
import { computeYield, DEFAULT_YIELD } from "@/lib/sim/yield";
import { ReactorCard } from "@/components/bio/ReactorCard";
import { TrendChart, REACTOR_COLORS } from "@/components/bio/TrendChart";
import { Kpi, PageHeader, Panel, SeverityPill, Empty, fmtTime } from "@/components/bio/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plant Overview — BIOREFINE AI" },
      { name: "description", content: "Live simulated overview of bioethanol, biogas and biofertilizer reactors with AI anomaly detection." },
      { property: "og:title", content: "Plant Overview — BIOREFINE AI" },
      { property: "og:description", content: "Live simulated overview of a sugarcane bagasse biorefinery digital twin." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const current = useSim((s) => s.current);
  const history = useSim((s) => s.history);
  const events = useSim((s) => s.events);
  const lastSync = useSim((s) => s.lastSync);
  const status = useSim((s) => s.status);
  const unit = useSim((s) => s.settings.tempUnit);
  const [lastPred, setLastPred] = useState<HistoryRow | null>(null);
  useEffect(() => setLastPred(loadHistory()[0] ?? null), []);

  const active = REACTOR_IDS.filter((id) => current[id]).length;
  const anomalies = REACTOR_IDS.filter((id) => current[id]?.aiLabel === "anomaly").length;
  const limitAlerts = REACTOR_IDS.reduce((a, id) => a + (current[id]?.violations.length ?? 0), 0);
  const plant = anomalies ? { v: "CRITICAL", t: "crit" as const } : limitAlerts ? { v: "WARNING", t: "warn" as const } : { v: "NORMAL", t: "ok" as const };

  const outputs = useMemo(() => {
    const e = computeYield({ ...DEFAULT_YIELD, pathway: "ethanol" });
    const b = computeYield({ ...DEFAULT_YIELD, pathway: "biogas", temperature: 37, ph: 7, agitation: 100 });
    const f = computeYield({ ...DEFAULT_YIELD, pathway: "fertilizer", temperature: 30, ph: 6.8, agitation: 160 });
    return { e, b, f };
  }, []);

  const chart = useMemo(() => {
    const n = Math.max(...REACTOR_IDS.map((id) => history[id].length));
    const rows: Record<string, number | null>[] = [];
    const start = Math.max(0, n - 60);
    for (let i = start; i < n; i++) {
      const row: Record<string, number | null> = { ts: null };
      for (const id of REACTOR_IDS) {
        const h = history[id];
        const r = h[h.length - (n - i)];
        if (r) {
          row.ts = r.ts;
          row[id] = displayTemp(r.temperature, unit);
        }
      }
      if (row.ts) rows.push(row);
    }
    return rows;
  }, [history, unit]);

  return (
    <div>
      <PageHeader title="Plant Overview" sub="Sugarcane bagasse biorefinery · simulated telemetry, refreshed every cycle" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Active reactors" value={`${active}/3`} sub={`Simulation ${status}`} />
        <Kpi label="Plant status" value={plant.v} tone={plant.t} sub="Simulated" />
        <Kpi label="AI anomalies" value={anomalies} tone={anomalies ? "crit" : "ok"} sub="Isolation Forest" />
        <Kpi label="Limit alerts" value={limitAlerts} tone={limitAlerts ? "warn" : "ok"} sub="Rule-based" />
        <Kpi label="Est. ethanol / t bagasse" value={`${outputs.e.practical.toFixed(0)} L`} sub={`Biogas ${outputs.b.secondary[1].value.toFixed(0)} m³ · Fert ${outputs.f.practical.toFixed(0)} kg`} tone="ok" />
        <Kpi label="Last sync" value={fmtTime(lastSync)} sub="Local simulation engine" />
      </div>

      <div className="mt-3 panel flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 text-sm">
        <span className="label-tech">Latest model-predicted yields</span>
        {lastPred ? (
          <>
            {OUTPUTS.map((k) => (
              <span key={k}><span className="text-muted-foreground capitalize">{k}: </span><span className="num text-telemetry">{lastPred.prediction.values[k].toLocaleString(undefined, { maximumFractionDigits: 3 })} {lastPred.prediction.units[k] ?? ""}</span></span>
            ))}
            <span className="text-xs text-muted-foreground">for {lastPred.inputs.weight} kg · {lastPred.inputs.moisture}% · {lastPred.inputs.temperature} °C · pH {lastPred.inputs.ph} (user-entered)</span>
          </>
        ) : (
          <span className="text-muted-foreground">None yet — <Link to="/yield-predictor" className="text-telemetry hover:underline">connect a model in Yield Predictor</Link></span>
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {REACTOR_IDS.map((id) => <ReactorCard key={id} id={id} />)}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <Panel title={`Live temperature trend (°${unit})`} className="xl:col-span-2">
          <TrendChart data={chart} series={REACTOR_IDS.map((id) => ({ key: id, name: REACTORS[id].short, color: REACTOR_COLORS[id] }))} height={260} />
        </Panel>
        <Panel title="Recent events" action={<Link to="/events" className="text-xs text-telemetry hover:underline">View all</Link>}>
          {events.length === 0 ? <Empty>No events yet</Empty> : (
            <ul className="space-y-2">
              {events.slice(0, 7).map((e) => (
                <li key={e.id} className="rounded-md border bg-surface/50 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <SeverityPill s={e.severity} />
                    <span className="num text-muted-foreground">{fmtTime(e.ts)}</span>
                  </div>
                  <div className="mt-1 font-medium">{e.type} · {e.reactor === "plant" ? "Plant" : REACTORS[e.reactor].short}</div>
                  <p className="line-clamp-2 text-muted-foreground">{e.explanation}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
