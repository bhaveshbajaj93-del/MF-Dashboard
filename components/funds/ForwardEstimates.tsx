"use client";
import { cn, fmtNum, returnColor } from "@/lib/utils";

interface Props {
  wtdForwardPe?: number | null;
  wtdForwardPb?: number | null;
  wtdEpsGrowth1y?: number | null;
  wtdEpsGrowth3y?: number | null;
  wtdRevGrowth1y?: number | null;
  wtdRevGrowth3y?: number | null;
  dataCoverage?: number | null;
  screenerFormulas?: string | null; // JSON string
}

export function ForwardEstimates({
  wtdForwardPe, wtdForwardPb, wtdEpsGrowth1y, wtdEpsGrowth3y,
  wtdRevGrowth1y, wtdRevGrowth3y, dataCoverage, screenerFormulas,
}: Props) {
  const hasData = wtdForwardPe !== null && wtdForwardPe !== undefined;
  const formulas: Record<string, number | null> = screenerFormulas ? JSON.parse(screenerFormulas) : {};
  const formulaKeys = Object.keys(formulas);

  if (!hasData && formulaKeys.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic p-4 border border-border rounded-lg bg-muted/20">
        Forward estimates not yet loaded. Run <code>npm run seed:forward</code> to populate.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Broker Forward Estimates */}
      {hasData && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Broker Consensus (Weighted Avg)</h4>
            {dataCoverage !== null && dataCoverage !== undefined && (
              <span className="text-[11px] text-muted-foreground">
                {dataCoverage.toFixed(0)}% portfolio covered
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <EstCard label="Forward P/E" value={fmtNum(wtdForwardPe, 1)}
              note="Based on next 12-month EPS estimates" />
            <EstCard label="Forward P/B" value={fmtNum(wtdForwardPb, 1)}
              note="Price-to-book on forward basis" />
            <EstCard label="EPS Growth (1Y)" value={wtdEpsGrowth1y !== null && wtdEpsGrowth1y !== undefined ? `${wtdEpsGrowth1y > 0 ? "+" : ""}${wtdEpsGrowth1y.toFixed(1)}%` : "—"}
              color={returnColor(wtdEpsGrowth1y)}
              note="Consensus EPS growth estimate" />
            <EstCard label="EPS Growth (3Y)" value={wtdEpsGrowth3y !== null && wtdEpsGrowth3y !== undefined ? `${wtdEpsGrowth3y > 0 ? "+" : ""}${wtdEpsGrowth3y.toFixed(1)}%` : "—"}
              color={returnColor(wtdEpsGrowth3y)}
              note="3-year EPS CAGR estimate" />
            <EstCard label="Revenue Growth (1Y)" value={wtdRevGrowth1y !== null && wtdRevGrowth1y !== undefined ? `${wtdRevGrowth1y > 0 ? "+" : ""}${wtdRevGrowth1y.toFixed(1)}%` : "—"}
              color={returnColor(wtdRevGrowth1y)}
              note="Consensus revenue growth" />
            <EstCard label="Revenue Growth (3Y)" value={wtdRevGrowth3y !== null && wtdRevGrowth3y !== undefined ? `${wtdRevGrowth3y > 0 ? "+" : ""}${wtdRevGrowth3y.toFixed(1)}%` : "—"}
              color={returnColor(wtdRevGrowth3y)}
              note="3-year revenue CAGR estimate" />
          </div>
        </div>
      )}

      {/* Screener.in Custom Formulas */}
      {formulaKeys.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Screener.in Custom Formulas</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {formulaKeys.map((key) => (
              <EstCard key={key} label={key}
                value={formulas[key] !== null ? fmtNum(formulas[key], 2) : "—"}
                note="Weighted avg across portfolio holdings" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EstCard({ label, value, note, color }: {
  label: string; value: string; note?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", color ?? "text-foreground")}>{value}</div>
      {note && <div className="text-[10px] text-muted-foreground mt-1">{note}</div>}
    </div>
  );
}
