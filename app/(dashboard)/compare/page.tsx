"use client";
import { useState, useEffect } from "react";
import { cn, fmtReturn, fmtCrores, fmtNum, fmtPct, returnColor, categoryColor } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart, Bar, Cell } from "recharts";
import { GitCompare, X, Plus, Search } from "lucide-react";

const MAX_FUNDS = 5;
const LINE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#f43f5e", "#a855f7"];
const TABS = ["Returns", "NAV Chart", "Asset Allocation", "Holdings", "Sector vs Benchmark", "Forward Estimates", "Managers"] as const;
type Tab = typeof TABS[number];

interface FundSummary {
  id: number;
  name: string;
  catType: string | null;
  amcName: string | null;
  return1y: number | null;
  return3y: number | null;
  return5y: number | null;
  sharpe3y: number | null;
  sortino3y: number | null;
  beta3y: number | null;
  alpha3y: number | null;
  maxDrawdown3y: number | null;
  aumCrores: number | null;
  expenseRatio: number | null;
  wtdForwardPe: number | null;
  wtdEpsGrowth1y: number | null;
  equityPct: number | null;
  debtPct: number | null;
  cashPct: number | null;
}

export default function ComparePage() {
  const [tab, setTab] = useState<Tab>("Returns");
  const [basket, setBasket] = useState<FundSummary[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [navData, setNavData] = useState<Record<number, any[]>>({});

  // Search for funds to add
  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/funds?q=${encodeURIComponent(searchQ)}&limit=8&option=growth`);
      const j = await res.json();
      setSearchResults(j.data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const addFund = (fund: any) => {
    if (basket.length >= MAX_FUNDS) return;
    if (basket.find((f) => f.id === fund.id)) return;
    setBasket((b) => [...b, fund]);
    setSearchQ("");
    setSearchResults([]);
  };

  const removeFund = (id: number) => setBasket((b) => b.filter((f) => f.id !== id));

  // Fetch NAV data when needed
  useEffect(() => {
    if (tab !== "NAV Chart") return;
    for (const fund of basket) {
      if (!navData[fund.id]) {
        fetch(`/api/funds/${fund.id}/nav?period=3y`)
          .then((r) => r.json())
          .then((j) => setNavData((d) => ({ ...d, [fund.id]: j.data ?? [] })));
      }
    }
  }, [tab, basket, navData]);

  // Build overlaid normalised chart data
  const chartData = (() => {
    if (basket.length === 0) return [];
    const allDatesSet = new Set<string>();
    const fundNavs: Record<number, Map<string, number>> = {};
    for (const fund of basket) {
      const rows = navData[fund.id] ?? [];
      fundNavs[fund.id] = new Map(rows.map((r: any) => [r.date, r.nav]));
      rows.forEach((r: any) => allDatesSet.add(r.date));
    }
    const sortedDates = Array.from(allDatesSet).sort();
    const baselines: Record<number, number> = {};
    for (const fund of basket) {
      const first = sortedDates.find((d) => fundNavs[fund.id].has(d));
      baselines[fund.id] = first ? (fundNavs[fund.id].get(first) ?? 100) : 100;
    }
    return sortedDates.map((date) => {
      const point: any = { date };
      for (const fund of basket) {
        const nav = fundNavs[fund.id].get(date);
        if (nav) point[`fund_${fund.id}`] = parseFloat(((nav / baselines[fund.id]) * 100).toFixed(2));
      }
      return point;
    }).filter((_, i) => i % 3 === 0); // sample for performance
  })();

  const METRIC_ROWS = [
    { label: "AUM", fmt: (f: FundSummary) => fmtCrores(f.aumCrores) },
    { label: "Expense Ratio", fmt: (f: FundSummary) => fmtPct(f.expenseRatio) },
    { label: "1Y Return", fmt: (f: FundSummary) => fmtReturn(f.return1y), color: (f: FundSummary) => returnColor(f.return1y) },
    { label: "3Y Return (CAGR)", fmt: (f: FundSummary) => fmtReturn(f.return3y), color: (f: FundSummary) => returnColor(f.return3y) },
    { label: "5Y Return (CAGR)", fmt: (f: FundSummary) => fmtReturn(f.return5y), color: (f: FundSummary) => returnColor(f.return5y) },
    { label: "Sharpe (3Y)", fmt: (f: FundSummary) => fmtNum(f.sharpe3y) },
    { label: "Sortino (3Y)", fmt: (f: FundSummary) => fmtNum(f.sortino3y) },
    { label: "Beta (3Y)", fmt: (f: FundSummary) => fmtNum(f.beta3y) },
    { label: "Alpha (3Y)", fmt: (f: FundSummary) => fmtReturn(f.alpha3y, 2), color: (f: FundSummary) => returnColor(f.alpha3y) },
    { label: "Max Drawdown (3Y)", fmt: (f: FundSummary) => f.maxDrawdown3y ? `-${f.maxDrawdown3y.toFixed(1)}%` : "—" },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <GitCompare className="w-5 h-5" />
        <h1 className="text-xl font-bold">Compare Funds</h1>
        <span className="text-xs text-muted-foreground">({basket.length}/{MAX_FUNDS} funds)</span>
      </div>

      {/* Fund selector */}
      <div className="flex flex-wrap items-center gap-2">
        {basket.map((fund, i) => (
          <div key={fund.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium"
            style={{ borderColor: LINE_COLORS[i], color: LINE_COLORS[i], background: `${LINE_COLORS[i]}15` }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: LINE_COLORS[i] }} />
            <span className="max-w-[160px] truncate">{fund.name}</span>
            <button onClick={() => removeFund(fund.id)}><X className="w-3 h-3" /></button>
          </div>
        ))}
        {basket.length < MAX_FUNDS && (
          <div className="relative">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border text-xs text-muted-foreground">
              <Search className="w-3 h-3" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Add fund..."
                className="bg-transparent outline-none w-32"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="absolute top-8 left-0 z-20 bg-card border border-border rounded-lg shadow-lg w-72 max-h-48 overflow-y-auto">
                {searchResults.map((r) => (
                  <button key={r.id} onClick={() => addFund(r)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors border-b border-border/50 last:border-0">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-muted-foreground">{r.amcName}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {basket.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed border-border rounded-xl">
          <GitCompare className="w-8 h-8 mb-2 opacity-30" />
          <div className="text-sm">Search and add up to 5 funds to compare</div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b border-border">
            <div className="flex gap-0 -mb-px overflow-x-auto">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn("px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                    tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Tab: Returns */}
          {tab === "Returns" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium text-xs">Metric</th>
                    {basket.map((f, i) => (
                      <th key={f.id} className="text-right py-2 px-3 text-xs font-semibold" style={{ color: LINE_COLORS[i] }}>
                        <div className="max-w-[120px] truncate ml-auto">{f.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRIC_ROWS.map((row) => (
                    <tr key={row.label} className="border-b border-border/40 hover:bg-accent/20">
                      <td className="py-2 pr-4 text-muted-foreground text-xs">{row.label}</td>
                      {basket.map((f) => (
                        <td key={f.id} className={cn("py-2 px-3 text-right text-xs font-medium tabular-nums", row.color?.(f))}>
                          {row.fmt(f)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab: NAV Chart */}
          {tab === "NAV Chart" && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">All NAVs normalised to base 100 (3Y window)</p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })} interval="preserveStartEnd" minTickGap={60} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }} />
                  <Legend formatter={(v) => { const id = parseInt(v.replace("fund_", "")); return basket.find((f) => f.id === id)?.name ?? v; }} />
                  {basket.map((fund, i) => (
                    <Line key={fund.id} type="monotone" dataKey={`fund_${fund.id}`} stroke={LINE_COLORS[i]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tab: Asset Allocation */}
          {tab === "Asset Allocation" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {basket.map((fund, i) => {
                const data = [
                  { name: "Equity", value: fund.equityPct ?? 0 },
                  { name: "Debt", value: fund.debtPct ?? 0 },
                  { name: "Cash", value: fund.cashPct ?? 0 },
                ].filter((d) => d.value > 0);
                return (
                  <div key={fund.id} className="border border-border rounded-lg p-4">
                    <div className="text-sm font-medium mb-3 truncate" style={{ color: LINE_COLORS[i] }}>{fund.name}</div>
                    {data.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No allocation data</div>
                    ) : (
                      <div className="space-y-2">
                        {data.map((d) => (
                          <div key={d.name}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{d.name}</span>
                              <span className="font-medium">{d.value.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${d.value}%`, background: LINE_COLORS[i] }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab: Forward Estimates */}
          {tab === "Forward Estimates" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium text-xs">Metric</th>
                    {basket.map((f, i) => (
                      <th key={f.id} className="text-right py-2 px-3 text-xs font-semibold" style={{ color: LINE_COLORS[i] }}>
                        <div className="max-w-[120px] truncate ml-auto">{f.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Forward P/E", key: "wtdForwardPe" as keyof FundSummary },
                    { label: "EPS Growth 1Y", key: "wtdEpsGrowth1y" as keyof FundSummary },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-border/40">
                      <td className="py-2 pr-4 text-muted-foreground text-xs">{row.label}</td>
                      {basket.map((f) => (
                        <td key={f.id} className="py-2 px-3 text-right text-xs tabular-nums">
                          {f[row.key] !== null && f[row.key] !== undefined ? String(f[row.key]) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Other tabs: placeholder */}
          {(tab === "Holdings" || tab === "Sector vs Benchmark" || tab === "Managers") && (
            <div className="text-sm text-muted-foreground p-4 border border-dashed border-border rounded-lg">
              Detailed {tab} comparison available after running <code className="text-xs bg-muted px-1 rounded">npm run seed:fund-details</code> and <code className="text-xs bg-muted px-1 rounded">npm run seed:managers</code>.
            </div>
          )}
        </>
      )}
    </div>
  );
}
