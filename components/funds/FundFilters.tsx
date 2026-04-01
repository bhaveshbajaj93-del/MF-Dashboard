"use client";
import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterState {
  q: string;
  type: string;
  plan: string;
  option: string;
  minAum: string;
  maxTer: string;
  minReturn1y: string;
  minSharpe: string;
  minRating: string;
}

const CAT_TYPES = [
  { value: "", label: "All" },
  { value: "equity", label: "Equity" },
  { value: "debt", label: "Debt" },
  { value: "hybrid", label: "Hybrid" },
  { value: "liquid", label: "Liquid" },
  { value: "index", label: "Index/ETF" },
  { value: "fof", label: "FoF" },
];

const PLAN_TYPES = [
  { value: "", label: "All Plans" },
  { value: "direct", label: "Direct" },
  { value: "regular", label: "Regular" },
];

const OPTION_TYPES = [
  { value: "growth", label: "Growth" },
  { value: "idcw", label: "IDCW" },
  { value: "", label: "All" },
];

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

export function FundFilters({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const set = (key: keyof FilterState, val: string) =>
    onChange({ ...filters, [key]: val });

  const hasAdvanced = filters.minAum || filters.maxTer || filters.minReturn1y || filters.minSharpe || filters.minRating;

  return (
    <div className="space-y-3">
      {/* Top row: search + quick filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search funds..."
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {filters.q && (
            <button onClick={() => set("q", "")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Category type */}
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {CAT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => set("type", t.value)}
              className={cn(
                "px-3 py-1.5 transition-colors",
                filters.type === t.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Plan type */}
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {PLAN_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => set("plan", t.value)}
              className={cn(
                "px-3 py-1.5 transition-colors",
                filters.plan === t.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Option type */}
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {OPTION_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => set("option", t.value)}
              className={cn(
                "px-3 py-1.5 transition-colors",
                filters.option === t.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Advanced filter toggle */}
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors",
            open || hasAdvanced
              ? "border-primary text-primary bg-primary/10"
              : "border-border text-muted-foreground hover:bg-accent"
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters {hasAdvanced ? "●" : ""}
        </button>
      </div>

      {/* Advanced filters panel */}
      {open && (
        <div className="flex flex-wrap gap-4 p-3 rounded-lg border border-border bg-muted/30 text-xs">
          <Field label="Min AUM (Cr)">
            <input type="number" placeholder="e.g. 500" value={filters.minAum}
              onChange={(e) => set("minAum", e.target.value)}
              className="w-28 px-2 py-1 border border-border rounded bg-background text-xs" />
          </Field>
          <Field label="Max TER (%)">
            <input type="number" step="0.1" placeholder="e.g. 1.5" value={filters.maxTer}
              onChange={(e) => set("maxTer", e.target.value)}
              className="w-24 px-2 py-1 border border-border rounded bg-background text-xs" />
          </Field>
          <Field label="Min 1Y Return (%)">
            <input type="number" placeholder="e.g. 10" value={filters.minReturn1y}
              onChange={(e) => set("minReturn1y", e.target.value)}
              className="w-28 px-2 py-1 border border-border rounded bg-background text-xs" />
          </Field>
          <Field label="Min Sharpe (3Y)">
            <input type="number" step="0.1" placeholder="e.g. 0.5" value={filters.minSharpe}
              onChange={(e) => set("minSharpe", e.target.value)}
              className="w-24 px-2 py-1 border border-border rounded bg-background text-xs" />
          </Field>
          <Field label="Min Star Rating">
            <select value={filters.minRating} onChange={(e) => set("minRating", e.target.value)}
              className="px-2 py-1 border border-border rounded bg-background text-xs">
              <option value="">Any</option>
              {[3,4,5].map((n) => <option key={n} value={n}>{n}★+</option>)}
            </select>
          </Field>
          <button
            onClick={() => onChange({ q: filters.q, type: filters.type, plan: filters.plan, option: filters.option, minAum: "", maxTer: "", minReturn1y: "", minSharpe: "", minRating: "" })}
            className="self-end px-3 py-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
