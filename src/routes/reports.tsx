import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getState, useSim } from "@/lib/sim/engine";
import { DISCLAIMER, download } from "@/lib/sim/csv";
import { currentCSV, eventsCSV, historyCSV, scenarioCSV, yieldCSV } from "@/lib/sim/exports";
import { computeYield, DEFAULT_YIELD } from "@/lib/sim/yield";
import { PARAMS, PARAM_LABEL, PARAM_UNIT, REACTORS, REACTOR_IDS } from "@/lib/sim/types";
import { PageHeader, Panel } from "@/components/bio/ui";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Data Export — BIOREFINE AI" },
      { name: "description", content: "Download simulated readings, history, events, yield and scenario data as CSV, or print a plant summary." },
      { property: "og:title", content: "Reports & Data Export — BIOREFINE AI" },
      { property: "og:description", content: "CSV exports and a print-friendly plant summary." },
    ],
  }),
  component: Reports,
});

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

function printSummary() {
  const s = getState();
  const y = computeYield(DEFAULT_YIELD);
  const rows = REACTOR_IDS.map((id) => {
    const r = s.current[id];
    return `<tr><td>${REACTORS[id].name}</td>${PARAMS.map((p) => `<td>${r ? r[p] : "—"} ${PARAM_UNIT[p]}</td>`).join("")}<td>${r?.aiLabel ?? "—"} (${r?.aiScore ?? "n/a"})</td><td>${r?.violations.map((p) => PARAM_LABEL[p]).join(", ") || "none"}</td></tr>`;
  }).join("");
  const ev = s.events.slice(0, 20).map((e) => `<tr><td>${new Date(e.ts).toLocaleString()}</td><td>${e.reactor}</td><td>${e.severity}</td><td>${e.type}</td><td>${e.explanation}</td><td>${e.acknowledged ? "yes" : "no"}</td></tr>`).join("");
  const html = `<!doctype html><html><head><title>BIOREFINE AI Plant Summary</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{margin:0}table{border-collapse:collapse;width:100%;font-size:12px;margin:12px 0}td,th{border:1px solid #bbb;padding:4px 6px;text-align:left}.d{background:#fff4d6;border:1px solid #e0b84a;padding:8px;font-size:12px}</style></head><body>
<h1>BIOREFINE AI — Plant Summary</h1><p>Generated ${new Date().toLocaleString()} · Simulation ${s.status} · Model: Isolation Forest (${s.model.status})</p>
<p class="d">${DISCLAIMER}</p>
<h2>Current reactor readings</h2><table><tr><th>Reactor</th>${PARAMS.map((p) => `<th>${PARAM_LABEL[p]}</th>`).join("")}<th>AI</th><th>Limit violations</th></tr>${rows}</table>
<h2>Reference yield estimate (1,000 kg wet bagasse, ethanol pathway)</h2><p>Theoretical ${y.theoretical} L · Practical ${y.practical} L · Conversion ${y.conversionEff}%</p>
<h2>Recent events (${s.events.length} total)</h2><table><tr><th>Time</th><th>Source</th><th>Severity</th><th>Type</th><th>Explanation</th><th>Ack</th></tr>${ev}</table>
<script>window.onload=()=>window.print()</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    download(`biorefine-summary-${stamp()}.html`, html, "text/html");
    toast.info("Popup blocked — summary downloaded as HTML instead");
    return;
  }
  w.document.write(html);
  w.document.close();
}

function Reports() {
  const counts = { h: useSim((s) => s.history.ethanol.length + s.history.biogas.length + s.history.fertilizer.length), e: useSim((s) => s.events.length) };
  const items = [
    { t: "Current reactor readings", d: "Latest simulated reading for each reactor (CSV).", f: () => download(`biorefine-current-${stamp()}.csv`, currentCSV(getState().current)) },
    { t: "Historical sensor records", d: `${counts.h} stored readings across all reactors (CSV).`, f: () => download(`biorefine-history-${stamp()}.csv`, historyCSV(getState().history)) },
    { t: "Event history", d: `${counts.e} events with acknowledgement status (CSV).`, f: () => download(`biorefine-events-${stamp()}.csv`, eventsCSV(getState().events)) },
    { t: "Yield prediction results", d: "Default ethanol, biogas & biofertilizer estimates with assumptions (CSV).", f: () => {
      const all = (["ethanol", "biogas", "fertilizer"] as const).map((p) => `# Pathway: ${p}\n` + yieldCSV({ ...DEFAULT_YIELD, pathway: p })).join("\n\n");
      download(`biorefine-yield-${stamp()}.csv`, all);
    } },
    { t: "Scenario comparison", d: "Baseline vs latest saved scenario (or a sample modified scenario) (CSV).", f: () => {
      const sc = getState().scenarios[0]?.inputs ?? { ...DEFAULT_YIELD, hydrolysisEff: 85, temperature: 34 };
      download(`biorefine-scenario-${stamp()}.csv`, scenarioCSV({ ...DEFAULT_YIELD, pathway: sc.pathway }, sc));
    } },
  ];
  return (
    <div>
      <PageHeader title="Reports & Data Export" sub="All exports contain real application data, units, ISO timestamps and a simulation disclaimer" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
          <Panel key={i.t}>
            <FileText className="h-5 w-5 text-telemetry" />
            <h3 className="mt-2 font-semibold">{i.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{i.d}</p>
            <Button className="mt-3" size="sm" onClick={() => { i.f(); toast.success(`${i.t} exported`); }}><Download className="h-3.5 w-3.5" /> Download</Button>
          </Panel>
        ))}
        <Panel>
          <Printer className="h-5 w-5 text-ok" />
          <h3 className="mt-2 font-semibold">Print-friendly plant summary</h3>
          <p className="mt-1 text-sm text-muted-foreground">Opens a printable summary of readings, AI status and recent events.</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={printSummary}><Printer className="h-3.5 w-3.5" /> Open & print</Button>
        </Panel>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{DISCLAIMER}</p>
    </div>
  );
}
