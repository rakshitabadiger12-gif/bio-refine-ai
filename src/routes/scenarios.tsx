import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { computeYield, DEFAULT_YIELD, validate, type YieldInputs } from "@/lib/sim/yield";
import { sim, useSim } from "@/lib/sim/engine";
import { download } from "@/lib/sim/csv";
import { scenarioCSV } from "@/lib/sim/exports";
import { YieldForm } from "@/components/bio/YieldForm";
import { Empty, PageHeader, Panel, fmtDateTime } from "@/components/bio/ui";

export const Route = createFileRoute("/scenarios")({
  head: () => ({
    meta: [
      { title: "Scenario Simulator — BIOREFINE AI" },
      { name: "description", content: "Compare baseline and modified biorefinery operating scenarios side by side." },
      { property: "og:title", content: "Scenario Simulator — BIOREFINE AI" },
      { property: "og:description", content: "Baseline vs modified scenario comparison with saved scenarios." },
    ],
  }),
  component: Scenarios,
});

function Scenarios() {
  const [base] = useState<YieldInputs>(DEFAULT_YIELD);
  const [mod, setMod] = useState<YieldInputs>({ ...DEFAULT_YIELD, hydrolysisEff: 85, temperature: 34 });
  const [name, setName] = useState("");
  const saved = useSim((s) => s.scenarios);
  const errs = validate(mod);
  const baseline = { ...base, pathway: mod.pathway };
  const a = useMemo(() => computeYield(baseline), [mod.pathway]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = useMemo(() => (errs.length ? null : computeYield(mod)), [mod, errs.length]);
  const chart = b
    ? [
        { metric: `Theoretical (${a.primaryUnit})`, Baseline: a.theoretical, Modified: b.theoretical },
        { metric: `Practical (${a.primaryUnit})`, Baseline: a.practical, Modified: b.practical },
      ]
    : [];
  const effChart = b ? [{ metric: "Conversion eff. %", Baseline: a.conversionEff, Modified: b.conversionEff }, { metric: "Condition factor ×100", Baseline: a.conditionFactor * 100, Modified: b.conditionFactor * 100 }] : [];
  const delta = b ? ((b.practical - a.practical) / (a.practical || 1)) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Scenario Simulator"
        sub="Baseline = default operating point for the selected pathway. Results recalculate instantly."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setMod(DEFAULT_YIELD)}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
            <Button size="sm" variant="outline" disabled={!b} onClick={() => download(`biorefine-scenario-${Date.now()}.csv`, scenarioCSV(baseline, mod))}><Download className="h-3.5 w-3.5" /> CSV</Button>
          </>
        }
      />
      <div className="grid gap-3 lg:grid-cols-[380px_1fr]">
        <div className="grid content-start gap-3">
          <Panel title="Modified scenario"><YieldForm value={mod} onChange={setMod} /></Panel>
          <Panel title="Save scenario">
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Scenario name" maxLength={60} className="min-w-0 flex-1 rounded-md border bg-surface px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <Button size="sm" disabled={!b || !name.trim()} onClick={() => { sim.saveScenario(name.trim(), mod); setName(""); toast.success("Scenario saved"); }}><Save className="h-3.5 w-3.5" /> Save</Button>
            </div>
          </Panel>
        </div>
        <div className="grid min-w-0 content-start gap-3">
          {!b ? <Panel><p className="text-sm text-crit">Invalid inputs: {errs.join("; ")}</p></Panel> : (
            <>
              <Panel title={`${a.primaryLabel}: baseline vs modified`} action={<span className={`num text-sm ${delta >= 0 ? "text-ok" : "text-crit"}`}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}% practical</span>}>
                <div className="grid gap-3 md:grid-cols-2">
                  {[chart, effChart].map((d, i) => (
                    <div key={i} className="h-[240px] min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={d} margin={{ left: -8, right: 8, top: 6 }}>
                          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" opacity={0.5} />
                          <XAxis dataKey="metric" stroke="var(--color-muted-foreground)" fontSize={10} />
                          <YAxis stroke="var(--color-muted-foreground)" fontSize={10} />
                          <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="Baseline" fill="var(--color-muted-foreground)" />
                          <Bar dataKey="Modified" fill="var(--color-telemetry)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Comparison table">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="label-tech text-left"><tr><th className="py-1">Metric</th><th>Baseline</th><th>Modified</th></tr></thead>
                    <tbody className="num">
                      {[
                        ["Dry feed (kg)", a.dryMassKg, b.dryMassKg],
                        [`Theoretical (${a.primaryUnit})`, a.theoretical, b.theoretical],
                        [`Practical (${a.primaryUnit})`, a.practical, b.practical],
                        ["Conversion efficiency (%)", a.conversionEff, b.conversionEff],
                        ["Condition factor", a.conditionFactor, b.conditionFactor],
                        ...a.secondary.map((s, i) => [`${s.label} (${s.unit})`, s.value, b.secondary[i]?.value ?? 0]),
                      ].map(([k, x, y]) => (
                        <tr key={String(k)} className="border-t border-border/50"><td className="py-1.5 font-sans">{k}</td><td>{Number(x).toLocaleString()}</td><td className="text-telemetry">{Number(y).toLocaleString()}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}
          <Panel title="Saved scenarios">
            {saved.length === 0 ? <Empty>No saved scenarios yet</Empty> : (
              <ul className="divide-y divide-border text-sm">
                {saved.map((s) => {
                  const r = computeYield(s.inputs);
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{fmtDateTime(s.ts)} · {s.inputs.pathway} · {r.practical.toLocaleString()} {r.primaryUnit}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setMod(s.inputs)}><Upload className="h-3.5 w-3.5" /> Load</Button>
                      <Button size="sm" variant="ghost" onClick={() => sim.deleteScenario(s.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
