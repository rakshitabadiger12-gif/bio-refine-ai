import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { displayTemp, sim, useSim } from "@/lib/sim/engine";
import { PARAMS, PARAM_LABEL, PARAM_UNIT, REACTORS, type ReactorId } from "@/lib/sim/types";
import { ReactorVessel } from "./ReactorVessel";
import { StatusPill, fmtTime } from "./ui";
import { cn } from "@/lib/utils";

export function reactorTone(r: { aiLabel: string; violations: unknown[] } | null) {
  if (!r) return "muted" as const;
  if (r.aiLabel === "anomaly") return "crit" as const;
  if (r.violations.length) return "warn" as const;
  return "ok" as const;
}

export function ReactorCard({ id }: { id: ReactorId }) {
  const r = useSim((s) => s.current[id]);
  const unit = useSim((s) => s.settings.tempUnit);
  const def = REACTORS[id];
  const tone = reactorTone(r);
  return (
    <div className={cn("panel flex min-w-0 flex-col p-4", tone === "crit" && "border-crit/60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="label-tech">{def.product}</div>
          <Link to="/reactors" search={{ r: id }} className="block truncate font-display font-semibold hover:text-telemetry">{def.name}</Link>
        </div>
        <StatusPill tone={tone} pulse={tone === "crit"}>{tone === "crit" ? "AI anomaly" : tone === "warn" ? "Limit alert" : tone === "ok" ? "Normal" : "No data"}</StatusPill>
      </div>
      <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-4">
        <ReactorVessel id={id} reading={r} className="h-40 w-24" />
        <dl className="grid min-w-0 gap-1.5 text-sm">
          {PARAMS.map((p) => {
            const v = r?.[p];
            const bad = r?.violations.includes(p);
            return (
              <div key={p} className="flex items-baseline justify-between gap-2 border-b border-border/50 pb-1">
                <dt className="text-xs text-muted-foreground">{PARAM_LABEL[p]}</dt>
                <dd className={cn("num", bad ? "text-warn" : "text-telemetry")}>
                  {v === undefined ? "—" : p === "temperature" ? `${displayTemp(v, unit)} °${unit}` : `${v.toFixed(p === "ph" ? 2 : 1)} ${PARAM_UNIT[p]}`}
                </dd>
              </div>
            );
          })}
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-muted-foreground">AI score</dt>
            <dd className={cn("num", r?.aiLabel === "anomaly" ? "text-crit" : "text-ok")}>{r?.aiScore ?? "n/a"}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="label-tech">Updated {fmtTime(r?.ts)} · simulated</span>
        <button onClick={() => sim.inject(id)} className="inline-flex items-center gap-1 rounded border border-warn/40 px-2 py-0.5 text-xs text-warn hover:bg-warn/10"><Zap className="h-3 w-3" /> Inject</button>
      </div>
    </div>
  );
}
