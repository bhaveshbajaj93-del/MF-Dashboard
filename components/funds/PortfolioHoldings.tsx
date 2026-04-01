"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Plus, Minus } from "lucide-react";

interface Holding {
  stockName: string;
  isin: string | null;
  sector: string | null;
  percentage: number;
  isNewEntry?: boolean | null;
  isFullExit?: boolean | null;
  pctChange?: number | null;
}

interface SectorAlloc { sectorName: string; percentage: number }
interface AssetAlloc {
  equityPct?: number | null;
  debtPct?: number | null;
  cashPct?: number | null;
  reitPct?: number | null;
  goldPct?: number | null;
  largeCapPct?: number | null;
  midCapPct?: number | null;
  smallCapPct?: number | null;
}

interface BenchmarkSector { sectorName: string; percentage: number }
interface PortfolioChanges {
  newEntries: Holding[];
  exits: Holding[];
  added: Holding[];
  trimmed: Holding[];
}

interface Props {
  holdings: Holding[];
  sectors: SectorAlloc[];
  assetAllocation: AssetAlloc | null;
  benchmarkSectors: BenchmarkSector[];
  benchmarkName: string;
  portfolioChanges: PortfolioChanges;
  month: string;
}

const SECTOR_COLORS = [
  "#3b82f6","#8b5cf6","#06b6d4","#f59e0b","#10b981","#f43f5e",
  "#6366f1","#ec4899","#14b8a6","#f97316","#84cc16","#a855f7"
];

export function PortfolioHoldings({ holdings, sectors, assetAllocation, benchmarkSectors, benchmarkName, portfolioChanges, month }: Props) {
  const benchMap = new Map(benchmarkSectors.map((b) => [b.sectorName, b.percentage]));
  const sectorVsBench = sectors.map((s) => ({
    name: s.sectorName,
    fund: s.percentage,
    benchmark: benchMap.get(s.sectorName) ?? 0,
    diff: s.percentage - (benchMap.get(s.sectorName) ?? 0),
  })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const assetData = assetAllocation ? [
    { name: "Equity", value: assetAllocation.equityPct ?? 0 },
    { name: "Debt", value: assetAllocation.debtPct ?? 0 },
    { name: "Cash", value: assetAllocation.cashPct ?? 0 },
    { name: "REITs", value: assetAllocation.reitPct ?? 0 },
    { name: "Gold", value: assetAllocation.goldPct ?? 0 },
  ].filter((d) => d.value > 0) : [];

  const capData = assetAllocation ? [
    { name: "Large", value: assetAllocation.largeCapPct ?? 0 },
    { name: "Mid", value: assetAllocation.midCapPct ?? 0 },
    { name: "Small", value: assetAllocation.smallCapPct ?? 0 },
  ].filter((d) => d.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Asset allocation */}
      {assetData.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Asset Allocation</h4>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={assetData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value">
                    {assetData.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1">
                {assetData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SECTOR_COLORS[i] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-medium ml-auto pl-2">{d.value.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {capData.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Market Cap Mix</h4>
              <div className="space-y-2">
                {capData.map((d, i) => (
                  <div key={d.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{d.name} Cap</span>
                      <span className="font-medium">{d.value.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.value}%`, background: SECTOR_COLORS[i + 3] }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sector vs Benchmark */}
      {sectorVsBench.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">Sector Allocation vs {benchmarkName}</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Green = overweight vs benchmark · Red = underweight
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {sectorVsBench.slice(0, 15).map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-muted-foreground truncate max-w-[140px]">{s.name}</span>
                  <div className="flex items-center gap-2 text-xs tabular-nums">
                    <span className="text-muted-foreground">{s.benchmark.toFixed(1)}%</span>
                    <span className="font-medium">{s.fund.toFixed(1)}%</span>
                    <span className={cn("font-semibold w-12 text-right", s.diff > 0 ? "text-green-500" : s.diff < 0 ? "text-red-500" : "")}>
                      {s.diff > 0 ? "+" : ""}{s.diff.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                  {/* Benchmark bar */}
                  <div className="absolute h-full bg-muted-foreground/30 rounded-full"
                    style={{ width: `${Math.min(s.benchmark, 100)}%` }} />
                  {/* Fund bar */}
                  <div className={cn("absolute h-full rounded-full", s.diff >= 0 ? "bg-green-500" : "bg-red-500")}
                    style={{ width: `${Math.min(s.fund, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio Changes: What's In / Out */}
      {(portfolioChanges.newEntries.length > 0 || portfolioChanges.exits.length > 0 || portfolioChanges.added.length > 0 || portfolioChanges.trimmed.length > 0) && (
        <div>
          <h4 className="text-sm font-medium mb-3">Portfolio Changes (Last 3 Months)</h4>
          <div className="grid grid-cols-2 gap-3">
            {portfolioChanges.newEntries.length > 0 && (
              <ChangeTable title="New Entries" icon={<Plus className="w-3 h-3 text-green-400" />} color="text-green-400"
                items={portfolioChanges.newEntries} />
            )}
            {portfolioChanges.exits.length > 0 && (
              <ChangeTable title="Exits" icon={<Minus className="w-3 h-3 text-red-400" />} color="text-red-400"
                items={portfolioChanges.exits} />
            )}
            {portfolioChanges.added.length > 0 && (
              <ChangeTable title="Significantly Added" icon={<TrendingUp className="w-3 h-3 text-green-400" />} color="text-green-400"
                items={portfolioChanges.added} showChange />
            )}
            {portfolioChanges.trimmed.length > 0 && (
              <ChangeTable title="Significantly Trimmed" icon={<TrendingDown className="w-3 h-3 text-red-400" />} color="text-red-400"
                items={portfolioChanges.trimmed} showChange />
            )}
          </div>
        </div>
      )}

      {/* Top Holdings */}
      <div>
        <h4 className="text-sm font-medium mb-3">Top Holdings — {month}</h4>
        <div className="space-y-1.5">
          {holdings.slice(0, 20).map((h, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-5 text-right text-muted-foreground">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{h.stockName}</div>
                {h.sector && <div className="text-[10px] text-muted-foreground">{h.sector}</div>}
              </div>
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
                <div className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min((h.percentage / (holdings[0]?.percentage || 1)) * 100, 100)}%` }} />
              </div>
              <span className="w-10 text-right font-medium tabular-nums">{h.percentage.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChangeTable({ title, icon, color, items, showChange }: {
  title: string; icon: React.ReactNode; color: string;
  items: Holding[]; showChange?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className={cn("text-xs font-semibold", color)}>{title}</span>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      <div className="space-y-1">
        {items.slice(0, 6).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="truncate max-w-[120px] text-muted-foreground">{item.stockName}</span>
            {showChange && item.pctChange !== null && item.pctChange !== undefined ? (
              <span className={cn("font-medium tabular-nums", item.pctChange > 0 ? "text-green-500" : "text-red-500")}>
                {item.pctChange > 0 ? "+" : ""}{item.pctChange.toFixed(1)}%
              </span>
            ) : (
              <span className="font-medium tabular-nums">{item.percentage?.toFixed(1)}%</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
