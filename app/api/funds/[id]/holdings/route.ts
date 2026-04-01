import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/index";
import {
  fundHoldings, fundSectorAllocation, fundAssetAllocation,
  benchmarkSectorAllocation, funds,
} from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const fundId = parseInt(params.id);
    const { searchParams } = req.nextUrl;
    const month = searchParams.get("month") ?? "";

    // Get latest month if not specified
    const [latestMonth] = await db
      .select({ month: fundHoldings.month })
      .from(fundHoldings)
      .where(eq(fundHoldings.fundId, fundId))
      .orderBy(desc(fundHoldings.month))
      .limit(1);

    const targetMonth = month || latestMonth?.month;
    if (!targetMonth) return NextResponse.json({ data: { holdings: [], sectors: [], assetAllocation: null, portfolioChanges: { newEntries: [], exits: [], added: [], trimmed: [] }, benchmarkSectors: [] } });

    // Current holdings
    const holdings = await db
      .select()
      .from(fundHoldings)
      .where(and(eq(fundHoldings.fundId, fundId), eq(fundHoldings.month, targetMonth)))
      .orderBy(desc(fundHoldings.percentage));

    // Sector allocation
    const sectors = await db
      .select()
      .from(fundSectorAllocation)
      .where(and(eq(fundSectorAllocation.fundId, fundId), eq(fundSectorAllocation.month, targetMonth)));

    // Asset allocation
    const [assetAlloc] = await db
      .select()
      .from(fundAssetAllocation)
      .where(and(eq(fundAssetAllocation.fundId, fundId), eq(fundAssetAllocation.month, targetMonth)))
      .limit(1);

    // Portfolio changes: filter from holdings table
    const newEntries = holdings.filter((h) => h.isNewEntry);
    const exits = await db
      .select()
      .from(fundHoldings)
      .where(and(eq(fundHoldings.fundId, fundId), eq(fundHoldings.isFullExit, true)))
      .orderBy(desc(fundHoldings.month))
      .limit(30);
    const added = holdings.filter((h) => !h.isNewEntry && (h.pctChange ?? 0) >= 1);
    const trimmed = holdings.filter((h) => !h.isFullExit && (h.pctChange ?? 0) <= -1);

    // Benchmark sector allocation
    const [fundRow] = await db.select({ benchmarkIndex: funds.benchmarkIndex }).from(funds).where(eq(funds.id, fundId)).limit(1);
    const benchName = fundRow?.benchmarkIndex ?? "Nifty 50";
    const benchmarkSectors = await db
      .select()
      .from(benchmarkSectorAllocation)
      .where(
        and(
          eq(benchmarkSectorAllocation.benchmarkName, benchName),
          eq(benchmarkSectorAllocation.month, sql`(SELECT MAX(month) FROM benchmark_sector_allocation WHERE benchmark_name = ${benchName})`)
        )
      );

    return NextResponse.json({
      data: {
        month: targetMonth,
        holdings,
        sectors,
        assetAllocation: assetAlloc ?? null,
        portfolioChanges: { newEntries, exits: exits.slice(0, 10), added, trimmed },
        benchmarkSectors,
        benchmarkName: benchName,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
