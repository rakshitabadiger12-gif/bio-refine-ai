import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Empty, fmtTime } from "./ui";

export interface Series {
  key: string;
  name: string;
  color: string;
}

export function TrendChart({ data, series, height = 240, refLines = [] }: { data: Record<string, number | null>[]; series: Series[]; height?: number; refLines?: { y: number; label: string; color: string }[] }) {
  if (!data.length) return <Empty>Waiting for simulation data…</Empty>;
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" opacity={0.5} />
          <XAxis dataKey="ts" tickFormatter={(v) => fmtTime(v)} stroke="var(--color-muted-foreground)" fontSize={10} minTickGap={40} />
          <YAxis stroke="var(--color-muted-foreground)" fontSize={10} domain={["auto", "auto"]} width={48} />
          <Tooltip
            contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }}
            labelFormatter={(v) => fmtTime(Number(v))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {refLines.map((r) => (
            <ReferenceLine key={r.label} y={r.y} stroke={r.color} strokeDasharray="4 4" label={{ value: r.label, fill: r.color, fontSize: 10, position: "insideTopRight" }} />
          ))}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} dot={false} strokeWidth={1.8} isAnimationActive={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const REACTOR_COLORS = {
  ethanol: "var(--color-chart-3)",
  biogas: "var(--color-chart-2)",
  fertilizer: "var(--color-chart-1)",
} as const;
