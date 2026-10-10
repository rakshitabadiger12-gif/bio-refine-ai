import { useSyncExternalStore } from "react";
import { IsolationForest } from "./iforest";
import {
  DEFAULT_SETTINGS,
  PARAMS,
  PARAM_LABEL,
  REACTORS,
  REACTOR_IDS,
  SENSITIVITY_THRESHOLD,
  type Param,
  type PlantEvent,
  type ReactorId,
  type Reading,
  type Settings,
  type Setpoint,
} from "./types";
import type { YieldInputs } from "./yield";

export type SimStatus = "running" | "paused" | "stopped";
export type ModelStatus = "initializing" | "ready" | "unavailable";

export interface SavedScenario {
  id: string;
  ts: number;
  name: string;
  inputs: YieldInputs;
}

export interface SimState {
  hydrated: boolean;
  status: SimStatus;
  tick: number;
  lastSync: number | null;
  current: Record<ReactorId, Reading | null>;
  history: Record<ReactorId, Reading[]>;
  events: PlantEvent[];
  settings: Settings;
  model: { status: ModelStatus; trainedAt: number | null; trees: number; baselineSize: number; error?: string };
  scenarios: SavedScenario[];
  storage: "localStorage" | "memory";
}

const STORAGE_KEY = "biorefine-ai-v1";
const MAX_EVENTS = 500;

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const r = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const gauss = () => {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

function emptyRec<T>(f: () => T): Record<ReactorId, T> {
  return { ethanol: f(), biogas: f(), fertilizer: f() };
}

let state: SimState = {
  hydrated: false,
  status: "stopped",
  tick: 0,
  lastSync: null,
  current: emptyRec(() => null),
  history: emptyRec(() => []),
  events: [],
  settings: DEFAULT_SETTINGS,
  model: { status: "initializing", trainedAt: null, trees: 0, baselineSize: 0 },
  scenarios: [],
  storage: "memory",
};

const initialState = state;
const listeners = new Set<() => void>();
function set(patch: Partial<SimState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  scheduleSave();
}
export function getState() {
  return state;
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useSim<T>(sel: (s: SimState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => sel(state),
    () => sel(initialState),
  );
}

// ---------- internal simulation state (OU process) ----------
const walk: Record<ReactorId, Setpoint> = emptyRec(() => ({ temperature: 0, ph: 0, concentration: 0, agitation: 0 }));
const anomalyTicks: Record<ReactorId, number> = { ethanol: 0, biogas: 0, fertilizer: 0 };
const models: Partial<Record<ReactorId, IsolationForest>> = {};
const stats: Partial<Record<ReactorId, { mean: number[]; std: number[] }>> = {};
const prevFlags: Record<ReactorId, { ai: boolean; lim: Set<Param> }> = emptyRec(() => ({ ai: false, lim: new Set<Param>() }));
let timer: ReturnType<typeof setInterval> | null = null;

function resetWalk() {
  for (const id of REACTOR_IDS) walk[id] = { ...REACTORS[id].initial };
  for (const id of REACTOR_IDS) anomalyTicks[id] = 0;
}

function stepValue(id: ReactorId, p: Param, t: number) {
  const def = REACTORS[id];
  const target = def.initial[p] + def.noise[p] * 1.2 * Math.sin(t / 18 + PARAMS.indexOf(p) + REACTOR_IDS.indexOf(id));
  const theta = 0.25;
  walk[id][p] = walk[id][p] + theta * (target - walk[id][p]) + def.noise[p] * gauss();
  return walk[id][p];
}

function baseline(id: ReactorId, n: number): number[][] {
  const def = REACTORS[id];
  const w = { ...def.initial };
  const out: number[][] = [];
  for (let t = 0; t < n; t++) {
    const row: number[] = [];
    for (const p of PARAMS) {
      const target = def.initial[p] + def.noise[p] * 1.2 * Math.sin(t / 18 + PARAMS.indexOf(p));
      w[p] = w[p] + 0.25 * (target - w[p]) + def.noise[p] * gauss();
      row.push(w[p]);
    }
    out.push(row);
  }
  return out;
}

function normalize(id: ReactorId, x: number[]) {
  const s = stats[id]!;
  return x.map((v, i) => (v - s.mean[i]) / (s.std[i] || 1));
}

export function trainModels() {
  try {
    set({ model: { ...state.model, status: "initializing" } });
    const N = 1024;
    for (const id of REACTOR_IDS) {
      const raw = baseline(id, N);
      const mean = PARAMS.map((_, i) => raw.reduce((a, r) => a + r[i], 0) / N);
      const std = PARAMS.map((_, i) => Math.sqrt(raw.reduce((a, r) => a + (r[i] - mean[i]) ** 2, 0) / N));
      stats[id] = { mean, std };
      const f = new IsolationForest(100);
      f.fit(raw.map((x) => normalize(id, x)));
      models[id] = f;
    }
    set({ model: { status: "ready", trainedAt: Date.now(), trees: 100, baselineSize: N } });
  } catch (e) {
    set({ model: { status: "unavailable", trainedAt: null, trees: 0, baselineSize: 0, error: String(e) } });
  }
}

export function detect(id: ReactorId, values: Setpoint) {
  const m = models[id];
  if (!m || !stats[id]) return { score: null, label: "unavailable" as const, contributors: [] as string[] };
  const x = PARAMS.map((p) => values[p]);
  const z = normalize(id, x);
  const score = m.score(z);
  const label = score >= SENSITIVITY_THRESHOLD[state.settings.sensitivity] ? ("anomaly" as const) : ("normal" as const);
  const contributors = PARAMS.map((p, i) => ({ p, z: z[i] }))
    .filter((c) => Math.abs(c.z) >= 2)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .map((c) => `${PARAM_LABEL[c.p]} ${c.z > 0 ? "+" : ""}${c.z.toFixed(1)}σ`);
  return { score: r(score, 3), label, contributors };
}

function pushEvent(e: Omit<PlantEvent, "id" | "ts" | "acknowledged">, events: PlantEvent[]) {
  events.unshift({ ...e, id: uid(), ts: Date.now(), acknowledged: false });
}

function tickOnce() {
  const t = state.tick + 1;
  const now = Date.now();
  const events = [...state.events];
  const current = { ...state.current };
  const history = { ...state.history };
  for (const id of REACTOR_IDS) {
    const v: Setpoint = {
      temperature: stepValue(id, "temperature", t),
      ph: stepValue(id, "ph", t),
      concentration: stepValue(id, "concentration", t),
      agitation: stepValue(id, "agitation", t),
    };
    const injected = anomalyTicks[id] > 0;
    if (injected) {
      anomalyTicks[id]--;
      const def = REACTORS[id].initial;
      v.temperature = def.temperature + 5.5 + gauss() * 0.3;
      v.ph = def.ph - 0.85 + gauss() * 0.03;
      v.agitation = def.agitation * 0.62;
      v.concentration = def.concentration * 1.22;
      walk[id] = { ...v };
    }
    const out: Setpoint = {
      temperature: r(Math.max(0, v.temperature)),
      ph: r(Math.min(14, Math.max(0, v.ph))),
      concentration: r(Math.max(0, v.concentration)),
      agitation: r(Math.max(0, v.agitation), 1),
    };
    const ai = detect(id, out);
    const lim = state.settings.limits[id];
    const violations = PARAMS.filter((p) => out[p] < lim[p].min || out[p] > lim[p].max);
    const reading: Reading = {
      id: uid(),
      ts: now,
      reactor: id,
      ...out,
      aiScore: ai.score,
      aiLabel: ai.label,
      contributors: ai.contributors,
      violations,
      injected,
    };
    current[id] = reading;
    const h = [...history[id], reading];
    history[id] = h.slice(-state.settings.retention);

    // AI events on transition into anomaly state
    const isAnom = ai.label === "anomaly";
    if (isAnom && !prevFlags[id].ai) {
      pushEvent(
        {
          reactor: id,
          severity: "critical",
          type: "AI anomaly",
          aiClass: `Anomaly (score ${ai.score})`,
          explanation: `Isolation Forest score ${ai.score} ≥ threshold ${SENSITIVITY_THRESHOLD[state.settings.sensitivity]}. ${
            ai.contributors.length ? "Deviating: " + ai.contributors.join(", ") : "Multivariate pattern deviates from baseline."
          }${injected ? " (demo-injected)" : ""}`,
        },
        events,
      );
    }
    prevFlags[id].ai = isAnom;
    // Limit events on onset per parameter
    for (const p of violations) {
      if (!prevFlags[id].lim.has(p)) {
        const L = lim[p];
        pushEvent(
          {
            reactor: id,
            severity: "warning",
            type: "Limit violation",
            parameter: p,
            value: out[p],
            limit: `${L.min} – ${L.max}`,
            aiClass: ai.label === "anomaly" ? "Anomaly" : ai.label === "normal" ? "Normal" : "Unavailable",
            explanation: `${PARAM_LABEL[p]} ${out[p]} is ${out[p] > L.max ? "above maximum" : "below minimum"} configured limit (${L.min} – ${L.max}). Rule-based check, independent of AI model.`,
          },
          events,
        );
      }
    }
    prevFlags[id].lim = new Set(violations);
  }
  set({ tick: t, current, history, events: events.slice(0, MAX_EVENTS), lastSync: now });
}

function startTimer() {
  stopTimer();
  timer = setInterval(tickOnce, state.settings.intervalMs);
}
function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function sysEvent(msg: string, reactor: PlantEvent["reactor"] = "plant", type: PlantEvent["type"] = "System") {
  const events = [...state.events];
  pushEvent({ reactor, severity: "info", type, explanation: msg, aiClass: "—" }, events);
  set({ events: events.slice(0, MAX_EVENTS) });
}

// ---------- public controls ----------
export const sim = {
  start() {
    if (state.status === "running") return;
    const wasPaused = state.status === "paused";
    set({ status: "running" });
    sysEvent(wasPaused ? "Simulation resumed." : "Simulation started.");
    tickOnce();
    startTimer();
  },
  pause() {
    if (state.status !== "running") return;
    stopTimer();
    set({ status: "paused" });
    sysEvent("Simulation paused. Values held.");
  },
  reset() {
    stopTimer();
    resetWalk();
    for (const id of REACTOR_IDS) prevFlags[id] = { ai: false, lim: new Set() };
    set({ status: "stopped", tick: 0, current: emptyRec(() => null), history: emptyRec(() => []), lastSync: null });
    sysEvent("Simulation reset to initial setpoints.");
    // produce the initial-state reading immediately
    initialReadings();
  },
  inject(id: ReactorId) {
    anomalyTicks[id] = 4;
    sysEvent(`Demo anomaly injected into ${REACTORS[id].name}: +5.5 °C, −0.85 pH, −38% agitation, +22% concentration for 4 ticks.`, id, "Demo injection");
    if (state.status !== "running") sim.start();
    else tickOnce();
  },
  acknowledge(id: string) {
    set({ events: state.events.map((e) => (e.id === id ? { ...e, acknowledged: true } : e)) });
  },
  acknowledgeAll() {
    set({ events: state.events.map((e) => ({ ...e, acknowledged: true })) });
  },
  clearEvents() {
    set({ events: [] });
  },
  updateSettings(patch: Partial<Settings>) {
    const settings = { ...state.settings, ...patch };
    set({ settings });
    if (patch.retention) {
      const history = { ...state.history };
      for (const id of REACTOR_IDS) history[id] = history[id].slice(-settings.retention);
      set({ history });
    }
    if (patch.intervalMs && state.status === "running") startTimer();
  },
  saveScenario(name: string, inputs: YieldInputs) {
    set({ scenarios: [{ id: uid(), ts: Date.now(), name, inputs }, ...state.scenarios].slice(0, 50) });
  },
  deleteScenario(id: string) {
    set({ scenarios: state.scenarios.filter((s) => s.id !== id) });
  },
  resetDemo() {
    stopTimer();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    resetWalk();
    for (const id of REACTOR_IDS) prevFlags[id] = { ai: false, lim: new Set() };
    set({
      status: "stopped",
      tick: 0,
      current: emptyRec(() => null),
      history: emptyRec(() => []),
      events: [],
      settings: DEFAULT_SETTINGS,
      scenarios: [],
      lastSync: null,
    });
    trainModels();
    initialReadings();
    sim.start();
  },
};

function initialReadings() {
  const current = { ...state.current };
  const history = { ...state.history };
  const now = Date.now();
  for (const id of REACTOR_IDS) {
    const v = { ...REACTORS[id].initial };
    const ai = detect(id, v);
    const lim = state.settings.limits[id];
    const rd: Reading = {
      id: uid(),
      ts: now,
      reactor: id,
      ...v,
      aiScore: ai.score,
      aiLabel: ai.label,
      contributors: ai.contributors,
      violations: PARAMS.filter((p) => v[p] < lim[p].min || v[p] > lim[p].max),
      injected: false,
    };
    current[id] = rd;
    history[id] = [...history[id], rd];
  }
  set({ current, history, lastSync: now });
}

// ---------- persistence ----------
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (!state.hydrated || state.storage !== "localStorage") return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const { settings, events, history, scenarios } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, events, history, scenarios }));
    } catch {
      state = { ...state, storage: "memory" };
    }
  }, 800);
}

let booted = false;
export function bootSimulation() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  let storage: SimState["storage"] = "memory";
  let saved: Partial<Pick<SimState, "settings" | "events" | "history" | "scenarios">> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    storage = "localStorage";
    if (raw) saved = JSON.parse(raw);
  } catch {
    storage = "memory";
  }
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...(saved.settings ?? {}),
    limits: { ...DEFAULT_SETTINGS.limits, ...(saved.settings?.limits ?? {}) },
  };
  const history = emptyRec<Reading[]>(() => []);
  for (const id of REACTOR_IDS) if (Array.isArray(saved.history?.[id])) history[id] = saved.history![id].slice(-settings.retention);
  state = {
    ...state,
    hydrated: true,
    storage,
    settings,
    history,
    events: Array.isArray(saved.events) ? saved.events : [],
    scenarios: Array.isArray(saved.scenarios) ? saved.scenarios : [],
  };
  resetWalk();
  // continue walk from last stored values
  for (const id of REACTOR_IDS) {
    const last = history[id][history[id].length - 1];
    if (last) walk[id] = { temperature: last.temperature, ph: last.ph, concentration: last.concentration, agitation: last.agitation };
  }
  trainModels();
  sim.start();
}

export function displayTemp(c: number, unit: "C" | "F") {
  return unit === "F" ? r(c * 1.8 + 32, 1) : r(c, 1);
}
