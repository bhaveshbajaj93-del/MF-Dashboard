"use client";
import { useState, useEffect, useCallback } from "react";
import { FundTable, type FundRow } from "@/components/funds/FundTable";
import { FundFilters, type FilterState } from "@/components/funds/FundFilters";
import { TrendingUp } from "lucide-react";

const DEFAULT_FILTERS: FilterState = {
  q: "", type: "", plan: "direct", option: "growth",
  minAum: "", maxTer: "", minReturn1y: "", minSharpe: "", minRating: "",
};

export default function FundsPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState({ key: "return_1y", dir: "desc" as "asc" | "desc" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FundRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        sort: sort.key,
        order: sort.dir,
        q: filters.q,
        type: filters.type,
        plan: filters.plan,
        option: filters.option,
        min_aum: filters.minAum,
        max_ter: filters.maxTer,
        min_return_1y: filters.minReturn1y,
        min_sharpe: filters.minSharpe,
        min_rating: filters.minRating,
      });
      const res = await fetch(`/api/funds?${params}`);
      const json = await res.json();
      setData(json.data ?? []);
      setMeta(json.meta ?? { total: 0, pages: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, sort, filters]);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  const handleSort = (key: string) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
    setPage(1);
  };

  const handleFilter = (f: FilterState) => {
    setFilters(f);
    setPage(1);
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Mutual Funds
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {meta.total.toLocaleString()} funds · sorted by {sort.key.replace(/_/g, " ")} {sort.dir}
          </p>
        </div>
      </div>

      {/* Filters */}
      <FundFilters filters={filters} onChange={handleFilter} />

      {/* Table */}
      <div className="flex-1 min-h-0">
        <FundTable
          data={data}
          total={meta.total}
          page={page}
          pages={meta.pages}
          sort={sort}
          onSort={handleSort}
          onPage={setPage}
          loading={loading}
        />
      </div>
    </div>
  );
}
