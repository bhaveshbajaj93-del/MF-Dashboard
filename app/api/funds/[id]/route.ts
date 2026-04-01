import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/index";
import {
  funds, fundMetrics, amcs, categories,
  fundPortfolioIntelligence, fundAssetAllocation,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const fundId = parseInt(params.id);
    if (isNaN(fundId)) return NextResponse.json({ error: "Invalid fund id" }, { status: 400 });

    const [fund] = await db
      .select({
        id:            funds.id,
        schemeCode:    funds.schemeCode,
        isin:          funds.isin,
        isinGrowth:    funds.isinGrowth,
        name:          funds.name,
        planType:      funds.planType,
        optionType:    funds.optionType,
        benchmarkIndex:funds.benchmarkIndex,
        launchDate:    funds.launchDate,
        minSip:        funds.minSip,
        minLumpsum:    funds.minLumpsum,
        exitLoad:      funds.exitLoad,
        fundObjective: funds.fundObjective,
        vroUrl:        funds.vroUrl,
        moneycontrolUrl:funds.moneycontrolUrl,
        amcName:       amcs.name,
        amcLogo:       amcs.logoUrl,
        amcWebsite:    amcs.website,
        catType:       categories.type,
        catSub:        categories.subCategory,
        sebiCategory:  categories.sebiCategory,
        aumCrores:     fundMetrics.aumCrores,
        expenseRatio:  fundMetrics.expenseRatio,
        starRating:    fundMetrics.starRating,
        return1d:      fundMetrics.return1d,
        return1w:      fundMetrics.return1w,
        return1m:      fundMetrics.return1m,
        return3m:      fundMetrics.return3m,
        return6m:      fundMetrics.return6m,
        return1y:      fundMetrics.return1y,
        return3y:      fundMetrics.return3y,
        return5y:      fundMetrics.return5y,
        return10y:     fundMetrics.return10y,
        stdDev1y:      fundMetrics.stdDev1y,
        stdDev3y:      fundMetrics.stdDev3y,
        sharpe1y:      fundMetrics.sharpe1y,
        sharpe3y:      fundMetrics.sharpe3y,
        sortino1y:     fundMetrics.sortino1y,
        sortino3y:     fundMetrics.sortino3y,
        beta1y:        fundMetrics.beta1y,
        beta3y:        fundMetrics.beta3y,
        alpha1y:       fundMetrics.alpha1y,
        alpha3y:       fundMetrics.alpha3y,
        treynor1y:     fundMetrics.treynor1y,
        maxDrawdown1y: fundMetrics.maxDrawdown1y,
        maxDrawdown3y: fundMetrics.maxDrawdown3y,
        categoryRank:  fundMetrics.categoryRank,
        // Portfolio intelligence
        wtdForwardPe:  fundPortfolioIntelligence.wtdForwardPe,
        wtdForwardPb:  fundPortfolioIntelligence.wtdForwardPb,
        wtdEpsGrowth1y:fundPortfolioIntelligence.wtdEpsGrowth1y,
        wtdEpsGrowth3y:fundPortfolioIntelligence.wtdEpsGrowth3y,
        wtdRevGrowth1y:fundPortfolioIntelligence.wtdRevenueGrowth1y,
        wtdRevGrowth3y:fundPortfolioIntelligence.wtdRevenueGrowth3y,
        screenerFormulas:fundPortfolioIntelligence.screenerFormulas,
        dataCoverage:  fundPortfolioIntelligence.dataCoveragePct,
        // Asset allocation
        equityPct:     fundAssetAllocation.equityPct,
        debtPct:       fundAssetAllocation.debtPct,
        cashPct:       fundAssetAllocation.cashPct,
        reitPct:       fundAssetAllocation.reitPct,
        goldPct:       fundAssetAllocation.goldPct,
        largeCapPct:   fundAssetAllocation.largeCapPct,
        midCapPct:     fundAssetAllocation.midCapPct,
        smallCapPct:   fundAssetAllocation.smallCapPct,
      })
      .from(funds)
      .leftJoin(amcs, eq(funds.amcId, amcs.id))
      .leftJoin(categories, eq(funds.categoryId, categories.id))
      .leftJoin(fundMetrics, eq(funds.id, fundMetrics.fundId))
      .leftJoin(
        fundPortfolioIntelligence,
        and(
          eq(funds.id, fundPortfolioIntelligence.fundId),
          eq(fundPortfolioIntelligence.month, sql`(SELECT MAX(month) FROM fund_portfolio_intelligence WHERE fund_id = ${funds.id})`)
        )
      )
      .leftJoin(
        fundAssetAllocation,
        and(
          eq(funds.id, fundAssetAllocation.fundId),
          eq(fundAssetAllocation.month, sql`(SELECT MAX(month) FROM fund_asset_allocation WHERE fund_id = ${funds.id})`)
        )
      )
      .where(eq(funds.id, fundId))
      .limit(1);

    if (!fund) return NextResponse.json({ error: "Fund not found" }, { status: 404 });

    return NextResponse.json({ data: fund });
  } catch (err: any) {
    console.error("[GET /api/funds/[id]]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
