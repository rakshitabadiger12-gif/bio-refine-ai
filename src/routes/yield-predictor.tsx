import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Label } from "recharts";
import { Download, Loader2, Plug, RotateCcw, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty, NumField, PageHeader, Panel, StatusPill, fmtDateTime } from "@/components/bio/ui";
import { download, toCSV } from "@/lib/sim/csv";
import {
  DEFAULT_PRED_INPUTS, FEATURE_ORDER, OUTPUTS, ModelError, getEndpoint, loadHistory, predict, saveHistory, setEndpoint, validateInputs,
  type HistoryRow, type Outputs, type PredInputs, type Prediction,
} from "@/lib/yieldModel";

export const Route = createFileRoute("/yield-predictor")({
  head: () => ({
    meta: [
      { title: "Yield Predictor — BIOREFINE AI" },
      { name: "description", content: "Connect a trained model to predict bioethanol, biogas and biofertilizer yields from bagasse conditions." },
      { property: "og:title", content: "Yield Predictor — BIOREFINE AI" },
      { property: "og:description", content: "Trained-model yield prediction with history and CSV export." },
    ],
  }),
  component: Predictor,
});

const LABEL: Record<Outputs, string> = { bioethanol: "Bioethanol", biogas: "Biogas", biofertilizer: "Biofertilizer" };
const COLOR: Record<Outputs, string> = { bioethanol: "var(--color-chart-3)", biogas: "var(--color-chart-2)", biofertilizer: "var(--color-chart-1)" };
const unitOf = (p: Prediction, k: Outputs) => p.units[k] ?? "unit not provided by model";
const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 3 });

function Predictor() {
  const [endpoint, setEp] = useState("");
  const [draftEp, setDraftEp] = useState("");
  const [inp, setInp] = useState<PredInputs>(DEFAULT_PRED_INPUTS);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inputs: PredInputs; p: Prediction } | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [insights, setInsights] = useState<{ f: keyof PredInputs; d: Record<Outputs, number> }[] | null>(null);
  const [insLoading, setInsLoading] = useState(false);

  useEffect(() => { const e = getEndpoint(); setEp(e); setDraftEp(e); setHistory(loadHistory()); }, []);
  const errs = validateInputs(inp);
  const valid = Object.keys(errs).length === 0;
  const connected = !!endpoint;

  async function run() {
    setTouched(true);
    if (!valid) { setError("Fix the highlighted inputs before predicting."); return; }
    setLoading(true); setError(null); setInsights(null);
    try {
      const p = await predict(endpoint, inp);
      setResult({ inputs: { ...inp }, p });
      const h = [{ id: `${Date.now()}`, ts: Date.now(), inputs: { ...inp }, prediction: p, endpoint }, ...history];
      setHistory(h); saveHistory(h);
      toast.success("Prediction received from model");
    } catch (e) {
      setResult(null);
      setError(e instanceof ModelError ? e.message : "Unexpected prediction error.");
    } finally { setLoading(false); }
  }

  async function runInsights() {
    if (!result) return;
    setInsLoading(true);
    try {
      const out: { f: keyof PredInputs; d: Record<Outputs, number> }[] = [];
      const steps: Record<keyof PredInputs, number> = { weight: result.inputs.weight * 0.1, moisture: 5, temperature: 2, ph: 0.3 };
      for (const f of Object.keys(steps) as (keyof PredInputs)[]) {
        const up = { ...result.inputs, [f]: result.inputs[f] + steps[f] };
        const dn = { ...result.inputs, [f]: result.inputs[f] - steps[f] };
        const [a, b] = await Promise.all([predict(endpoint, up), predict(endpoint, dn)]);
        out.push({ f, d: Object.fromEntries(OUTPUTS.map((k) => [k, (a.values[k] - b.values[k]) / 2])) as Record<Outputs, number> });
      }
      setInsights(out);
    } catch (e) { toast.error(e instanceof ModelError ? e.message : "Sensitivity analysis failed"); }
    finally { setInsLoading(false); }
  }

  const exportCSV = () => download(`biorefine-yield-predictions-${Date.now()}.csv`, toCSV(
    ["timestamp_iso", ...FEATURE_ORDER, "bioethanol", "bioethanol_unit", "biogas", "biogas_unit", "biofertilizer", "biofertilizer_unit", "model_endpoint"],
    history.map((h) => [new Date(h.ts).toISOString(), h.inputs.weight, h.inputs.moisture, h.inputs.temperature, h.inputs.ph,
      ...OUTPUTS.flatMap((k) => [h.prediction.values[k], h.prediction.units[k] ?? "not provided"]), h.endpoint]),
  ));

  const fieldErr = (k: keyof PredInputs) => (touched ? errs[k] : undefined);

  return (
    <div>
      <PageHeader title="Yield Predictor" sub="Trained-model yield prediction · user-entered conditions → model-predicted yields"
        actions={<StatusPill tone={connected ? "telemetry" : "warn"}>{connected ? "Model endpoint configured" : "Model connection required"}</StatusPill>} />

      {!connected && (
        <div className="mb-3 rounded-md border border-warn/50 bg-warn/10 p-3 text-sm text-warn">
          <b>Model connection required.</b> No trained yield model is included in this project. Deploy your Colab/scikit-learn model as an HTTPS API (with CORS enabled) and paste its prediction URL below. Until then, no yields are shown.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
        <div className="grid content-start gap-3">
          <Panel title="Model connection">
            <label className="label-tech">Prediction endpoint (POST)</label>
            <div className="mt-1 flex gap-2">
              <input value={draftEp} onChange={(e) => setDraftEp(e.target.value)} placeholder="https://your-model.example.com/predict"
                className="min-w-0 flex-1 rounded-md border bg-surface px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <Button size="sm" variant="outline" onClick={() => { setEndpoint(draftEp.trim()); setEp(draftEp.trim()); toast.success(draftEp.trim() ? "Endpoint saved" : "Endpoint cleared"); }}><Plug className="h-3.5 w-3.5" /> Save</Button>
            </div>
            <p className="mt-2 text-[0.68rem] text-muted-foreground">Sends <code>{`{"features":[weight_kg, moisture_%, temp_°C, pH]}`}</code>. Expects <code>{`{"bioethanol","biogas","biofertilizer","units"}`}</code> or <code>{`{"predictions":[…3]}`}</code>.</p>
          </Panel>
          <Panel title="Operating conditions (user-entered)">
            <div className="grid grid-cols-2 gap-3">
              {([["weight", "Bagasse weight", "kg", 10], ["moisture", "Moisture content", "%", 1], ["temperature", "Process temperature", "°C", 0.5], ["ph", "Process pH", "", 0.1]] as const).map(([k, l, u, s]) => (
                <div key={k}>
                  <NumField label={l} unit={u || undefined} step={s} min={-1e9} max={1e9} value={inp[k]} onChange={(v) => setInp({ ...inp, [k]: v })} />
                  {fieldErr(k) && <span className="text-[0.68rem] text-crit">{fieldErr(k)}</span>}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={run} disabled={loading}>{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {result ? "Run New Prediction" : "Predict Yields"}</Button>
              <Button size="sm" variant="outline" onClick={() => { setInp(DEFAULT_PRED_INPUTS); setTouched(false); setError(null); setResult(null); setInsights(null); }}><RotateCcw className="h-3.5 w-3.5" /> Reset Inputs</Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/scenarios" search={{ mass: inp.weight, moisture: inp.moisture, t: inp.temperature, ph: inp.ph }}><Send className="h-3.5 w-3.5" /> Send to simulator</Link>
              </Button>
            </div>
            {error && <p role="alert" className="mt-3 rounded border border-crit/50 bg-crit/10 p-2 text-xs text-crit">{error}</p>}
          </Panel>
        </div>

        <div className="grid min-w-0 content-start gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {OUTPUTS.map((k) => (
              <div key={k} className="panel p-4">
                <div className="label-tech">{LABEL[k]} · model-predicted</div>
                <div className="num mt-1 text-2xl font-semibold" style={{ color: COLOR[k] }}>{result ? fmt(result.p.values[k]) : "—"}</div>
                <div className="text-xs text-muted-foreground">{result ? unitOf(result.p, k) : connected ? "Run a prediction" : "Awaiting model connection"}</div>
              </div>
            ))}
          </div>
          <Panel title="Predicted outputs comparison">
            {!result ? <Empty>No prediction yet</Empty> : (
              <>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={OUTPUTS.map((k) => ({ name: `${LABEL[k]} (${result.p.units[k] ?? "?"})`, value: result.p.values[k], fill: COLOR[k] }))} margin={{ left: 10, right: 8, top: 6, bottom: 18 }}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" opacity={0.5} />
                      <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11}><Label value="Product stream (unit)" position="insideBottom" offset={-12} fill="var(--color-muted-foreground)" fontSize={11} /></XAxis>
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={11}><Label value="Predicted yield (own unit)" angle={-90} position="insideLeft" fill="var(--color-muted-foreground)" fontSize={11} /></YAxis>
                      <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
                      <Bar dataKey="value" name="Predicted" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[0.68rem] text-muted-foreground">Outputs have different units; bar heights are not directly comparable.</p>
                <div className="mt-3 label-tech">Conditions used for this prediction</div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  {[["Weight", `${result.inputs.weight} kg`], ["Moisture", `${result.inputs.moisture} %`], ["Temperature", `${result.inputs.temperature} °C`], ["pH", result.inputs.ph]].map(([a, b]) => (
                    <div key={String(a)} className="rounded border bg-surface/60 px-2 py-1"><span className="text-muted-foreground">{a}: </span><span className="num">{b}</span></div>
                  ))}
                </div>
              </>
            )}
          </Panel>
          <Panel title="Prediction Insights" action={result && <Button size="sm" variant="outline" onClick={runInsights} disabled={insLoading}>{insLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Run sensitivity analysis</Button>}>
            {!insights ? <Empty>{result ? "Queries the connected model with each input nudged up and down (8 extra calls)." : "Available after a successful model prediction."}</Empty> : (
              <table className="w-full text-xs">
                <thead className="label-tech text-left"><tr><th className="py-1">Input change</th>{OUTPUTS.map((k) => <th key={k}>Δ {LABEL[k]}</th>)}</tr></thead>
                <tbody className="num">
                  {insights.map((r) => (
                    <tr key={r.f} className="border-t border-border/50">
                      <td className="py-1 font-sans">{{ weight: "+10% weight", moisture: "+5 % moisture", temperature: "+2 °C", ph: "+0.3 pH" }[r.f]}</td>
                      {OUTPUTS.map((k) => <td key={k} className={r.d[k] >= 0 ? "text-ok" : "text-crit"}>{r.d[k] >= 0 ? "+" : ""}{fmt(r.d[k])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <Panel title="Prediction history (this browser only)" action={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!history.length} onClick={exportCSV}><Download className="h-3.5 w-3.5" /> CSV</Button>
              <Button size="sm" variant="ghost" disabled={!history.length} onClick={() => { setHistory([]); saveHistory([]); }} aria-label="Clear history"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>}>
            {!history.length ? <Empty>No predictions yet</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="label-tech text-left"><tr><th className="py-1">Time</th><th>Weight kg</th><th>Moisture %</th><th>Temp °C</th><th>pH</th>{OUTPUTS.map((k) => <th key={k}>{LABEL[k]}</th>)}</tr></thead>
                  <tbody className="num">
                    {history.map((h) => (
                      <tr key={h.id} className="border-t border-border/50">
                        <td className="py-1">{fmtDateTime(h.ts)}</td><td>{h.inputs.weight}</td><td>{h.inputs.moisture}</td><td>{h.inputs.temperature}</td><td>{h.inputs.ph}</td>
                        {OUTPUTS.map((k) => <td key={k}>{fmt(h.prediction.values[k])} {h.prediction.units[k] ?? ""}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
