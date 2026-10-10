// Integration layer for an EXTERNAL trained yield-prediction model (e.g. scikit-learn served via FastAPI/Flask).
// No trained yield model ships with this project. Predictions are only shown when a real endpoint responds.
//
// Request  (POST JSON): { "features": [bagasse_weight_kg, moisture_pct, temperature_c, ph],
//                         "feature_names": ["bagasse_weight_kg","moisture_pct","temperature_c","ph"] }
// Response (JSON):      { "bioethanol": number, "biogas": number, "biofertilizer": number,
//                         "units"?: { "bioethanol": string, "biogas": string, "biofertilizer": string } }
//   or                  { "predictions": [bioethanol, biogas, biofertilizer], "units"?: {...} }

export const FEATURE_ORDER = ["bagasse_weight_kg", "moisture_pct", "temperature_c", "ph"] as const;
export type Outputs = "bioethanol" | "biogas" | "biofertilizer";
export const OUTPUTS: Outputs[] = ["bioethanol", "biogas", "biofertilizer"];

export interface PredInputs { weight: number; moisture: number; temperature: number; ph: number }
export interface Prediction { values: Record<Outputs, number>; units: Record<Outputs, string | null> }
export interface HistoryRow { id: string; ts: number; inputs: PredInputs; prediction: Prediction; endpoint: string }

const CFG_KEY = "biorefine-yield-endpoint";
const HIST_KEY = "biorefine-yield-history";
export const DEFAULT_PRED_INPUTS: PredInputs = { weight: 1000, moisture: 50, temperature: 32, ph: 5.1 };

export function validateInputs(i: Record<keyof PredInputs, number>): Partial<Record<keyof PredInputs, string>> {
  const e: Partial<Record<keyof PredInputs, string>> = {};
  const bad = (v: number) => !Number.isFinite(v);
  if (bad(i.weight)) e.weight = "Enter a number"; else if (i.weight <= 0) e.weight = "Weight must be greater than 0 kg"; else if (i.weight > 1_000_000) e.weight = "Max 1,000,000 kg";
  if (bad(i.moisture)) e.moisture = "Enter a number"; else if (i.moisture < 0 || i.moisture > 100) e.moisture = "Moisture must be 0–100%";
  // Model's supported temperature/pH training ranges are unknown; only physical bounds enforced.
  if (bad(i.temperature)) e.temperature = "Enter a number"; else if (i.temperature < 0 || i.temperature > 100) e.temperature = "Temperature must be 0–100 °C";
  if (bad(i.ph)) e.ph = "Enter a number"; else if (i.ph < 0 || i.ph > 14) e.ph = "pH must be 0–14";
  return e;
}

export const getEndpoint = () => { try { return localStorage.getItem(CFG_KEY) ?? ""; } catch { return ""; } };
export const setEndpoint = (u: string) => { try { u ? localStorage.setItem(CFG_KEY, u) : localStorage.removeItem(CFG_KEY); } catch {} };
export const loadHistory = (): HistoryRow[] => { try { const r = JSON.parse(localStorage.getItem(HIST_KEY) ?? "[]"); return Array.isArray(r) ? r : []; } catch { return []; } };
export const saveHistory = (h: HistoryRow[]) => { try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 200))); } catch {} };

export class ModelError extends Error {}

function parse(json: unknown): Prediction {
  if (!json || typeof json !== "object") throw new ModelError("Model returned a non-JSON object response.");
  const j = json as Record<string, unknown>;
  let vals: unknown[];
  if (Array.isArray(j.predictions)) vals = Array.isArray(j.predictions[0]) ? (j.predictions[0] as unknown[]) : j.predictions;
  else vals = OUTPUTS.map((k) => j[k]);
  if (vals.length < 3 || !vals.slice(0, 3).every((v) => typeof v === "number" && Number.isFinite(v)))
    throw new ModelError("Response missing three numeric outputs (bioethanol, biogas, biofertilizer).");
  const u = (j.units && typeof j.units === "object" ? j.units : {}) as Record<string, unknown>;
  return {
    values: { bioethanol: vals[0] as number, biogas: vals[1] as number, biofertilizer: vals[2] as number },
    units: Object.fromEntries(OUTPUTS.map((k) => [k, typeof u[k] === "string" ? (u[k] as string) : null])) as Prediction["units"],
  };
}

export async function predict(endpoint: string, i: PredInputs, timeoutMs = 10000): Promise<Prediction> {
  if (!endpoint) throw new ModelError("Model connection required: no prediction endpoint configured.");
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new ModelError("Endpoint is not a valid URL."); }
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new ModelError("Endpoint must use https://");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features: [i.weight, i.moisture, i.temperature, i.ph], feature_names: FEATURE_ORDER }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new ModelError(`Model API responded with HTTP ${res.status}.`);
    return parse(await res.json().catch(() => { throw new ModelError("Model API returned invalid JSON."); }));
  } catch (e) {
    if (e instanceof ModelError) throw e;
    if ((e as Error).name === "AbortError") throw new ModelError(`Model API timed out after ${timeoutMs / 1000}s.`);
    throw new ModelError("Could not reach the model API (offline, wrong URL, or CORS not enabled on the server).");
  } finally { clearTimeout(t); }
}
