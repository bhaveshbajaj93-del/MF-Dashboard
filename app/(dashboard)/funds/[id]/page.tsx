"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn, fmtReturn, fmtCrores, fmtPct, fmtNum, returnColor, categoryColor } from "@/lib/utils";
import { ReturnsChart } from "@/components/funds/ReturnsChart";
import { RiskMetricsCard } from "@/components/funds/RiskMetricsCard";
import { PortfolioHoldings } from "@/components/funds/PortfolioHoldings";
import { ForwardEstimates } from "@/components/funds/ForwardEstimates";
import { ManagerTimeline } from "@/components/managers/ManagerTimeline";
import { ArrowLeft, ExternalLink, Star } from "lucide-react";

const TABS = ["Overview", "Returns", "Risk", "Portfolio", "Managers", "History", "Intelligence"] as const;
type Tab = typeof TABS[number];

function StatRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/40 last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-right", valueClass)}>{value}</span>
    </div>
  );
}

function ReturnBox({ period, value }: { period: string; value: number | null | undefined }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <div className="text-[10px] text-muted-foreground mb-1 font-medium">{period}</div>
      <div className={cn("text-lg font-bold tabular-nums", returnColor(value))}>
        {value !== null && value !== undefined ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "—"}
      </div>
    </div>
  );
}

export default function FundDetailPage() {
  const params = useParams();
  const router = useRouter();
  const fundId = Number(params.id);
  const [tab, setTab] = useState<Tab>("Overview");
  const [fund, setFund] = useState<any>(null);
  const [holdings, setHoldings] = useState<any>(null);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [fRes, mRes] = await Promise.all([
          fetch(`/api/funds/${fundId}`),
          fetch(`/api/funds/${fundId}/manager`),
        ]);
        const fJson = await fRes.json();
        const mJson = await mRes.json();
        setFund(fJson.data);
        setManagers(mJson.data ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fundId]);

  useEffect(() => {
    if (tab === "Portfolio" && !holdings) {
      fetch(`/api/funds/${fundId}/holdings`)
        .then((r) => r.json())
        .then((j) => setHoldings(j.data));
    }
  }, [tab, fundId, holdings]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>;
  }
  if (!fund) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Fund not found.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 bg-background/80 backdrop-blur sticky top-0 z-10">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold leading-tight">{fund.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", categoryColor(fund.catType ?? "other"))}>
                {fund.sebiCategory}
              </span>
              {fund.planType === "direct" && (
                <span className="text-xs px-2 py-0.5 rounded border bg-green-500/10 text-green-400 border-green-500/20 font-medium">DIRECT</span>
              )}
              <span className="text-xs text-muted-foreground">{fund.amcName}</span>
              {fund.vroUrl && (
                <a href={fund.vroUrl} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:underline flex items-center gap-0.5">
                  VRO <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-muted-foreground">AUM</div>
            <div className="text-base font-bold">{fmtCrores(fund.aumCrores)}</div>
            {fund.starRating && (
              <div className="flex gap-0.5 mt-1 justify-end">
                {[1,2,3,4,5].map((i) => (
                  <Star key={i} className={cn("w-3 h-3", i <= fund.starRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mt-3">
          {[
            ["1M", fund.return1m], ["3M", fund.return3m], ["6M", fund.return6m],
            ["1Y", fund.return1y], ["3Y", fund.return3y], ["5Y", fund.return5y],
            ["10Y", fund.return10y], ["TER", fund.expenseRatio !== null ? `${fund.expenseRatio}%` : null],
          ].map(([label, val]) => (
            <div key={label as string} className="text-center">
              <div className="text-[10px] text-muted-foreground">{label}</div>
              <div className={cn("text-xs font-semibold tabular-nums", typeof val === "number" ? returnColor(val) : "")}>
                {val === null || val === undefined ? "—" : typeof val === "number" ? `${val >= 0 ? "+" : ""}${val.toFixed(2)}%` : val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "Overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <ReturnsChart fundId={fundId} fundName={fund.name} />
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Key Details</h3>
                <StatRow label="Fund House" value={fund.amcName} />
                <StatRow label="Benchmark" value={fund.benchmarkIndex ?? "—"} />
                <StatRow label="Launch Date" value={fund.launchDate ?? "—"} />
                <StatRow label="Min SIP" value={fund.minSip ? `₹${fund.minSip}` : "—"} />
                <StatRow label="Min Lumpsum" value={fund.minLumpsum ? `₹${fund.minLumpsum}` : "—"} />
                <StatRow label="Exit Load" value={fund.exitLoad ?? "—"} />
                <StatRow label="Expense Ratio" value={fmtPct(fund.expenseRatio)} />
                <StatRow label="AUM" value={fmtCrores(fund.aumCrores)} />
              </div>
              {fund.fundObjective && (
                <div className="rounded-lg border border-border p-4">
                  <h3 className="text-sm font-semibold mb-2">Objective</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{fund.fundObjective}</p>
                </div>
              )}
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold mb-3">Risk (3Y)</h3>
                <StatRow label="Sharpe" value={fmtNum(fund.sharpe3y)} />
                <StatRow label="Sortino" value={fmtNum(fund.sortino3y)} />
                <StatRow label="Beta" value={fmtNum(fund.beta3y)} />
                <StatRow label="Alpha" value={fmtPct(fund.alpha3y)} valueClass={returnColor(fund.alpha3y)} />
                <StatRow label="Max Drawdown" value={fund.maxDrawdown3y ? `-${fund.maxDrawdown3y.toFixed(1)}%` : "—"} valueClass="text-red-400" />
              </div>
            </div>
          </div>
        )}

        {tab === "Returns" && (
          <div className="space-y-6">
            <ReturnsChart fundId={fundId} fundName={fund.name} />
            <div>
              <h3 className="text-sm font-semibold mb-3">Returns Summary</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {([["1M", fund.return1m], ["3M", fund.return3m], ["6M", fund.return6m],
                  ["1Y", fund.return1y], ["3Y", fund.return3y], ["5Y", fund.return5y], ["10Y", fund.return10y]] as const).map(([p, v]) => (
                  <ReturnBox key={p} period={p} value={v as number | null} />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "Risk" && (
          <RiskMetricsCard
            sharpe1y={fund.sharpe1y} sharpe3y={fund.sharpe3y}
            sortino1y={fund.sortino1y} sortino3y={fund.sortino3y}
            beta1y={fund.beta1y} beta3y={fund.beta3y}
            alpha1y={fund.alpha1y} alpha3y={fund.alpha3y}
            maxDrawdown1y={fund.maxDrawdown1y} maxDrawdown3y={fund.maxDrawdown3y}
            stdDev1y={fund.stdDev1y} stdDev3y={fund.stdDev3y}
            treynor1y={fund.treynor1y}
          />
        )}

        {tab === "Portfolio" && (
          <div className="space-y-6">
            {!holdings ? (
              <div className="text-muted-foreground text-sm">Loading portfolio data...</div>
            ) : (
              <>
                <PortfolioHoldings
                  holdings={holdings.holdings ?? []}
                  sectors={holdings.sectors ?? []}
                  assetAllocation={holdings.assetAllocation}
                  benchmarkSectors={holdings.benchmarkSectors ?? []}
                  benchmarkName={holdings.benchmarkName ?? "Nifty 50"}
                  portfolioChanges={holdings.portfolioChanges ?? { newEntries: [], exits: [], added: [], trimmed: [] }}
                  month={holdings.month ?? ""}
                />
                <ForwardEstimates
                  wtdForwardPe={fund.wtdForwardPe}
                  wtdForwardPb={fund.wtdForwardPb}
                  wtdEpsGrowth1y={fund.wtdEpsGrowth1y}
                  wtdEpsGrowth3y={fund.wtdEpsGrowth3y}
                  wtdRevGrowth1y={fund.wtdRevGrowth1y}
                  wtdRevGrowth3y={fund.wtdRevGrowth3y}
                  dataCoverage={fund.dataCoverage}
                  screenerFormulas={fund.screenerFormulas}
                />
              </>
            )}
          </div>
        )}

        {tab === "Managers" && (
          <ManagerTimeline career={managers} managerName={fund.name} />
        )}

        {tab === "History" && (
          <div className="space-y-4">
            <ReturnsChart fundId={fundId} fundName={fund.name} />
            <div className="text-xs text-muted-foreground italic">
              AUM history and expense ratio history will be populated after running the fund details seed.
            </div>
          </div>
        )}

        {tab === "Intelligence" && (
          <div className="space-y-4">
            <ForwardEstimates
              wtdForwardPe={fund.wtdForwardPe}
              wtdForwardPb={fund.wtdForwardPb}
              wtdEpsGrowth1y={fund.wtdEpsGrowth1y}
              wtdEpsGrowth3y={fund.wtdEpsGrowth3y}
              wtdRevGrowth1y={fund.wtdRevGrowth1y}
              wtdRevGrowth3y={fund.wtdRevGrowth3y}
              dataCoverage={fund.dataCoverage}
              screenerFormulas={fund.screenerFormulas}
            />
          </div>
        )}
      </div>
    </div>
  );
}
