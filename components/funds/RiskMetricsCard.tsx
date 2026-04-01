"use client";
import { cn, fmtNum, fmtPct, returnColor } from "@/lib/utils";

interface Props {
  sharpe1y?: number | null;
  sharpe3y?: number | null;
  sortino1y?: number | null;
  sortino3y?: number | null;
  beta1y?: number | null;
  beta3y?: number | null;
  alpha1y?: number | null;
  alpha3y?: number | null;
  maxDrawdown1y?: number | null;
  maxDrawdown3y?: number | null;
  stdDev1y?: number | null;
  stdDev3y?: number | null;
  treynor1y?: number | null;
}

interface MetricCardProps {
  label: string;
  val1y: number | null | undefined;
  val3y: number | null | undefined;
  format: (v: number | null | undefined) => string;
  colorize?: boolean;
  inverted?: boolean; // lower is better (e.g. drawdown, std dev)
  tooltip: string;
}

function MetricCard({ label, val1y, val3y, format, colorize, inverted, tooltip }: MetricCardProps) {
  const color = (v: number | null | undefined) => {
    if (!colorize || v === null || v === undefined) return "text-foreground";
    if (inverted) return v < 0 ? "text-green-500" : v > 15 ? "text-red-500" : "text-foreground";
    return returnColor(v);
  };
  return (
    <div className="bg-card rounded-lg border border-border p-4" title={tooltip}>
      <div className="text-xs text-muted-foreground mb-2 font-medium">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">1Y</div>
          <div className={cn("text-base font-semibold tabular-nums", color(val1y))}>{format(val1y)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">3Y</div>
          <div className={cn("text-base font-semibold tabular-nums", color(val3y))}>{format(val3y)}</div>
        </div>
      </div>
    </div>
  );
}

export function RiskMetricsCard(props: Props) {
  const fmt2 = (v: number | null | undefined) => v !== null && v !== undefined ? v.toFixed(2) : "—";
  const fmtPctFn = (v: number | null | undefined) => v !== null && v !== undefined ? `${v.toFixed(1)}%` : "—";
  const fmtDD = (v: number | null | undefined) => v !== null && v !== undefined ? `-${v.toFixed(1)}%` : "—";

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Risk Metrics</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard label="Sharpe Ratio"
          val1y={props.sharpe1y} val3y={props.sharpe3y} format={fmt2} colorize
          tooltip="(Annualised Return – Risk-Free Rate) / Std Dev. Higher = better risk-adjusted return." />
        <MetricCard label="Sortino Ratio"
          val1y={props.sortino1y} val3y={props.sortino3y} format={fmt2} colorize
          tooltip="Like Sharpe but only penalises downside volatility. Higher = better." />
        <MetricCard label="Beta"
          val1y={props.beta1y} val3y={props.beta3y} format={fmt2}
          tooltip="Market sensitivity vs benchmark. 1.0 = moves with market, <1 = less volatile." />
        <MetricCard label="Alpha"
          val1y={props.alpha1y} val3y={props.alpha3y} format={fmtPctFn} colorize
          tooltip="Excess return vs benchmark after adjusting for market risk. Positive = fund beats benchmark." />
        <MetricCard label="Max Drawdown"
          val1y={props.maxDrawdown1y} val3y={props.maxDrawdown3y} format={fmtDD}
          tooltip="Largest peak-to-trough decline. Smaller magnitude = less downside risk." />
        <MetricCard label="Std Deviation"
          val1y={props.stdDev1y} val3y={props.stdDev3y} format={fmtPctFn}
          tooltip="Annualised standard deviation of daily returns. Measures total volatility." />
        {props.treynor1y !== null && props.treynor1y !== undefined && (
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-xs text-muted-foreground mb-2 font-medium" title="(Return – Rf) / Beta. Reward per unit of systematic risk.">
              Treynor Ratio
            </div>
            <div className="text-base font-semibold tabular-nums">{fmt2(props.treynor1y)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">1Y</div>
          </div>
        )}
      </div>

      {/* Risk interpretation guide */}
      <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-md p-3 border border-border">
        <span className="font-medium">Guide: </span>
        Sharpe &gt; 1.0 = good · Sortino &gt; 1.5 = good · Beta &lt; 0.85 = defensive · Alpha &gt; 0 = outperforms benchmark
      </div>
    </div>
  );
}
