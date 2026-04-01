"use client";
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { cn } from "@/lib/utils";

const PERIODS = [
  { key: "1m",  label: "1M" },
  { key: "3m",  label: "3M" },
  { key: "6m",  label: "6M" },
  { key: "1y",  label: "1Y" },
  { key: "3y",  label: "3Y" },
  { key: "5y",  label: "5Y" },
  { key: "all", label: "All" },
];

interface NavPoint { date: string; nav: number }

interface Props {
  fundId: number;
  fundName?: string;
  benchmarkName?: string;
}

export function ReturnsChart({ fundId, fundName, benchmarkName }: Props) {
  const [period, setPeriod] = useState("3y");
  const [data, setData] = useState<NavPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [baselinedData, setBaselinedData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/funds/${fundId}/nav?period=${period}`);
        const json = await res.json();
        const raw: NavPoint[] = json.data ?? [];
        setData(raw);

        // Normalise to base 100
        if (raw.length > 0) {
          const base = raw[0].nav;
          setBaselinedData(raw.map((p) => ({
            date: p.date,
            nav: parseFloat(((p.nav / base) * 100).toFixed(2)),
          })));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fundId, period]);

  const totalReturn = data.length >= 2
    ? ((data[data.length - 1].nav - data[0].nav) / data[0].nav * 100).toFixed(2)
    : null;
  const isPositive = totalReturn !== null && parseFloat(totalReturn) >= 0;

  return (
    <div className="space-y-3">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "px-3 py-1.5 transition-colors",
                period === p.key
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {totalReturn && (
          <span className={cn("text-sm font-semibold", isPositive ? "text-green-500" : "text-red-500")}>
            {isPositive ? "+" : ""}{totalReturn}%
          </span>
        )}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          Loading chart...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={baselinedData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(d) => {
                const date = new Date(d);
                return period === "1m" || period === "3m"
                  ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                  : date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
              }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `${v.toFixed(0)}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(v: number) => [`${v.toFixed(2)}`, "Base 100"]}
              labelFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            />
            <ReferenceLine y={100} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1} />
            <Line
              type="monotone"
              dataKey="nav"
              stroke={isPositive ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)"}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
