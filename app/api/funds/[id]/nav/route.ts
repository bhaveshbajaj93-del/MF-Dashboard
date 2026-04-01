import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/index";
import { navHistory } from "@/lib/db/schema";
import { eq, and, gte, lte, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const fundId = parseInt(params.id);
    const { searchParams } = req.nextUrl;
    const from = searchParams.get("from") ?? "";
    const to   = searchParams.get("to") ?? "";
    const period = searchParams.get("period") ?? "all"; // 1m|3m|6m|1y|3y|5y|all

    // Compute from date based on period
    let fromDate = from;
    if (!fromDate && period !== "all") {
      const now = new Date();
      const map: Record<string, number> = {
        "1m": 30, "3m": 90, "6m": 180, "1y": 365, "3y": 1095, "5y": 1825, "10y": 3650
      };
      const days = map[period] ?? 0;
      if (days > 0) {
        const d = new Date(now.getTime() - days * 86400000);
        fromDate = d.toISOString().split("T")[0];
      }
    }

    const conditions = [eq(navHistory.fundId, fundId)];
    if (fromDate) conditions.push(gte(navHistory.date, fromDate));
    if (to) conditions.push(lte(navHistory.date, to));

    const rows = await db
      .select({ date: navHistory.date, nav: navHistory.nav })
      .from(navHistory)
      .where(and(...conditions))
      .orderBy(asc(navHistory.date));

    // For long periods, sample data to keep response size manageable
    const maxPoints = 500;
    let data = rows;
    if (rows.length > maxPoints) {
      const step = Math.ceil(rows.length / maxPoints);
      data = rows.filter((_, i) => i % step === 0 || i === rows.length - 1);
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
