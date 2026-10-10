// Transparent simplified mass-balance yield estimation. NOT a trained model.
export type Pathway = "ethanol" | "biogas" | "fertilizer";

export interface YieldInputs {
  pathway: Pathway;
  massKg: number; // wet bagasse
  moisture: number; // %
  reducingSugar: number; // g/L initial
  liquorL: number; // working volume
  hydrolysisEff: number; // %
  fermentationEff: number; // %
  temperature: number; // °C
  ph: number;
  agitation: number; // RPM
}

export const DEFAULT_YIELD: YieldInputs = {
  pathway: "ethanol",
  massKg: 1000,
  moisture: 50,
  reducingSugar: 42,
  liquorL: 2000,
  hydrolysisEff: 75,
  fermentationEff: 85,
  temperature: 32,
  ph: 5.1,
  agitation: 200,
};

export const COMPOSITION = { cellulose: 0.42, hemicellulose: 0.28, lignin: 0.22, ash: 0.08 };
const OPT: Record<Pathway, { t: number; ph: number; rpm: number }> = {
  ethanol: { t: 32, ph: 5.0, rpm: 200 },
  biogas: { t: 37, ph: 7.0, rpm: 100 },
  fertilizer: { t: 30, ph: 6.8, rpm: 160 },
};

export const BOUNDS: Record<keyof Omit<YieldInputs, "pathway">, [number, number]> = {
  massKg: [1, 1_000_000],
  moisture: [0, 95],
  reducingSugar: [0, 300],
  liquorL: [1, 5_000_000],
  hydrolysisEff: [0, 100],
  fermentationEff: [0, 100],
  temperature: [0, 80],
  ph: [0, 14],
  agitation: [0, 1000],
};

export function validate(i: YieldInputs): string[] {
  const errs: string[] = [];
  for (const k of Object.keys(BOUNDS) as (keyof typeof BOUNDS)[]) {
    const v = i[k];
    const [a, b] = BOUNDS[k];
    if (!Number.isFinite(v) || v < a || v > b) errs.push(`${k} must be between ${a} and ${b}`);
  }
  return errs;
}

export interface YieldResult {
  dryMassKg: number;
  conditionFactor: number;
  primaryLabel: string;
  primaryUnit: string;
  theoretical: number;
  practical: number;
  conversionEff: number; // %
  secondary: { label: string; value: number; unit: string }[];
  assumptions: string[];
}

const r = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export function conditionFactor(i: YieldInputs) {
  const o = OPT[i.pathway];
  return (
    Math.exp(-(((i.temperature - o.t) / 8) ** 2)) *
    Math.exp(-(((i.ph - o.ph) / 1.2) ** 2)) *
    Math.exp(-(((i.agitation - o.rpm) / (o.rpm * 0.9)) ** 2))
  );
}

export function computeYield(i: YieldInputs): YieldResult {
  const dry = i.massKg * (1 - i.moisture / 100);
  const he = i.hydrolysisEff / 100;
  const fe = i.fermentationEff / 100;
  const cf = conditionFactor(i);
  if (i.pathway === "ethanol") {
    const glucose = dry * COMPOSITION.cellulose * 1.111 * he;
    const xylose = dry * COMPOSITION.hemicellulose * 1.136 * he;
    const initialSugar = (i.reducingSugar * i.liquorL) / 1000;
    const sugar = glucose + xylose + initialSugar;
    const theoKg = sugar * 0.511;
    const practKg = theoKg * fe * cf;
    return {
      dryMassKg: r(dry),
      conditionFactor: r(cf, 3),
      primaryLabel: "Ethanol",
      primaryUnit: "L",
      theoretical: r(theoKg / 0.789),
      practical: r(practKg / 0.789),
      conversionEff: r(theoKg > 0 ? (practKg / theoKg) * 100 : 0, 1),
      secondary: [
        { label: "Fermentable sugar", value: r(sugar), unit: "kg" },
        { label: "Theoretical ethanol mass", value: r(theoKg), unit: "kg" },
        { label: "Practical ethanol mass", value: r(practKg), unit: "kg" },
        { label: "Ethanol per dry tonne", value: r(dry > 0 ? practKg / 0.789 / (dry / 1000) : 0), unit: "L/t" },
      ],
      assumptions: [
        "Bagasse dry composition: 42% cellulose, 28% hemicellulose, 22% lignin, 8% ash.",
        "Hydrolysis gain factors: glucan→glucose 1.111, xylan→xylose 1.136.",
        "Gay-Lussac stoichiometric max: 0.511 kg ethanol / kg sugar; density 0.789 kg/L.",
        "Pentoses assumed co-fermentable; initial reducing sugar × liquor volume added.",
        "Practical = theoretical × fermentation efficiency × condition factor (Gaussian penalty vs. optimal T, pH, RPM).",
      ],
    };
  }
  if (i.pathway === "biogas") {
    const vs = dry * 0.9;
    const theoCH4 = vs * 0.35 * (0.5 + 0.5 * he); // m3 CH4 at theoretical BMP-ish
    const practCH4 = theoCH4 * fe * cf;
    const biogas = practCH4 / 0.6;
    return {
      dryMassKg: r(dry),
      conditionFactor: r(cf, 3),
      primaryLabel: "Methane",
      primaryUnit: "m³ CH₄",
      theoretical: r(theoCH4),
      practical: r(practCH4),
      conversionEff: r(theoCH4 > 0 ? (practCH4 / theoCH4) * 100 : 0, 1),
      secondary: [
        { label: "Volatile solids", value: r(vs), unit: "kg VS" },
        { label: "Total biogas (60% CH₄)", value: r(biogas), unit: "m³" },
        { label: "Energy content", value: r(practCH4 * 9.97), unit: "kWh" },
      ],
      assumptions: [
        "Volatile solids = 90% of dry mass.",
        "Ultimate methane potential 0.35 m³ CH₄/kg VS, scaled 50–100% by pretreatment/hydrolysis efficiency.",
        "Digestion efficiency = fermentation efficiency input; biogas assumed 60% CH₄.",
        "Methane LHV ≈ 9.97 kWh/m³ (STP).",
      ],
    };
  }
  const degradable = dry * (COMPOSITION.cellulose + COMPOSITION.hemicellulose);
  const theo = dry - degradable * 0.5 * he; // compost-like stabilized solids
  const pract = theo * (0.6 + 0.4 * fe) * (0.7 + 0.3 * cf);
  return {
    dryMassKg: r(dry),
    conditionFactor: r(cf, 3),
    primaryLabel: "Biofertilizer (dry)",
    primaryUnit: "kg",
    theoretical: r(theo),
    practical: r(pract),
    conversionEff: r(theo > 0 ? (pract / theo) * 100 : 0, 1),
    secondary: [
      { label: "Nitrogen (≈1.2% w/w)", value: r(pract * 0.012), unit: "kg N" },
      { label: "Organic carbon (≈30% w/w)", value: r(pract * 0.3), unit: "kg C" },
      { label: "Mass reduction vs dry feed", value: r(dry > 0 ? (1 - pract / dry) * 100 : 0, 1), unit: "%" },
    ],
    assumptions: [
      "Up to 50% of degradable carbohydrates mineralised during microbial stabilisation.",
      "Recovered solids = theoretical × (0.6 + 0.4 × process efficiency) × (0.7 + 0.3 × condition factor).",
      "Nutrient content (1.2% N, 30% C) are illustrative literature-range values, not measurements.",
    ],
  };
}
