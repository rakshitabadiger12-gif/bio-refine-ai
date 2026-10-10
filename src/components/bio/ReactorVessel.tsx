import type { Reading, ReactorId } from "@/lib/sim/types";
import { REACTORS } from "@/lib/sim/types";
import { cn } from "@/lib/utils";

const LIQUID: Record<ReactorId, string> = {
  ethanol: "var(--grad-liquid-ethanol)",
  biogas: "var(--grad-liquid-biogas)",
  fertilizer: "var(--grad-liquid-fertilizer)",
};

export function ReactorVessel({ id, reading, className }: { id: ReactorId; reading: Reading | null; className?: string }) {
  const level = reading ? Math.min(85, Math.max(35, (reading.concentration / (REACTORS[id].initial.concentration * 1.4)) * 80)) : 60;
  const rpm = reading?.agitation ?? 0;
  const anomaly = reading?.aiLabel === "anomaly";
  const warn = (reading?.violations.length ?? 0) > 0;
  const ring = anomaly ? "border-crit" : warn ? "border-warn" : "border-telemetry/50";
  return (
    <div className={cn("relative mx-auto h-48 w-32", className)} aria-label={`${REACTORS[id].name} vessel`}>
      {/* motor */}
      <div className="absolute left-1/2 top-0 h-5 w-10 -translate-x-1/2 rounded-t-md border bg-surface" />
      <div className="absolute left-1/2 top-5 h-[calc(100%-1.75rem)] w-0.5 -translate-x-1/2 bg-muted-foreground/60 z-10" />
      {/* tank */}
      <div className={cn("absolute inset-x-0 bottom-0 top-6 overflow-hidden rounded-b-[2.5rem] rounded-t-xl border-2 bg-surface/60 transition-colors", ring, anomaly && "glow")}>
        <div className="absolute inset-x-0 bottom-0 transition-all duration-1000" style={{ height: `${level}%`, background: LIQUID[id] }}>
          {[15, 40, 62, 80].map((l, i) => (
            <span key={l} className="anim-bubble absolute bottom-1 h-1.5 w-1.5 rounded-full bg-foreground/50" style={{ left: `${l}%`, animationDelay: `${i * 0.7}s` }} />
          ))}
        </div>
        {/* impeller */}
        <svg className="absolute bottom-6 left-1/2 z-10 h-6 w-14 -translate-x-1/2" viewBox="0 0 56 24">
          <g className="anim-spin" style={{ ["--spin" as string]: rpm > 0 ? `${Math.max(0.25, 60 / rpm)}s` : "0s" }}>
            <rect x="4" y="10" width="48" height="4" rx="2" fill="currentColor" className="text-muted-foreground" />
          </g>
        </svg>
        {/* gauges */}
        <div className="absolute inset-x-2 top-2 flex justify-between font-mono text-[0.6rem] text-foreground/80">
          <span>{reading ? `${reading.temperature.toFixed(1)}°` : "--"}</span>
          <span>pH {reading ? reading.ph.toFixed(2) : "--"}</span>
        </div>
      </div>
      {/* legs */}
      <div className="absolute -bottom-2 left-4 h-3 w-1 bg-border" />
      <div className="absolute -bottom-2 right-4 h-3 w-1 bg-border" />
    </div>
  );
}
