import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { displayTemp, useSim } from "@/lib/sim/engine";
import { PARAMS, PARAM_LABEL, REACTORS, REACTOR_IDS, SENSITIVITY_THRESHOLD, type Param, type ReactorId } from "@/lib/sim/types";
import { TrendChart, REACTOR_COLORS } from "@/components/bio/TrendChart";
import { Empty, Kpi, PageHeader, Panel, Select, fmtDateTime, fmtTime } from "@/components/bio/ui";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "AI Analytics — BIOREFINE AI" },
      { name: "description", content: "Sensor trends, reactor comparison, anomaly history and Isolation Forest model status." },
      { property: "og:title", content: "AI Analytics — BIOREFINE AI" },
      { property: "og:description", content: "Trends, anomaly history and model status from stored simulation records." },
    ],
  }),
  component: Analytics,
});

const RANGES = { "60": "Last 60 readings", "200": "Last 200 readings", all: "All stored" } as const;
type Range = keyof typeof RANGES;

function Analytics() {
  const history = useSim((s) => s.history);
  const model = useSim((s) => s.model);
  const sens = useSim((s) => s.settings.sensitivity);
  const unit = useSim((s) => s.settings.tempUnit);
  const [reactor, setReactor] = useState<ReactorId | "all">("all");
  const [range, setRange] = useState<Range>("200");
  const [param, setParam] = useState<Param>("temperature");

  const ids = reactor === "all" ? REACTOR_IDS : [reactor];
  const sliced = useMemo(() => {
    const out = {} as Record<ReactorId, typeof history.ethanol>;
    for (const id of REACTOR_IDS) out[id] = range === "all" ? history[id] : history[id].slice(-Number(range));
    return out;
  }, [history, range]);

  const trend = useMemo(() => {
    const n = Math.max(...ids.map((id) => sliced[id].length));
    const rows: Record<string, number | null>[] = [];
    for (let i = 0; i < n; i++) {
      const row: Record<string, number | null> = { ts: null };
      for (const id of ids) {
        const h = sliced[id];
        const r = h[h.length - (n - i)];
        if (r) {
          row.ts = r.ts;
          row[id] = param === "temperature" ? displayTemp(r.temperature, unit) : r[param];
          row[`${id}_score`] = r.aiScore;
        }
      }
      if (row.ts) rows.push(row);
    }
    return rows;
  }, [sliced, ids, param, unit]);

  const comparison = useMemo(
    () =>
      REACTOR_IDS.map((id) => {
        const h = sliced[id];
        return {
          name: REACTORS[id].product,
          anomalies: h.filter((r) => r.aiLabel === "anomaly").length,
          violations: h.filter((r) => r.violations.length > 0).length,
          avgScore: h.length ? Number((h.reduce((a, r) => a + (r.aiScore ?? 0), 0) / h.length).toFixed(3)) : 0,
        };
      }),
    [sliced],
  );

  const anomalyRows = useMemo(
    () => ids.flatMap((id) => sliced[id].filter((r) => r.aiLabel === "anomaly" || r.violations.length)).sort((a, b) => b.ts - a.ts).slice(0, 40),
    [sliced, ids],
  );
  const latest = useMemo(() => ids.map((id) => history[id][history[id].length - 1]).filter(Boolean).sort((a, b) => b.ts - a.ts)[0], [history, ids]);
  const total = ids.reduce((a, id) => a + sliced[id].length, 0);

  return (
    <div>
      <PageHeader title="AI Analytics" sub="Computed from stored simulation records" />
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select label="Reactor" value={reactor} onChange={setReactor} options={[{ value: "all", label: "All reactors" }, ...REACTOR_IDS.map((id) => ({ value: id, label: REACTORS[id].name }))]} />
        <Select label="Time range" value={range} onChange={setRange} options={(Object.keys(RANGES) as Range[]).map((k) => ({ value: k, label: RANGES[k] }))} />
        <Select label="Parameter" value={param} onChange={setParam} options={PARAMS.map((p) => ({ value: p, label: PARAM_LABEL[p] }))} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Model" value={model.status.toUpperCase()} tone={model.status === "ready" ? "ok" : "warn"} sub={`Isolation Forest · ${model.trees} trees · ${model.baselineSize} baseline/reactor`} />
        <Kpi label="Threshold" value={SENSITIVITY_THRESHOLD[sens]} sub={`Sensitivity: ${sens}`} />
        <Kpi label="Latest prediction" value={latest ? `${latest.aiLabel} ${latest.aiScore ?? ""}` : "—"} tone={latest?.aiLabel === "anomaly" ? "crit" : "ok"} sub={latest ? `${REACTORS[latest.reactor].short} · ${fmtTime(latest.ts)}` : ""} />
        <Kpi label="Records analysed" value={total} sub={`Trained ${fmtDateTime(model.trainedAt)}`} />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Panel title={`${PARAM_LABEL[param]} trend`}>
          <TrendChart data={trend} series={ids.map((id) => ({ key: id, name: REACTORS[id].short, color: REACTOR_COLORS[id] }))} height={260} />
        </Panel>
        <Panel title="Anomaly score trend">
          <TrendChart
            data={trend}
            series={ids.map((id) => ({ key: `${id}_score`, name: `${REACTORS[id].product} score`, color: REACTOR_COLORS[id] }))}
            height={260}
            refLines={[{ y: SENSITIVITY_THRESHOLD[sens], label: "threshold", color: "var(--color-crit)" }]}
          />
        </Panel>
        <Panel title="Reactor comparison (records in range)">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison} margin={{ left: -16, right: 8, top: 6 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" opacity={0.5} />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="anomalies" name="AI anomalies" fill="var(--color-crit)" />
                <Bar dataKey="violations" name="Limit violations" fill="var(--color-warn)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Anomaly & limit-violation history">
          {anomalyRows.length === 0 ? <Empty>No anomalies or violations in range — try “Inject” in the sidebar</Empty> : (
            <div className="max-h-[260px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="label-tech sticky top-0 bg-card text-left"><tr><th className="py-1">Time</th><th>Reactor</th><th>AI</th><th>Score</th><th>Limits violated</th></tr></thead>
                <tbody>
                  {anomalyRows.map((r) => (
                    <tr key={r.id} className="border-t border-border/50">
                      <td className="num py-1">{fmtTime(r.ts)}</td>
                      <td>{REACTORS[r.reactor].product}</td>
                      <td className={r.aiLabel === "anomaly" ? "text-crit" : "text-ok"}>{r.aiLabel}</td>
                      <td className="num">{r.aiScore}</td>
                      <td className="text-warn">{r.violations.map((p) => PARAM_LABEL[p]).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
