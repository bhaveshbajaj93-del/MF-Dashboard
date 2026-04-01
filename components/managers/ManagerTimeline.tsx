"use client";
import { cn, categoryColor, fmtNum } from "@/lib/utils";
import { differenceInMonths, parseISO, format } from "date-fns";

interface Tenure {
  historyId: number;
  fundId: number;
  fundName: string | null;
  catType: string | null;
  startDate: string;
  endDate: string | null;
  tenureReturnCagr: number | null;
  tenureBenchmarkCagr: number | null;
  tenureAlpha: number | null;
  tenureSharpe: number | null;
  tenureMaxDrawdown: number | null;
}

interface Props {
  career: Tenure[];
  managerName: string;
}

export function ManagerTimeline({ career, managerName }: Props) {
  if (career.length === 0) {
    return <div className="text-sm text-muted-foreground italic">No tenure history found.</div>;
  }

  // Find overall date range
  const allDates = career.flatMap((t) => [
    t.startDate,
    t.endDate ?? new Date().toISOString().split("T")[0],
  ]);
  const minDate = allDates.reduce((a, b) => (a < b ? a : b));
  const maxDate = allDates.reduce((a, b) => (a > b ? a : b));
  const totalMonths = differenceInMonths(parseISO(maxDate), parseISO(minDate)) + 1;

  function leftPct(dateStr: string) {
    const months = differenceInMonths(parseISO(dateStr), parseISO(minDate));
    return (months / totalMonths) * 100;
  }

  function widthPct(start: string, end: string) {
    const months = differenceInMonths(parseISO(end), parseISO(start)) + 1;
    return Math.max((months / totalMonths) * 100, 1);
  }

  // Unique funds for separate rows
  const uniqueFunds = Array.from(new Set(career.map((t) => t.fundId)));

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold">Career Timeline — {managerName}</h3>

      {/* Timeline chart */}
      <div className="space-y-2">
        {/* Year axis */}
        <div className="relative h-5 ml-40">
          {Array.from({ length: Math.ceil(totalMonths / 12) + 1 }).map((_, i) => {
            const d = new Date(parseISO(minDate));
            d.setFullYear(d.getFullYear() + i);
            const left = (i * 12 / totalMonths) * 100;
            if (left > 100) return null;
            return (
              <div key={i} className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                style={{ left: `${left}%` }}>
                {d.getFullYear()}
              </div>
            );
          })}
        </div>

        {/* Fund rows */}
        {uniqueFunds.map((fundId) => {
          const tenures = career.filter((t) => t.fundId === fundId);
          const fundName = tenures[0]?.fundName ?? "Unknown Fund";
          return (
            <div key={fundId} className="flex items-center gap-2">
              <div className="w-40 flex-shrink-0 text-xs text-muted-foreground truncate text-right pr-2" title={fundName}>
                {fundName}
              </div>
              <div className="flex-1 relative h-8 bg-muted/30 rounded-md overflow-hidden">
                {tenures.map((t) => {
                  const end = t.endDate ?? new Date().toISOString().split("T")[0];
                  const left = leftPct(t.startDate);
                  const width = widthPct(t.startDate, end);
                  const isCurrent = !t.endDate;
                  const catType = t.catType ?? "other";
                  const months = differenceInMonths(parseISO(end), parseISO(t.startDate));
                  const years = (months / 12).toFixed(1);

                  return (
                    <div
                      key={t.historyId}
                      className={cn(
                        "absolute top-1 bottom-1 rounded flex items-center justify-center text-[9px] font-medium overflow-hidden cursor-default",
                        catType === "equity" ? "bg-blue-500/70 hover:bg-blue-500/90" :
                        catType === "debt" ? "bg-yellow-500/70 hover:bg-yellow-500/90" :
                        catType === "hybrid" ? "bg-purple-500/70 hover:bg-purple-500/90" :
                        "bg-gray-500/70 hover:bg-gray-500/90",
                        isCurrent && "ring-2 ring-green-400"
                      )}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${t.startDate} → ${t.endDate ?? "present"}\nCAGR: ${t.tenureReturnCagr?.toFixed(1) ?? "?"} % | Alpha: ${t.tenureAlpha?.toFixed(1) ?? "?"}%`}
                    >
                      {width > 8 ? `${years}y` : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tenure stats table */}
      <div>
        <h4 className="text-sm font-medium mb-2">Per-Tenure Performance</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Fund</th>
                <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Period</th>
                <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Duration</th>
                <th className="text-right py-2 pr-3 text-muted-foreground font-medium">CAGR</th>
                <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Bench</th>
                <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Alpha</th>
                <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Sharpe</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Max DD</th>
              </tr>
            </thead>
            <tbody>
              {career.map((t) => {
                const end = t.endDate ?? new Date().toISOString().split("T")[0];
                const months = differenceInMonths(parseISO(end), parseISO(t.startDate));
                const years = (months / 12).toFixed(1);
                const isCurrent = !t.endDate;
                return (
                  <tr key={t.historyId} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-2 pr-3 max-w-[180px]">
                      <div className="truncate font-medium">{t.fundName}</div>
                      <div className={cn("text-[10px] inline-block px-1.5 py-0.5 rounded border mt-0.5", categoryColor(t.catType ?? "other"))}>
                        {t.catType?.toUpperCase()}
                      </div>
                      {isCurrent && <span className="ml-1 text-[10px] text-green-400 font-medium">● CURRENT</span>}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                      {format(parseISO(t.startDate), "MMM yy")} → {isCurrent ? "now" : format(parseISO(end), "MMM yy")}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{years}y</td>
                    <td className={cn("py-2 pr-3 text-right tabular-nums font-medium", t.tenureReturnCagr !== null && t.tenureReturnCagr !== undefined ? t.tenureReturnCagr > 0 ? "text-green-500" : "text-red-500" : "")}>
                      {t.tenureReturnCagr !== null && t.tenureReturnCagr !== undefined ? `${t.tenureReturnCagr > 0 ? "+" : ""}${t.tenureReturnCagr.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                      {t.tenureBenchmarkCagr !== null && t.tenureBenchmarkCagr !== undefined ? `${t.tenureBenchmarkCagr.toFixed(1)}%` : "—"}
                    </td>
                    <td className={cn("py-2 pr-3 text-right tabular-nums font-medium", t.tenureAlpha !== null && t.tenureAlpha !== undefined ? t.tenureAlpha > 0 ? "text-green-500" : "text-red-500" : "")}>
                      {t.tenureAlpha !== null && t.tenureAlpha !== undefined ? `${t.tenureAlpha > 0 ? "+" : ""}${t.tenureAlpha.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {t.tenureSharpe !== null && t.tenureSharpe !== undefined ? t.tenureSharpe.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-red-400">
                      {t.tenureMaxDrawdown !== null && t.tenureMaxDrawdown !== undefined ? `-${t.tenureMaxDrawdown.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
