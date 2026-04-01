import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/index";
import { managers, fundManagerHistory, funds, amcs, categories, fundMetrics } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const managerId = parseInt(params.id);

    const [manager] = await db
      .select()
      .from(managers)
      .where(eq(managers.id, managerId))
      .limit(1);

    if (!manager) return NextResponse.json({ error: "Manager not found" }, { status: 404 });

    // Full career history across all funds
    const career = await db
      .select({
        historyId:          fundManagerHistory.id,
        fundId:             fundManagerHistory.fundId,
        fundName:           funds.name,
        fundPlan:           funds.planType,
        fundOption:         funds.optionType,
        amcName:            amcs.name,
        catType:            categories.type,
        catSub:             categories.subCategory,
        startDate:          fundManagerHistory.startDate,
        endDate:            fundManagerHistory.endDate,
        tenureReturnCagr:   fundManagerHistory.tenureReturnCagr,
        tenureBenchmarkCagr:fundManagerHistory.tenureBenchmarkCagr,
        tenureAlpha:        fundManagerHistory.tenureAlpha,
        tenureSharpe:       fundManagerHistory.tenureSharpe,
        tenureMaxDrawdown:  fundManagerHistory.tenureMaxDrawdown,
        tenureCategoryRank: fundManagerHistory.tenureCategoryRank,
        // Current metrics of the fund (if still managing)
        currentAum:         fundMetrics.aumCrores,
        currentReturn1y:    fundMetrics.return1y,
        currentReturn3y:    fundMetrics.return3y,
      })
      .from(fundManagerHistory)
      .leftJoin(funds, eq(fundManagerHistory.fundId, funds.id))
      .leftJoin(amcs, eq(funds.amcId, amcs.id))
      .leftJoin(categories, eq(funds.categoryId, categories.id))
      .leftJoin(fundMetrics, eq(funds.id, fundMetrics.fundId))
      .where(eq(fundManagerHistory.managerId, managerId))
      .orderBy(desc(fundManagerHistory.startDate));

    // Compute aggregate stats
    const completedTenures = career.filter((c) => c.tenureReturnCagr !== null);
    const avgAlpha = completedTenures.length > 0
      ? completedTenures.reduce((s, c) => s + (c.tenureAlpha ?? 0), 0) / completedTenures.length
      : null;

    return NextResponse.json({
      data: {
        manager,
        career,
        stats: {
          totalTenures: career.length,
          currentFunds: career.filter((c) => !c.endDate).length,
          avgAlpha: avgAlpha !== null ? parseFloat(avgAlpha.toFixed(2)) : null,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
