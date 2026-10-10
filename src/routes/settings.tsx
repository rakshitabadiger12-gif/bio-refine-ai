import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { sim, useSim } from "@/lib/sim/engine";
import { DEFAULT_LIMITS, PARAMS, PARAM_LABEL, PARAM_UNIT, REACTORS, REACTOR_IDS, SENSITIVITY_THRESHOLD, type Limits, type Sensitivity } from "@/lib/sim/types";
import { NumField, PageHeader, Panel, Select } from "@/components/bio/ui";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "System Settings — BIOREFINE AI" },
      { name: "description", content: "Configure simulation interval, operating limits, retention, anomaly sensitivity and units." },
      { property: "og:title", content: "System Settings — BIOREFINE AI" },
      { property: "og:description", content: "Simulation and operating-limit configuration." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useSim((s) => s.settings);
  const storage = useSim((s) => s.storage);
  const [limits, setLimits] = useState<Limits>(settings.limits);
  useEffect(() => setLimits(settings.limits), [settings.limits]);
  const invalid = REACTOR_IDS.some((id) => PARAMS.some((p) => !(limits[id][p].min < limits[id][p].max)));

  return (
    <div>
      <PageHeader title="System Settings" sub={`Settings persist in ${storage === "localStorage" ? "browser storage" : "memory only (storage unavailable)"}`} />
      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Simulation">
          <div className="grid gap-3">
            <Select label="Update interval" value={String(settings.intervalMs)} onChange={(v) => { sim.updateSettings({ intervalMs: Number(v) }); toast.success("Interval updated"); }}
              options={[1000, 2000, 3000, 5000, 10000].map((v) => ({ value: String(v), label: `${v / 1000} s${v === 3000 ? " (default)" : ""}` }))} />
            <Select label="Data retention (readings / reactor)" value={String(settings.retention)} onChange={(v) => sim.updateSettings({ retention: Number(v) })}
              options={[100, 200, 400, 1000, 2000].map((v) => ({ value: String(v), label: String(v) }))} />
          </div>
        </Panel>
        <Panel title="AI anomaly detection">
          <Select<Sensitivity> label="Sensitivity" value={settings.sensitivity} onChange={(v) => sim.updateSettings({ sensitivity: v })}
            options={(["low", "medium", "high"] as Sensitivity[]).map((s) => ({ value: s, label: `${s} (score ≥ ${SENSITIVITY_THRESHOLD[s]})` }))} />
          <p className="mt-2 text-xs text-muted-foreground">Higher sensitivity lowers the Isolation Forest threshold and flags more observations.</p>
        </Panel>
        <Panel title="Units & environment">
          <Select label="Temperature display" value={settings.tempUnit} onChange={(v) => sim.updateSettings({ tempUnit: v })} options={[{ value: "C", label: "Celsius (°C)" }, { value: "F", label: "Fahrenheit (°F)" }]} />
          <p className="mt-2 text-xs text-muted-foreground">Limits and exports remain in °C.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button className="mt-4 w-full" variant="destructive" size="sm"><RotateCcw className="h-3.5 w-3.5" /> Reset demo environment</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the demonstration environment?</AlertDialogTitle>
                <AlertDialogDescription>Clears history, events, scenarios and settings, retrains the model and restarts the simulation.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { sim.resetDemo(); toast.success("Demo environment reset"); }}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Panel>
      </div>
      <Panel className="mt-3" title="Per-reactor operating limits (rule-based, independent of AI)" action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setLimits(DEFAULT_LIMITS)}>Defaults</Button>
          <Button size="sm" disabled={invalid} onClick={() => { sim.updateSettings({ limits }); toast.success("Limits saved"); }}><Save className="h-3.5 w-3.5" /> Save limits</Button>
        </div>
      }>
        {invalid && <p className="mb-2 text-xs text-crit">Each minimum must be lower than its maximum.</p>}
        <div className="grid gap-3 lg:grid-cols-3">
          {REACTOR_IDS.map((id) => (
            <div key={id} className="rounded-md border bg-surface/40 p-3">
              <div className="mb-2 font-medium">{REACTORS[id].name}</div>
              <div className="grid gap-2">
                {PARAMS.map((p) => (
                  <div key={p} className="grid grid-cols-2 gap-2">
                    {(["min", "max"] as const).map((k) => (
                      <NumField key={k} label={`${PARAM_LABEL[p]} ${k}`} unit={p === "temperature" ? "°C" : PARAM_UNIT[p] || undefined} min={0} max={p === "ph" ? 14 : 1000} step={p === "ph" ? 0.1 : 1}
                        value={limits[id][p][k]} onChange={(v) => setLimits({ ...limits, [id]: { ...limits[id], [p]: { ...limits[id][p], [k]: v } } })} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
