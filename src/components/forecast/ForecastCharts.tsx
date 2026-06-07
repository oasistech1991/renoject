import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { fmtGBP } from "@/lib/btl";

export type DealDatum = { name: string; monthly: number; annual: number; rent: number };
export type CumulativeDatum = { month: string; cashflow: number; rent: number };

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--card-foreground)",
};

export function DealsChart({ data }: { data: DealDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtGBP(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="monthly" name="Monthly CF" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="annual" name="Annual CF" fill="var(--accent)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CumulativeChart({ data }: { data: CumulativeDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtGBP(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="rent" name="Cumulative rent" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="cashflow" name="Cumulative cashflow" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ForecastCharts(props: { deals: DealDatum[]; cumulative: CumulativeDatum[] }) {
  return null;
}