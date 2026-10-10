import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeYield, DEFAULT_YIELD, validate, type YieldInputs } from "@/lib/sim/yield";
import { download, toCSV } from "@/lib/sim/csv";
import { YieldForm } from "@/components/bio/YieldForm";
import { Kpi, PageHeader, Panel } from "@/components/bio/ui";

export const Route = createFileRoute("/yield")({
  head: () => ({
    meta: [
      { title: "Yield Prediction — BIOREFINE AI" },
      { name: "description", content: "Transparent mass-balance estimates of ethanol, biogas and biofertilizer output from bagasse." },
      { property: "og:title", content: "Yield Prediction — BIOREFINE AI" },
      { property: "og:description", content: "Theoretical vs practical yield estimates with disclosed assumptions." },
    ],
  }),
  component: YieldPage,
});

export function yieldCSV(i: YieldInputs) {
  const r = computeYield(i);
  const rows: unknown[][] = [
    ...Object.entries(i).map(([k, v]) => ["input", k, v, ""]),
    ["result", "dry_mass", r.dryMassKg, "kg"],
    ["result", "condition_factor", r.conditionFactor, "-"],
    ["result", `theoretical_${r.primaryLabel}`, r.theoretical, r.primaryUnit],
    ["result", `practical_${r.primaryLabel}`, r.practical, r.primaryUnit],
    ["result", "conversion_efficiency", r.conversionEff, "%"],
    ...r.secondary.map((s) => ["result", s.label, s.value, s.unit]),
    ...r.assumptions.map((a) => ["assumption", a, "", ""]),
  ];
  return toCSV(["kind", "name", "value", "unit"], rows);
}

function YieldPage() {
  const [inp, setInp] = useState<YieldInputs>(DEFAULT_YIELD);
  const errors = validate(inp);
  const res = useMemo(() => (errors.length ? null : computeYield(inp)), [inp, errors.length]);
  return (
    <div>
      <PageHeader
        title="Yield Prediction"
        sub="Simplified mass-balance estimates — not a trained model, not experimental measurements"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setInp(DEFAULT_YIELD)}><RotateCcw className="h-3.5 w-3.5" /> Defaults</Button>
            <Button size="sm" disabled={!res} onClick={() => download(`biorefine-yield-${inp.pathway}-${Date.now()}.csv`, yieldCSV(inp))}><Download className="h-3.5 w-3.5" /> Export CSV</Button>
          </>
        }
      />
      <div className="grid gap-3 lg:grid-cols-[380px_1fr]">
        <Panel title="Inputs"><YieldForm value={inp} onChange={setInp} /></Panel>
        <div className="grid min-w-0 content-start gap-3">
          {!res ? (
            <Panel><p className="text-sm text-crit">Fix invalid inputs: {errors.join("; ")}</p></Panel>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi label={`Theoretical ${res.primaryLabel}`} value={`${res.theoretical.toLocaleString()} ${res.primaryUnit}`} />
                <Kpi label={`Practical estimate`} value={`${res.practical.toLocaleString()} ${res.primaryUnit}`} tone="ok" />
                <Kpi label="Conversion efficiency" value={`${res.conversionEff}%`} tone={res.conversionEff > 60 ? "ok" : "warn"} sub="practical / theoretical" />
                <Kpi label="Dry feed" value={`${res.dryMassKg.toLocaleString()} kg`} sub={`Condition factor ${res.conditionFactor}`} />
              </div>
              <Panel title="Derived quantities">
                <div className="grid gap-2 sm:grid-cols-2">
                  {res.secondary.map((s) => (
                    <div key={s.label} className="flex justify-between rounded border bg-surface/60 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="num text-telemetry">{s.value.toLocaleString()} {s.unit}</span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Assumptions & formulas">
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {res.assumptions.map((a) => <li key={a}>{a}</li>)}
                  <li>Condition factor = exp(−((T−T<sub>opt</sub>)/8)²) · exp(−((pH−pH<sub>opt</sub>)/1.2)²) · exp(−((RPM−RPM<sub>opt</sub>)/(0.9·RPM<sub>opt</sub>))²).</li>
                </ul>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
