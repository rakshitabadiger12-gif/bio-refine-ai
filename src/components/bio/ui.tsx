import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/sim/types";

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("panel p-4 min-w-0", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold tracking-wide text-foreground">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub, tone = "telemetry" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "telemetry" | "ok" | "warn" | "crit" }) {
  const toneCls = { telemetry: "text-telemetry", ok: "text-ok", warn: "text-warn", crit: "text-crit" }[tone];
  return (
    <div className="panel p-4 min-w-0">
      <div className="label-tech">{label}</div>
      <div className={cn("num mt-1 text-2xl font-semibold truncate", toneCls)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

export function StatusPill({ tone, children, pulse }: { tone: "ok" | "warn" | "crit" | "telemetry" | "muted"; children: ReactNode; pulse?: boolean }) {
  const map = {
    ok: "text-ok border-ok/40 bg-ok/10",
    warn: "text-warn border-warn/40 bg-warn/10",
    crit: "text-crit border-crit/50 bg-crit/10",
    telemetry: "text-telemetry border-telemetry/40 bg-telemetry/10",
    muted: "text-muted-foreground border-border bg-surface",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[0.68rem] uppercase tracking-wider", map)}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", pulse && "anim-pulse")} />
      {children}
    </span>
  );
}

export function SeverityPill({ s }: { s: Severity }) {
  return <StatusPill tone={s === "critical" ? "crit" : s === "warning" ? "warn" : "telemetry"}>{s}</StatusPill>;
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">{children}</div>;
}

export function NumField({ label, value, onChange, min, max, step = 1, unit }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  const invalid = !Number.isFinite(value) || value < min || value > max;
  return (
    <label className="block min-w-0">
      <span className="label-tech">{label}{unit ? ` (${unit})` : ""}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        className={cn("num mt-1 w-full rounded-md border bg-surface px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring", invalid && "border-crit")}
      />
      {invalid && <span className="mt-0.5 block text-[0.68rem] text-crit">Range {min} – {max}</span>}
    </label>
  );
}

export function Select<T extends string>({ label, value, onChange, options }: { label?: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <label className="block min-w-0">
      {label && <span className="label-tech">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1 w-full rounded-md border bg-surface px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export const fmtTime = (ts: number | null | undefined) => (ts ? new Date(ts).toLocaleTimeString([], { hour12: false }) : "—");
export const fmtDateTime = (ts: number | null | undefined) => (ts ? new Date(ts).toLocaleString([], { hour12: false }) : "—");
