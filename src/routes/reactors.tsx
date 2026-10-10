import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayTemp, sim, useSim } from "@/lib/sim/engine";
import { PARAMS, PARAM_LABEL, PARAM_UNIT, REACTORS, REACTOR_IDS, SENSITIVITY_THRESHOLD, type ReactorId } from "@/lib/sim/types";
import { ReactorVessel } from "@/components/bio/ReactorVessel";
import { TrendChart } from "@/components/bio/TrendChart";
import { reactorTone } from "@/components/bio/ReactorCard";
import { Empty, PageHeader, Panel, SeverityPill, StatusPill, fmtTime } from "@/components/bio/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reactors")({
  validateSearch: (s: Record<string, unknown>): { r: ReactorId } => ({
    r: REACTOR_IDS.includes(s.r as ReactorId) ? (s.r as ReactorId) : "ethanol",
  }),
  head: () => ({
    meta: [
      { title: "Reactor Intelligence — BIOREFINE AI" },
      { name: "description", content: "Detailed digital-twin view, sensor trends, limit checks and AI classification for each reactor." },
      { property: "og:title", content: "Reactor Intelligence — BIOREFINE AI" },
      { property: "og:description", content: "Per-reactor sensor trends, limits and AI anomaly classification." },
    ],
  }),
  component: Reactors,
});

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"];

function Reactors() {
  const { r: id } = Route.useSearch();
  const nav = useNavigate({ from: "/reactors" });
  const reading = useSim((s) => s.current[id]);
  const history = useSim((s) => s.history[id]);
  const limits = useSim((s) => s.settings.limits[id]);
  const sens = useSim((s) => s.settings.sensitivity);
  const unit = useSim((s) => s.settings.tempUnit);
  const allEvents = useSim((s) => s.events);
  const events = useMemo(() => allEvents.filter((e) => e.reactor === id).slice(0, 8), [allEvents, id]);
  const tone = reactorTone(reading);
  const def = REACTORS[id];

  const data = useMemo(
    () => history.slice(-80).map((h) => ({ ts: h.ts, temperature: displayTemp(h.temperature, unit), ph: h.ph, concentration: h.concentration, agitation: h.agitation, score: h.aiScore })),
    [history, unit],
  );

  return (
    <div>
      <PageHeader
        title="Reactor Intelligence"
        sub="Simulated demonstration values — not validated industrial setpoints"
        actions={
          <div className="flex rounded-md border bg-surface p-0.5">
            {REACTOR_IDS.map((r) => (
              <button key={r} onClick={() => nav({ search: { r } })} className={cn("rounded px-3 py-1 text-xs", r === id ? "bg-telemetry text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {REACTORS[r].product}
              </button>
            ))}
          </div>
        }
      />
      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <Panel>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">{def.name}</h2>
              <p className="text-xs text-muted-foreground">{def.organism}</p>
            </div>
            <StatusPill tone={tone} pulse={tone === "crit"}>{tone === "crit" ? "Anomaly" : tone === "warn" ? "Limit" : tone === "ok" ? "Normal" : "—"}</StatusPill>
          </div>
          <ReactorVessel id={id} reading={reading} className="my-5 h-56 w-36" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Last update</span><span className="num">{fmtTime(reading?.ts)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">AI classification</span><span className={cn("num", reading?.aiLabel === "anomaly" ? "text-crit" : "text-ok")}>{reading?.aiLabel ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Anomaly score / threshold</span><span className="num">{reading?.aiScore ?? "n/a"} / {SENSITIVITY_THRESHOLD[sens]}</span></div>
            {reading?.contributors.length ? <p className="rounded border border-crit/40 bg-crit/10 p-2 text-xs text-crit">Contributors: {reading.contributors.join(", ")}</p> : null}
            {reading?.injected && <p className="rounded border border-warn/40 bg-warn/10 p-2 text-xs text-warn">Demo anomaly currently injected.</p>}
          </div>
          <Button className="mt-4 w-full" variant="outline" onClick={() => sim.inject(id)}><Zap className="h-4 w-4" /> Inject demo anomaly</Button>
        </Panel>

        <div className="grid min-w-0 gap-3">
          <Panel title="Sensor readings & operating-limit checks">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {PARAMS.map((p) => {
                const v = reading?.[p];
                const L = limits[p];
                const bad = reading?.violations.includes(p);
                const shown = v === undefined ? "—" : p === "temperature" ? displayTemp(v, unit) : v;
                return (
                  <div key={p} className={cn("rounded-md border bg-surface/60 p-3", bad && "border-warn/60")}>
                    <div className="label-tech">{PARAM_LABEL[p]}</div>
                    <div className={cn("num text-xl", bad ? "text-warn" : "text-telemetry")}>{shown} <span className="text-xs text-muted-foreground">{p === "temperature" ? `°${unit}` : PARAM_UNIT[p]}</span></div>
                    <div className="mt-1 text-[0.68rem] text-muted-foreground">Limit {L.min} – {L.max} {p === "temperature" ? "°C" : PARAM_UNIT[p]}</div>
                    <div className={cn("text-[0.68rem]", bad ? "text-warn" : "text-ok")}>{bad ? "OUT OF LIMIT" : "Within limits"}</div>
                  </div>
                );
              })}
            </div>
          </Panel>
          <div className="grid gap-3 md:grid-cols-2">
            {PARAMS.map((p, i) => (
              <Panel key={p} title={`${PARAM_LABEL[p]} trend`}>
                <TrendChart
                  data={data}
                  series={[{ key: p, name: PARAM_LABEL[p], color: COLORS[i] }]}
                  height={170}
                  refLines={p === "temperature" && unit === "F" ? [] : [
                    { y: limits[p].min, label: "min", color: "var(--color-warn)" },
                    { y: limits[p].max, label: "max", color: "var(--color-warn)" },
                  ]}
                />
              </Panel>
            ))}
          </div>
          <Panel title="Recent reactor events">
            {events.length === 0 ? <Empty>No events for this reactor</Empty> : (
              <ul className="divide-y divide-border text-sm">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                    <SeverityPill s={e.severity} />
                    <span className="num text-xs text-muted-foreground">{fmtTime(e.ts)}</span>
                    <span className="font-medium">{e.type}</span>
                    <span className="w-full text-xs text-muted-foreground md:w-auto md:flex-1">{e.explanation}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
