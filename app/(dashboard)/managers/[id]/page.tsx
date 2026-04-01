"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ManagerTimeline } from "@/components/managers/ManagerTimeline";
import { cn, fmtCrores, returnColor } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export default function ManagerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const managerId = Number(params.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/managers/${managerId}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .finally(() => setLoading(false));
  }, [managerId]);

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>;
  if (!data) return <div className="flex items-center justify-center h-full text-muted-foreground">Manager not found.</div>;

  const { manager, career, stats } = data;
  const currentFunds = career.filter((c: any) => !c.endDate);
  const pastFunds = career.filter((c: any) => c.endDate);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3 h-3" /> Back
      </button>

      {/* Manager header */}
      <div className="flex items-start gap-4">
        {manager.photoUrl && (
          <img src={manager.photoUrl} alt={manager.name} className="w-14 h-14 rounded-full border border-border object-cover" />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{manager.name}</h1>
          {manager.qualification && <p className="text-sm text-muted-foreground mt-0.5">{manager.qualification}</p>}
          {manager.bio && <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">{manager.bio}</p>}
        </div>
        <div className="grid grid-cols-3 gap-4 text-center flex-shrink-0">
          <StatBox label="Total Tenures" value={String(stats.totalTenures)} />
          <StatBox label="Current Funds" value={String(stats.currentFunds)} />
          <StatBox label="Avg Alpha" value={stats.avgAlpha !== null ? `${stats.avgAlpha > 0 ? "+" : ""}${stats.avgAlpha}%` : "—"} color={returnColor(stats.avgAlpha)} />
        </div>
      </div>

      {/* Current funds */}
      {currentFunds.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-green-400">Currently Managing</h3>
          <div className="grid grid-cols-2 gap-2">
            {currentFunds.map((c: any) => (
              <div key={c.historyId} className="border border-green-500/30 bg-green-500/5 rounded-lg p-3 text-sm">
                <div className="font-medium truncate">{c.fundName}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{c.amcName}</span>
                  <span>·</span>
                  <span>Since {c.startDate}</span>
                </div>
                {c.currentReturn1y && (
                  <div className={cn("text-xs font-medium mt-1", returnColor(c.currentReturn1y))}>
                    1Y: {c.currentReturn1y > 0 ? "+" : ""}{c.currentReturn1y.toFixed(1)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Career timeline */}
      <ManagerTimeline career={career} managerName={manager.name} />
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}
