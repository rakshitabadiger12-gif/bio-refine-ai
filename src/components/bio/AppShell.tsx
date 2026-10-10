import { Link, useHydrated, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity, BarChart3, Bell, Cpu, Factory, FileDown, FlaskConical, GitBranch, Menu, Pause, Play, RotateCcw, Settings, Sliders, Sparkles, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { bootSimulation, sim, useSim } from "@/lib/sim/engine";
import { REACTORS, REACTOR_IDS } from "@/lib/sim/types";
import { StatusPill, fmtTime } from "./ui";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Plant Overview", icon: Factory },
  { to: "/reactors", label: "Reactor Intelligence", icon: FlaskConical },
  { to: "/digital-twin", label: "Process Digital Twin", icon: GitBranch },
  { to: "/analytics", label: "AI Analytics", icon: BarChart3 },
  { to: "/yield", label: "Yield Prediction", icon: Activity },
  { to: "/yield-predictor", label: "Yield Predictor", icon: Sparkles },
  { to: "/events", label: "Event & Alarm Center", icon: Bell },
  { to: "/scenarios", label: "Scenario Simulator", icon: Sliders },
  { to: "/reports", label: "Reports & Export", icon: FileDown },
  { to: "/settings", label: "System Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const status = useSim((s) => s.status);
  const lastSync = useSim((s) => s.lastSync);
  const model = useSim((s) => s.model.status);
  const unack = useSim((s) => s.events.filter((e) => !e.acknowledged && e.severity !== "info").length);

  useEffect(() => {
    bootSimulation();
  }, []);
  useEffect(() => setOpen(false), [path]);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-sidebar-border bg-sidebar transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-telemetry/15 text-telemetry glow"><Cpu className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold tracking-wider">BIOREFINE AI</div>
            <div className="label-tech !text-[0.58rem]">Biorefinery Intelligence</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></button>
        </div>
        <nav className="space-y-0.5 p-2">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent text-telemetry",
                )}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{n.label}</span>
                {n.to === "/events" && unack > 0 && (
                  <span className="num ml-auto rounded bg-crit/20 px-1.5 text-[0.65rem] text-crit">{unack}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="absolute inset-x-0 bottom-0 space-y-2 border-t border-sidebar-border p-3 text-xs">
          <div className="label-tech">Inject demo anomaly</div>
          <div className="grid grid-cols-3 gap-1">
            {REACTOR_IDS.map((id) => (
              <button key={id} onClick={() => sim.inject(id)} className="rounded border border-warn/40 bg-warn/10 px-1 py-1 font-mono text-[0.62rem] text-warn hover:bg-warn/20" title={`Inject into ${REACTORS[id].name}`}>
                <Zap className="mx-auto mb-0.5 h-3 w-3" />{REACTORS[id].short.split(" ")[0]}
              </button>
            ))}
          </div>
          <p className="text-[0.62rem] leading-snug text-muted-foreground">Simulated demonstration. Not certified industrial control software.</p>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-background/70 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:px-5">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <StatusPill tone={status === "running" ? "ok" : status === "paused" ? "warn" : "muted"} pulse={status === "running"}>
            SIM {status}
          </StatusPill>
          <span className="hidden sm:inline">
            <StatusPill tone={model === "ready" ? "telemetry" : model === "initializing" ? "warn" : "crit"}>IForest {model}</StatusPill>
          </span>
          <span className="label-tech hidden md:inline">Sync {fmtTime(lastSync)}</span>
          <div className="ml-auto flex items-center gap-1.5">
            {status === "running" ? (
              <Button size="sm" variant="outline" onClick={() => sim.pause()}><Pause className="h-3.5 w-3.5" /> Pause</Button>
            ) : (
              <Button size="sm" onClick={() => sim.start()}><Play className="h-3.5 w-3.5" /> {status === "paused" ? "Resume" : "Start"}</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => sim.reset()} title="Reset simulation to initial setpoints"><RotateCcw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Reset</span></Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 md:p-5">{hydrated ? children : <div className="label-tech p-10 text-center">Connecting to simulation engine…</div>}</main>
      </div>
    </div>
  );
}
