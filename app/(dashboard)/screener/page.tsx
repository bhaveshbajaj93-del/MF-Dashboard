"use client";
import { useState } from "react";
import { cn, fmtReturn, fmtCrores, returnColor } from "@/lib/utils";
import { Search, Download } from "lucide-react";
import { useRouter } from "next/navigation";

interface ScreenCriteria {
  type: string;
  minReturn1y: string;
  maxReturn1y: string;
  minReturn3y: string;
  minSharpe3y: string;
  maxBeta3y: string;
  minAlpha3y: string;
  maxStdDev3y: string;
  minAum: string;
  maxTer: string;
  minRating: string;
  plan: string;
  option: string;
}

const DEFAULT: ScreenCriteria = {
  type: "equity", minReturn1y: "", maxReturn1y: "", minReturn3y: "",
  minSharpe3y: "", maxBeta3y: "", minAlpha3y: "", maxStdDev3y: "",
  minAum: "", maxTer: "", minRating: "", plan: "direct", option: "growth",
};

const PRESETS = [
  { name: "Top Large Cap", criteria: { ...DEFAULT, type: "equity", minReturn3y: "12", minSharpe3y: "0.8", minAum: "1000" } },
  { name: "Low-Cost Index", criteria: { ...DEFAULT, type: "index", maxTer: "0.3", minAum: "500" } },
  { name: "High Alpha Equity", criteria: { ...DEFAULT, type: "equity", minAlpha3y: "2", minSharpe3y: "1" } },
  { name: "Defensive Debt", criteria: { ...DEFAULT, type: "debt", maxStdDev3y: "3", plan: "", option: "" } },
];

export default function ScreenerPage() {
  const [criteria, setCriteria] = useState<ScreenCriteria>(DEFAULT);
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const router = useRouter();

  const set = (k: keyof ScreenCriteria, v: string) => setCriteria((c) => ({ ...c, [k]: v }));

  const run = async () => {
    setLoading(true);
    setRan(true);
    try {
      const p = new URLSearchParams({
        type: criteria.type,
        plan: criteria.plan,
        option: criteria.option,
        min_return_1y: criteria.minReturn1y,
        min_sharpe: criteria.minSharpe3y,
        min_aum: criteria.minAum,
        max_ter: criteria.maxTer,
        min_rating: criteria.minRating,
        sort: "return_3y",
        order: "desc",
        limit: "100",
      });
      const res = await fetch(`/api/funds?${p}`);
      const j = await res.json();
      // Client-side additional filters
      let data = j.data ?? [];
      if (criteria.minReturn3y) data = data.filter((f: any) => (f.return3y ?? -999) >= parseFloat(criteria.minReturn3y));
      if (criteria.minAlpha3y) data = data.filter((f: any) => (f.alpha3y ?? -999) >= parseFloat(criteria.minAlpha3y));
      if (criteria.maxBeta3y) data = data.filter((f: any) => (f.beta3y ?? 999) <= parseFloat(criteria.maxBeta3y));
      if (criteria.maxStdDev3y) data = data.filter((f: any) => (f.stdDev3y ?? 999) <= parseFloat(criteria.maxStdDev3y));
      setResults(data);
      setTotal(data.length);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (results.length === 0) return;
    const headers = ["Name", "AMC", "Category", "AUM (Cr)", "TER%", "1Y%", "3Y%", "5Y%", "Sharpe 3Y", "Alpha 3Y", "Beta 3Y"];
    const rows = results.map((f: any) => [
      f.name, f.amcName, f.catSub, f.aumCrores?.toFixed(0) ?? "",
      f.expenseRatio ?? "", f.return1y?.toFixed(2) ?? "", f.return3y?.toFixed(2) ?? "",
      f.return5y?.toFixed(2) ?? "", f.sharpe3y?.toFixed(2) ?? "",
      f.alpha3y?.toFixed(2) ?? "", f.beta3y?.toFixed(2) ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mf-screen.csv";
    a.click();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Search className="w-5 h-5" /> Fund Screener</h1>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Presets:</span>
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => setCriteria(p.criteria as ScreenCriteria)}
            className="text-xs px-3 py-1 rounded-full border border-border hover:bg-accent transition-colors">
            {p.name}
          </button>
        ))}
      </div>

      {/* Criteria grid */}
      <div className="bg-muted/20 border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
        <Field label="Category">
          <select value={criteria.type} onChange={(e) => set("type", e.target.value)} className="input">
            {[["", "All"], ["equity", "Equity"], ["debt", "Debt"], ["hybrid", "Hybrid"],
              ["liquid", "Liquid"], ["index", "Index/ETF"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Plan">
          <select value={criteria.plan} onChange={(e) => set("plan", e.target.value)} className="input">
            {[["direct", "Direct"], ["regular", "Regular"], ["", "All"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Option">
          <select value={criteria.option} onChange={(e) => set("option", e.target.value)} className="input">
            {[["growth", "Growth"], ["idcw", "IDCW"], ["", "All"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Min 1Y Return (%)">
          <input type="number" value={criteria.minReturn1y} onChange={(e) => set("minReturn1y", e.target.value)} placeholder="e.g. 10" className="input" />
        </Field>
        <Field label="Min 3Y Return (%)">
          <input type="number" value={criteria.minReturn3y} onChange={(e) => set("minReturn3y", e.target.value)} placeholder="e.g. 12" className="input" />
        </Field>
        <Field label="Min Sharpe (3Y)">
          <input type="number" step="0.1" value={criteria.minSharpe3y} onChange={(e) => set("minSharpe3y", e.target.value)} placeholder="e.g. 0.8" className="input" />
        </Field>
        <Field label="Max Beta (3Y)">
          <input type="number" step="0.1" value={criteria.maxBeta3y} onChange={(e) => set("maxBeta3y", e.target.value)} placeholder="e.g. 0.9" className="input" />
        </Field>
        <Field label="Min Alpha (3Y %)">
          <input type="number" step="0.5" value={criteria.minAlpha3y} onChange={(e) => set("minAlpha3y", e.target.value)} placeholder="e.g. 2" className="input" />
        </Field>
        <Field label="Max Std Dev (3Y %)">
          <input type="number" value={criteria.maxStdDev3y} onChange={(e) => set("maxStdDev3y", e.target.value)} placeholder="e.g. 15" className="input" />
        </Field>
        <Field label="Min AUM (Cr)">
          <input type="number" value={criteria.minAum} onChange={(e) => set("minAum", e.target.value)} placeholder="e.g. 500" className="input" />
        </Field>
        <Field label="Max TER (%)">
          <input type="number" step="0.1" value={criteria.maxTer} onChange={(e) => set("maxTer", e.target.value)} placeholder="e.g. 1.0" className="input" />
        </Field>
        <Field label="Min Rating">
          <select value={criteria.minRating} onChange={(e) => set("minRating", e.target.value)} className="input">
            <option value="">Any</option>
            {[3,4,5].map((n) => <option key={n} value={n}>{n}★+</option>)}
          </select>
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={run} disabled={loading}
          className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {loading ? "Running..." : "Run Screen"}
        </button>
        {results.length > 0 && (
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
        {ran && <span className="text-xs text-muted-foreground">{total} funds match</span>}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-muted/50">
              <tr>
                {["Fund", "AMC", "AUM", "TER", "1Y", "3Y", "5Y", "Sharpe 3Y", "Alpha 3Y", "Beta 3Y"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-muted-foreground font-medium border-b border-border whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((f: any, i: number) => (
                <tr key={f.id} onClick={() => router.push(`/funds/${f.id}`)}
                  className={cn("cursor-pointer border-b border-border/40 hover:bg-accent/50", i % 2 === 0 ? "" : "bg-muted/10")}>
                  <td className="px-3 py-2.5 font-medium max-w-[220px]">
                    <div className="truncate">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground">{f.catSub}</div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{f.amcName}</td>
                  <td className="px-3 py-2.5 tabular-nums">{fmtCrores(f.aumCrores)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{f.expenseRatio?.toFixed(2) ?? "—"}%</td>
                  <td className={cn("px-3 py-2.5 tabular-nums font-medium", returnColor(f.return1y))}>{fmtReturn(f.return1y)}</td>
                  <td className={cn("px-3 py-2.5 tabular-nums font-medium", returnColor(f.return3y))}>{fmtReturn(f.return3y)}</td>
                  <td className={cn("px-3 py-2.5 tabular-nums font-medium", returnColor(f.return5y))}>{fmtReturn(f.return5y)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{f.sharpe3y?.toFixed(2) ?? "—"}</td>
                  <td className={cn("px-3 py-2.5 tabular-nums font-medium", returnColor(f.alpha3y))}>{f.alpha3y !== null ? `${f.alpha3y > 0 ? "+" : ""}${f.alpha3y.toFixed(2)}%` : "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums">{f.beta3y?.toFixed(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ran && results.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
          No funds match your criteria. Try relaxing the filters.
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
