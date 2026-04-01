"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn, fmtReturn, fmtCrores, fmtPct, fmtNum, returnColor, categoryColor } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown, Star } from "lucide-react";

export interface FundRow {
  id: number;
  name: string;
  amcName: string | null;
  catType: string | null;
  catSub: string | null;
  planType: string | null;
  aumCrores: number | null;
  expenseRatio: number | null;
  starRating: number | null;
  return1m: number | null;
  return3m: number | null;
  return6m: number | null;
  return1y: number | null;
  return3y: number | null;
  return5y: number | null;
  return10y: number | null;
  sharpe3y: number | null;
  sortino3y: number | null;
  beta3y: number | null;
  alpha3y: number | null;
  maxDrawdown3y: number | null;
  stdDev3y: number | null;
  wtdForwardPe: number | null;
  wtdEpsGrowth1y: number | null;
  categoryRank: number | null;
}

interface ColDef {
  key: string;
  label: string;
  group?: string;
  render: (r: FundRow) => React.ReactNode;
  width?: string;
}

const COLUMNS: ColDef[] = [
  { key: "name",         label: "Fund",          width: "min-w-[260px]", render: (r) => (
    <div>
      <div className="font-medium text-sm leading-tight text-foreground">{r.name}</div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", categoryColor(r.catType ?? "other"))}>
          {r.catType?.toUpperCase()}
        </span>
        {r.planType === "direct" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-green-500/10 text-green-400 border-green-500/20 font-medium">DIRECT</span>
        )}
      </div>
    </div>
  )},
  { key: "aum",           label: "AUM",           render: (r) => <span className="text-muted-foreground text-xs">{fmtCrores(r.aumCrores)}</span> },
  { key: "expense_ratio", label: "TER%",          render: (r) => <span className="text-xs">{fmtPct(r.expenseRatio)}</span> },
  { key: "star_rating",   label: "★",             render: (r) => <StarRating rating={r.starRating} /> },
  { key: "return_1m",  label: "1M",  group: "Returns", render: (r) => <ReturnCell v={r.return1m} /> },
  { key: "return_3m",  label: "3M",  group: "Returns", render: (r) => <ReturnCell v={r.return3m} /> },
  { key: "return_6m",  label: "6M",  group: "Returns", render: (r) => <ReturnCell v={r.return6m} /> },
  { key: "return_1y",  label: "1Y",  group: "Returns", render: (r) => <ReturnCell v={r.return1y} /> },
  { key: "return_3y",  label: "3Y",  group: "Returns", render: (r) => <ReturnCell v={r.return3y} /> },
  { key: "return_5y",  label: "5Y",  group: "Returns", render: (r) => <ReturnCell v={r.return5y} /> },
  { key: "sharpe_3y",     label: "Sharpe",        group: "Risk", render: (r) => <span className="text-xs">{fmtNum(r.sharpe3y, 2)}</span> },
  { key: "sortino_3y",    label: "Sortino",       group: "Risk", render: (r) => <span className="text-xs">{fmtNum(r.sortino3y, 2)}</span> },
  { key: "beta_3y",       label: "Beta",          group: "Risk", render: (r) => <span className="text-xs">{fmtNum(r.beta3y, 2)}</span> },
  { key: "alpha_3y",      label: "Alpha",         group: "Risk", render: (r) => <ReturnCell v={r.alpha3y} /> },
  { key: "max_drawdown_3y", label: "Max DD",      group: "Risk", render: (r) => <span className={cn("text-xs", r.maxDrawdown3y ? "text-red-500" : "")}>{r.maxDrawdown3y ? `-${fmtNum(r.maxDrawdown3y)}%` : "—"}</span> },
  { key: "std_dev_3y",    label: "StdDev",        group: "Risk", render: (r) => <span className="text-xs">{fmtPct(r.stdDev3y)}</span> },
  { key: "fwd_pe",        label: "Fwd PE",        group: "Intelligence", render: (r) => <span className="text-xs">{fmtNum(r.wtdForwardPe, 1)}</span> },
  { key: "eps_growth_1y", label: "EPS Gr%",       group: "Intelligence", render: (r) => <ReturnCell v={r.wtdEpsGrowth1y} /> },
];

function ReturnCell({ v }: { v: number | null | undefined }) {
  return (
    <span className={cn("text-xs font-medium tabular-nums", returnColor(v))}>
      {v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
    </span>
  );
}

function StarRating({ rating }: { rating: number | null | undefined }) {
  if (!rating) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} className={cn("w-3 h-3", i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
      ))}
    </div>
  );
}

interface SortState { key: string; dir: "asc" | "desc" }

interface FundTableProps {
  data: FundRow[];
  total: number;
  page: number;
  pages: number;
  sort: SortState;
  onSort: (key: string) => void;
  onPage: (p: number) => void;
  loading?: boolean;
}

export function FundTable({ data, total, page, pages, sort, onSort, onPage, loading }: FundTableProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full">
      {/* Table */}
      <div className="overflow-auto flex-1 border border-border rounded-lg">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  className={cn(
                    "px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors border-b border-border",
                    col.width
                  )}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sort.key === col.key ? (
                      sort.dir === "asc"
                        ? <ChevronUp className="w-3 h-3 text-primary" />
                        : <ChevronDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-12 text-muted-foreground">
                  Loading funds...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-12 text-muted-foreground">
                  No funds found. Try adjusting your filters.
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/funds/${row.id}`)}
                  className={cn(
                    "cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/50",
                    i % 2 === 0 ? "bg-background" : "bg-muted/20"
                  )}
                >
                  {COLUMNS.map((col) => (
                    <td key={col.key} className={cn("px-3 py-2.5 whitespace-nowrap", col.width)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 py-3 text-xs text-muted-foreground">
        <span>{total.toLocaleString()} funds</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="px-3 py-1 rounded border border-border hover:bg-accent disabled:opacity-40"
          >
            Prev
          </button>
          <span>Page {page} of {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
            className="px-3 py-1 rounded border border-border hover:bg-accent disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
