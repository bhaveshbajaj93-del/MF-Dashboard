import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/index";
import { funds, fundMetrics, amcs, categories, fundPortfolioIntelligence } from "@/lib/db/schema";
import { eq, and, gte, lte, like, desc, asc, sql, isNotNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    // ─── Query params ──────────────────────────────────────────────────────────
    const page       = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit      = Math.min(200, parseInt(searchParams.get("limit") ?? "50"));
    const offset     = (page - 1) * limit;
    const sortBy     = searchParams.get("sort") ?? "return_1y";
    const order      = searchParams.get("order") === "asc" ? "asc" : "desc";
    const search     = searchParams.get("q") ?? "";
    const catType    = searchParams.get("type") ?? ""; // equity|debt|hybrid|liquid|index
    const catSub     = searchParams.get("sub") ?? "";
    const amcId      = searchParams.get("amc") ?? "";
    const planType   = searchParams.get("plan") ?? ""; // direct|regular
    const optionType = searchParams.get("option") ?? "growth";
    const minAum     = searchParams.get("min_aum") ?? "";
    const maxTer     = searchParams.get("max_ter") ?? "";
    const minReturn1y= searchParams.get("min_return_1y") ?? "";
    const minSharpe  = searchParams.get("min_sharpe") ?? "";
    const minRating  = searchParams.get("min_rating") ?? "";

    // ─── Build base query ──────────────────────────────────────────────────────
    const conditions = [];

    if (search) conditions.push(like(funds.name, `%${search}%`));
    if (planType) conditions.push(eq(funds.planType, planType));
    if (optionType) conditions.push(eq(funds.optionType, optionType));
    if (amcId) conditions.push(eq(funds.amcId, parseInt(amcId)));

    // ─── Resolve sort column ───────────────────────────────────────────────────
    const sortMap: Record<string, any> = {
      name:           funds.name,
      return_1d:      fundMetrics.return1d,
      return_1w:      fundMetrics.return1w,
      return_1m:      fundMetrics.return1m,
      return_3m:      fundMetrics.return3m,
      return_6m:      fundMetrics.return6m,
      return_1y:      fundMetrics.return1y,
      return_3y:      fundMetrics.return3y,
      return_5y:      fundMetrics.return5y,
      return_10y:     fundMetrics.return10y,
      aum:            fundMetrics.aumCrores,
      expense_ratio:  fundMetrics.expenseRatio,
      star_rating:    fundMetrics.starRating,
      sharpe_1y:      fundMetrics.sharpe1y,
      sharpe_3y:      fundMetrics.sharpe3y,
      sortino_1y:     fundMetrics.sortino1y,
      sortino_3y:     fundMetrics.sortino3y,
      beta_1y:        fundMetrics.beta1y,
      beta_3y:        fundMetrics.beta3y,
      alpha_1y:       fundMetrics.alpha1y,
      alpha_3y:       fundMetrics.alpha3y,
      max_drawdown_1y:fundMetrics.maxDrawdown1y,
      max_drawdown_3y:fundMetrics.maxDrawdown3y,
      std_dev_1y:     fundMetrics.stdDev1y,
      std_dev_3y:     fundMetrics.stdDev3y,
      fwd_pe:         fundPortfolioIntelligence.wtdForwardPe,
      eps_growth_1y:  fundPortfolioIntelligence.wtdEpsGrowth1y,
    };
    const sortCol = sortMap[sortBy] ?? fundMetrics.return1y;
    const orderFn = order === "asc" ? asc : desc;

    // ─── Execute query ─────────────────────────────────────────────────────────
    const rows = await db
      .select({
        id:            funds.id,
        schemeCode:    funds.schemeCode,
        name:          funds.name,
        isin:          funds.isin,
        planType:      funds.planType,
        optionType:    funds.optionType,
        benchmarkIndex:funds.benchmarkIndex,
        amcId:         funds.amcId,
        amcName:       amcs.name,
        categoryId:    funds.categoryId,
        catType:       categories.type,
        catSub:        categories.subCategory,
        sebiCategory:  categories.sebiCategory,
        // Metrics
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
        sharpe1y:      fundMetrics.sharpe1y,
        sharpe3y:      fundMetrics.sharpe3y,
        sortino1y:     fundMetrics.sortino1y,
        sortino3y:     fundMetrics.sortino3y,
        beta1y:        fundMetrics.beta1y,
        beta3y:        fundMetrics.beta3y,
        alpha1y:       fundMetrics.alpha1y,
        alpha3y:       fundMetrics.alpha3y,
        maxDrawdown1y: fundMetrics.maxDrawdown1y,
        maxDrawdown3y: fundMetrics.maxDrawdown3y,
        stdDev1y:      fundMetrics.stdDev1y,
        stdDev3y:      fundMetrics.stdDev3y,
        categoryRank:  fundMetrics.categoryRank,
        // Portfolio intelligence
        wtdForwardPe:  fundPortfolioIntelligence.wtdForwardPe,
        wtdEpsGrowth1y:fundPortfolioIntelligence.wtdEpsGrowth1y,
        wtdEpsGrowth3y:fundPortfolioIntelligence.wtdEpsGrowth3y,
        screenerFormulas: fundPortfolioIntelligence.screenerFormulas,
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
      .where(
        conditions.length > 0
          ? and(...conditions)
          : undefined
      )
      .orderBy(
        isNotNull(sortCol)
          ? orderFn(sortCol)
          : desc(fundMetrics.return1y)
      )
      .limit(limit)
      .offset(offset);

    // Apply category filters post-query for simplicity
    let filtered = rows;
    if (catType) filtered = filtered.filter((r) => r.catType === catType);
    if (catSub) filtered = filtered.filter((r) => r.catSub?.toLowerCase().includes(catSub.toLowerCase()));
    if (minAum) filtered = filtered.filter((r) => (r.aumCrores ?? 0) >= parseFloat(minAum));
    if (maxTer) filtered = filtered.filter((r) => (r.expenseRatio ?? 999) <= parseFloat(maxTer));
    if (minReturn1y) filtered = filtered.filter((r) => (r.return1y ?? -999) >= parseFloat(minReturn1y));
    if (minSharpe) filtered = filtered.filter((r) => (r.sharpe3y ?? -999) >= parseFloat(minSharpe));
    if (minRating) filtered = filtered.filter((r) => (r.starRating ?? 0) >= parseInt(minRating));

    // Total count
    const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(funds);

    return NextResponse.json({
      data: filtered,
      meta: {
        total: countRow.count,
        page,
        limit,
        pages: Math.ceil(countRow.count / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/funds]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
