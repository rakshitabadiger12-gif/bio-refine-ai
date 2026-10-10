import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/bio/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/digital-twin")({
  head: () => ({
    meta: [
      { title: "Process Digital Twin — BIOREFINE AI" },
      { name: "description", content: "Interactive process-flow diagram from sugarcane bagasse to bioethanol, biogas and biofertilizer." },
      { property: "og:title", content: "Process Digital Twin — BIOREFINE AI" },
      { property: "og:description", content: "Interactive biorefinery process flow with stage details." },
    ],
  }),
  component: Twin,
});

interface Stage {
  id: string;
  name: string;
  lane: "common" | "ethanol" | "biogas" | "fertilizer" | "pha";
  desc: string;
  inputs: string[];
  outputs: string[];
  params: string[];
}

const STAGES: Stage[] = [
  { id: "feed", name: "Sugarcane bagasse", lane: "common", desc: "Fibrous residue from sugarcane milling; lignocellulosic feedstock (~42% cellulose, 28% hemicellulose, 22% lignin, dry basis).", inputs: ["Mill residue"], outputs: ["Wet bagasse (~50% moisture)"], params: ["Moisture 45–55%", "Bulk density ~120 kg/m³"] },
  { id: "size", name: "Size reduction", lane: "common", desc: "Milling and screening increase surface area and improve downstream enzyme accessibility.", inputs: ["Wet bagasse"], outputs: ["Particles 1–5 mm"], params: ["Hammer mill", "Screen 2 mm", "Specific energy ~50 kWh/t"] },
  { id: "pre", name: "Pretreatment", lane: "common", desc: "Dilute-acid or steam explosion disrupts the lignin-carbohydrate matrix and solubilises hemicellulose.", inputs: ["Milled bagasse", "Dilute H₂SO₄ / steam"], outputs: ["Pretreated slurry", "Pentose liquor"], params: ["160–190 °C", "5–15 min", "1–2% acid"] },
  { id: "hyd", name: "Enzymatic hydrolysis", lane: "common", desc: "Cellulase cocktails convert cellulose into glucose; efficiency is the Yield page hydrolysis input.", inputs: ["Pretreated slurry", "Cellulase"], outputs: ["Sugar hydrolysate", "Lignin-rich solids"], params: ["50 °C", "pH 4.8", "48–72 h"] },
  { id: "e-ferm", name: "Ethanol fermentation (R-101)", lane: "ethanol", desc: "Yeast converts hexose (and engineered strains pentose) sugars to ethanol and CO₂.", inputs: ["Sugar hydrolysate", "S. cerevisiae"], outputs: ["Beer (5–8% v/v ethanol)", "CO₂"], params: ["32 °C", "pH 5.1", "200 RPM"] },
  { id: "e-rec", name: "Distillation & dehydration", lane: "ethanol", desc: "Distillation to ~95% then molecular sieves to anhydrous fuel ethanol.", inputs: ["Beer"], outputs: ["Bioethanol 99.5%", "Stillage → digester"], params: ["Column 78–100 °C", "Mol-sieve 3Å"] },
  { id: "b-ad", name: "Anaerobic digestion (R-201)", lane: "biogas", desc: "Mesophilic consortia hydrolyse, acidify and methanise residual organics and stillage.", inputs: ["Stillage", "Residual solids"], outputs: ["Raw biogas (55–65% CH₄)", "Digestate"], params: ["37 °C", "pH 7.0", "100 RPM", "HRT 20–30 d"] },
  { id: "b-up", name: "Biogas upgrading", lane: "biogas", desc: "H₂S scrubbing and CO₂ removal to bio-methane or direct CHP use.", inputs: ["Raw biogas"], outputs: ["Biomethane / power", "CO₂"], params: ["Water scrubbing", "CH₄ >95%"] },
  { id: "f-comp", name: "Aerobic bioconversion (R-301)", lane: "fertilizer", desc: "Lignin-rich solids and digestate are stabilised with a nitrogen-fixing/phosphate-solubilising consortium.", inputs: ["Lignin solids", "Digestate", "Inoculum"], outputs: ["Stabilised biomass"], params: ["30 °C", "pH 6.8", "160 RPM aeration"] },
  { id: "f-form", name: "Formulation", lane: "fertilizer", desc: "Drying, granulation and carrier blending to a field-ready biofertilizer.", inputs: ["Stabilised biomass"], outputs: ["Biofertilizer granules"], params: ["Moisture <20%", "CFU ≥10⁷ /g (target)"] },
  { id: "p-pha", name: "PHA bioplastics (proposed)", lane: "pha", desc: "Optional extension: pentose liquor fed to PHA-accumulating bacteria for biodegradable polymer.", inputs: ["Pentose liquor"], outputs: ["PHA granules"], params: ["Proposed pathway — not simulated"] },
];

const LANES: { id: Stage["lane"]; label: string; tone: string }[] = [
  { id: "ethanol", label: "Bioethanol pathway", tone: "border-warn/50 text-warn" },
  { id: "biogas", label: "Biogas pathway", tone: "border-ok/50 text-ok" },
  { id: "fertilizer", label: "Biofertilizer pathway", tone: "border-telemetry/50 text-telemetry" },
  { id: "pha", label: "Bioplastics / PHA (optional)", tone: "border-dashed border-muted-foreground/50 text-muted-foreground" },
];

function Node({ s, sel, onClick }: { s: Stage; sel: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-w-[9.5rem] flex-1 rounded-md border bg-surface/70 px-3 py-2.5 text-left text-sm transition hover:border-telemetry",
        sel && "border-telemetry glow",
        s.lane === "pha" && "border-dashed",
      )}
    >
      <div className="font-medium leading-tight">{s.name}</div>
      <div className="mt-0.5 text-[0.68rem] text-muted-foreground">{s.params[0]}</div>
    </button>
  );
}

const Arrow = () => (
  <svg className="hidden h-4 w-8 shrink-0 self-center text-telemetry md:block" viewBox="0 0 32 16"><path d="M0 8h26" stroke="currentColor" strokeWidth="2" className="anim-flow" /><path d="M24 3l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
);

function Twin() {
  const [sel, setSel] = useState<string>("feed");
  const stage = STAGES.find((s) => s.id === sel)!;
  const common = STAGES.filter((s) => s.lane === "common");
  return (
    <div>
      <PageHeader title="Process Digital Twin" sub="Click any stage to inspect its description, inputs, outputs and parameters" />
      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <Panel title="Bagasse → Size reduction → Pretreatment → Hydrolysis → Bioconversion → Recovery → Products">
          <div className="label-tech mb-2">Common front-end</div>
          <div className="flex flex-col gap-2 md:flex-row">
            {common.map((s, i) => (
              <div key={s.id} className="contents">
                {i > 0 && <Arrow />}
                <Node s={s} sel={sel === s.id} onClick={() => setSel(s.id)} />
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {LANES.map((l) => (
              <div key={l.id} className={cn("rounded-md border p-3", l.tone)}>
                <div className="label-tech mb-2 !text-current">{l.label}</div>
                <div className="flex flex-col gap-2 md:flex-row">
                  {STAGES.filter((s) => s.lane === l.id).map((s, i) => (
                    <div key={s.id} className="contents text-foreground">
                      {i > 0 && <Arrow />}
                      <Node s={s} sel={sel === s.id} onClick={() => setSel(s.id)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Stage details">
          <h3 className="font-display text-lg text-telemetry">{stage.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{stage.desc}</p>
          {(["inputs", "outputs", "params"] as const).map((k) => (
            <div key={k} className="mt-4">
              <div className="label-tech">{k === "params" ? "Relevant parameters" : k}</div>
              <ul className="mt-1 space-y-1">
                {stage[k].map((x) => <li key={x} className="rounded border bg-surface/60 px-2 py-1 text-sm">{x}</li>)}
              </ul>
            </div>
          ))}
          <p className="mt-4 text-[0.68rem] text-muted-foreground">Parameters are illustrative literature-range values for demonstration.</p>
        </Panel>
      </div>
    </div>
  );
}
