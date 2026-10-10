import { toCSV } from "./csv";
import { computeYield, type YieldInputs } from "./yield";
import { PARAMS, REACTORS, REACTOR_IDS, type PlantEvent, type ReactorId, type Reading } from "./types";

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

export function scenarioCSV(base: YieldInputs, mod: YieldInputs) {
  const a = computeYield(base);
  const b = computeYield(mod);
  const keys = Object.keys(base) as (keyof YieldInputs)[];
  const rows: unknown[][] = [
    ...keys.map((k) => ["input", k, base[k], mod[k], ""]),
    ["result", `theoretical ${a.primaryLabel} (${a.primaryUnit})`, a.theoretical, b.theoretical, b.primaryUnit],
    ["result", `practical ${a.primaryLabel} (${a.primaryUnit})`, a.practical, b.practical, b.primaryUnit],
    ["result", "conversion efficiency", a.conversionEff, b.conversionEff, "%"],
    ["result", "condition factor", a.conditionFactor, b.conditionFactor, "-"],
  ];
  return toCSV(["kind", "name", "baseline", "modified", "unit"], rows);
}

const H = ["timestamp_iso", "reactor", "temperature_C", "pH", "concentration_g_per_L", "agitation_RPM", "ai_label", "ai_score", "ai_contributors", "limit_violations", "demo_injected", "source"];
const row = (r: Reading) => [new Date(r.ts).toISOString(), REACTORS[r.reactor].name, r.temperature, r.ph, r.concentration, r.agitation, r.aiLabel, r.aiScore, r.contributors.join("; "), r.violations.join("; "), r.injected, "simulated"];

export const currentCSV = (cur: Record<ReactorId, Reading | null>) => toCSV(H, REACTOR_IDS.map((id) => cur[id]).filter((x): x is Reading => !!x).map(row));
export const historyCSV = (h: Record<ReactorId, Reading[]>) => toCSV(H, REACTOR_IDS.flatMap((id) => h[id]).sort((a, b) => a.ts - b.ts).map(row));
export const eventsCSV = (ev: PlantEvent[]) =>
  toCSV(
    ["timestamp_iso", "reactor", "severity", "type", "parameter", "observed_value", "limit", "ai_classification", "explanation", "acknowledged"],
    ev.map((e) => [new Date(e.ts).toISOString(), e.reactor === "plant" ? "Plant" : REACTORS[e.reactor].name, e.severity, e.type, e.parameter ?? "", e.value ?? "", e.limit ?? "", e.aiClass ?? "", e.explanation, e.acknowledged]),
  );
export { PARAMS };
