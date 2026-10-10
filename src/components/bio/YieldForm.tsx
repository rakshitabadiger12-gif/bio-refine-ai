import type { YieldInputs } from "@/lib/sim/yield";
import { BOUNDS } from "@/lib/sim/yield";
import { NumField, Select } from "./ui";

const FIELDS: { k: keyof typeof BOUNDS; label: string; unit?: string; step?: number }[] = [
  { k: "massKg", label: "Bagasse mass (wet)", unit: "kg" },
  { k: "moisture", label: "Moisture content", unit: "%" },
  { k: "reducingSugar", label: "Initial reducing sugar", unit: "g/L" },
  { k: "liquorL", label: "Liquor volume", unit: "L" },
  { k: "hydrolysisEff", label: "Hydrolysis efficiency", unit: "%" },
  { k: "fermentationEff", label: "Fermentation / digestion eff.", unit: "%" },
  { k: "temperature", label: "Temperature", unit: "°C", step: 0.5 },
  { k: "ph", label: "pH", step: 0.1 },
  { k: "agitation", label: "Agitation", unit: "RPM", step: 5 },
];

export function YieldForm({ value, onChange }: { value: YieldInputs; onChange: (v: YieldInputs) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Select
          label="Product pathway"
          value={value.pathway}
          onChange={(pathway) => onChange({ ...value, pathway })}
          options={[
            { value: "ethanol", label: "Bioethanol" },
            { value: "biogas", label: "Biogas" },
            { value: "fertilizer", label: "Biofertilizer" },
          ]}
        />
      </div>
      {FIELDS.map((f) => (
        <NumField key={f.k} label={f.label} unit={f.unit} step={f.step} min={BOUNDS[f.k][0]} max={BOUNDS[f.k][1]} value={value[f.k]} onChange={(v) => onChange({ ...value, [f.k]: v })} />
      ))}
    </div>
  );
}
