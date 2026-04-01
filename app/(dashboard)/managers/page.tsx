"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn, fmtCrores, fmtNum, returnColor } from "@/lib/utils";
import { Users, ChevronUp, ChevronDown } from "lucide-react";

interface Manager {
  id: number;
  name: string;
  qualification: string | null;
  bio: string | null;
  photoUrl: string | null;
  totalFundsManaged: number | null;
  totalAumManaged: number | null;
  yearsExperience: number | null;
}

export default function ManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "aum", dir: "desc" as "asc" | "desc" });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ q: search, sort: sort.key, order: sort.dir, page: String(page), limit: "50" });
      const res = await fetch(`/api/managers?${p}`);
      const j = await res.json();
      setManagers(j.data ?? []);
      setTotal(j.meta?.total ?? 0);
      setPages(j.meta?.pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [search, sort, page]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (key: string) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
    setPage(1);
  };

  const SortIcon = ({ k }: { k: string }) =>
    sort.key === k ? (
      sort.dir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
    ) : null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5" /> Fund Managers</h1>
        <span className="text-xs text-muted-foreground">{total} managers</span>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search manager name..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-muted/50">
            <tr>
              {[
                { key: "name",  label: "Name" },
                { key: "funds", label: "Funds Managed" },
                { key: "aum",   label: "Total AUM" },
                { key: "years", label: "Experience" },
                { key: "",      label: "Current Funds" },
              ].map((col) => (
                <th key={col.key}
                  onClick={() => col.key && handleSort(col.key)}
                  className={cn("px-4 py-3 text-left text-xs font-semibold text-muted-foreground border-b border-border", col.key && "cursor-pointer hover:text-foreground")}
                >
                  <span className="flex items-center gap-1">{col.label}{col.key && <SortIcon k={col.key} />}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
            ) : managers.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">
                No managers found. Run <code className="text-xs bg-muted px-1 rounded">npm run seed:managers</code> to populate.
              </td></tr>
            ) : managers.map((m, i) => (
              <tr key={m.id}
                onClick={() => router.push(`/managers/${m.id}`)}
                className={cn("cursor-pointer border-b border-border/50 hover:bg-accent/50 transition-colors", i % 2 === 0 ? "" : "bg-muted/10")}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{m.name}</div>
                  {m.qualification && <div className="text-xs text-muted-foreground mt-0.5">{m.qualification}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{m.totalFundsManaged ?? "—"}</td>
                <td className="px-4 py-3">{fmtCrores(m.totalAumManaged)}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.yearsExperience ? `${m.yearsExperience}y` : "—"}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                    View
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-border hover:bg-accent disabled:opacity-40">Prev</button>
        <span>Page {page} of {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-border hover:bg-accent disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
