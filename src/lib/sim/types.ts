export type ReactorId = "ethanol" | "biogas" | "fertilizer";
export type Param = "temperature" | "ph" | "concentration" | "agitation";
export const PARAMS: Param[] = ["temperature", "ph", "concentration", "agitation"];
export const REACTOR_IDS: ReactorId[] = ["ethanol", "biogas", "fertilizer"];

export const PARAM_LABEL: Record<Param, string> = {
  temperature: "Temperature",
  ph: "pH",
  concentration: "Concentration",
  agitation: "Agitation",
};
export const PARAM_UNIT: Record<Param, string> = {
  temperature: "°C",
  ph: "",
  concentration: "g/L",
  agitation: "RPM",
};

export type Setpoint = Record<Param, number>;

export interface ReactorDef {
  id: ReactorId;
  name: string;
  short: string;
  product: string;
  organism: string;
  initial: Setpoint;
  noise: Setpoint;
}

export const REACTORS: Record<ReactorId, ReactorDef> = {
  ethanol: {
    id: "ethanol",
    name: "Bioethanol Reactor R-101",
    short: "R-101 Bioethanol",
    product: "Bioethanol",
    organism: "S. cerevisiae fermentation",
    initial: { temperature: 32, ph: 5.1, concentration: 42, agitation: 200 },
    noise: { temperature: 0.35, ph: 0.04, concentration: 0.9, agitation: 3 },
  },
  biogas: {
    id: "biogas",
    name: "Biogas Digester R-201",
    short: "R-201 Biogas",
    product: "Biogas",
    organism: "Mesophilic anaerobic digestion",
    initial: { temperature: 37, ph: 7.0, concentration: 65, agitation: 100 },
    noise: { temperature: 0.3, ph: 0.035, concentration: 1.2, agitation: 2 },
  },
  fertilizer: {
    id: "fertilizer",
    name: "Biofertilizer Reactor R-301",
    short: "R-301 Biofertilizer",
    product: "Biofertilizer",
    organism: "Aerobic microbial consortium",
    initial: { temperature: 30, ph: 6.8, concentration: 18, agitation: 160 },
    noise: { temperature: 0.3, ph: 0.04, concentration: 0.5, agitation: 2.5 },
  },
};

export interface Limit {
  min: number;
  max: number;
}
export type Limits = Record<ReactorId, Record<Param, Limit>>;

export const DEFAULT_LIMITS: Limits = {
  ethanol: {
    temperature: { min: 29, max: 35 },
    ph: { min: 4.6, max: 5.6 },
    concentration: { min: 34, max: 50 },
    agitation: { min: 170, max: 230 },
  },
  biogas: {
    temperature: { min: 34, max: 40 },
    ph: { min: 6.6, max: 7.5 },
    concentration: { min: 55, max: 75 },
    agitation: { min: 80, max: 120 },
  },
  fertilizer: {
    temperature: { min: 27, max: 33 },
    ph: { min: 6.3, max: 7.3 },
    concentration: { min: 14, max: 22 },
    agitation: { min: 135, max: 185 },
  },
};

export interface Reading {
  id: string;
  ts: number;
  reactor: ReactorId;
  temperature: number;
  ph: number;
  concentration: number;
  agitation: number;
  aiScore: number | null;
  aiLabel: "normal" | "anomaly" | "unavailable";
  contributors: string[];
  violations: Param[];
  injected: boolean;
}

export type Severity = "info" | "warning" | "critical";
export type EventType = "AI anomaly" | "Limit violation" | "Demo injection" | "System";

export interface PlantEvent {
  id: string;
  ts: number;
  reactor: ReactorId | "plant";
  severity: Severity;
  type: EventType;
  parameter?: Param;
  value?: number;
  limit?: string;
  aiClass?: string;
  explanation: string;
  acknowledged: boolean;
}

export type Sensitivity = "low" | "medium" | "high";
export const SENSITIVITY_THRESHOLD: Record<Sensitivity, number> = {
  low: 0.66,
  medium: 0.61,
  high: 0.57,
};

export interface Settings {
  intervalMs: number;
  retention: number; // readings per reactor
  sensitivity: Sensitivity;
  tempUnit: "C" | "F";
  limits: Limits;
}

export const DEFAULT_SETTINGS: Settings = {
  intervalMs: 3000,
  retention: 400,
  sensitivity: "medium",
  tempUnit: "C",
  limits: DEFAULT_LIMITS,
};
