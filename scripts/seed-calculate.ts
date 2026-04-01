/**
 * Recalculate all return metrics and risk metrics for all funds.
 * Run after seed-nav-history.ts and seed-benchmark.ts.
 *
 * Run: npm run seed:calculate
 */
import "dotenv/config";
import { db } from "../lib/db/index";
import { funds, navHistory, benchmarkNav, fundMetrics, categories } from "../lib/db/schema";
import { calculateReturns, NavPoint } from "../lib/calculations/returns";
import { calculateRiskMetrics } from "../lib/calculations/risk-metrics";
import { eq, asc, desc } from "drizzle-orm";

const RISK_FREE = parseFloat(process.env.RISK_FREE_RATE_ANNUAL ?? "0.065");

async function main() {
  const allFunds = await db.select({
    id: funds.id,
    categoryId: funds.categoryId,
    benchmarkIndex: funds.benchmarkIndex,
  }).from(funds).orderBy(asc(funds.id));

  console.log(`📊 Calculating metrics for ${allFunds.length} funds...`);
  let processed = 0;
  let errors = 0;

  // Cache benchmark data
  const benchCache = new Map<string, NavPoint[]>();

  async function getBenchmark(name: string): Promise<NavPoint[]> {
    if (benchCache.has(name)) return benchCache.get(name)!;
    const rows = await db.select({ date: benchmarkNav.date, nav: benchmarkNav.value })
      .from(benchmarkNav)
      .where(eq(benchmarkNav.indexName, name))
      .orderBy(asc(benchmarkNav.date));
    const result = rows.map((r) => ({ date: r.date, nav: r.nav }));
    benchCache.set(name, result);
    return result;
  }

  for (const fund of allFunds) {
    try {
      // Get NAV history ASC sorted
      const navRows = await db.select({ date: navHistory.date, nav: navHistory.nav })
        .from(navHistory)
        .where(eq(navHistory.fundId, fund.id))
        .orderBy(asc(navHistory.date));

      if (navRows.length < 5) { processed++; continue; }

      const navDesc = [...navRows].reverse() as NavPoint[];
      const navAsc = navRows as NavPoint[];

      // Determine benchmark
      const benchName = fund.benchmarkIndex ?? "Nifty 50";
      const benchData = await getBenchmark(benchName);

      const returns = calculateReturns(navDesc);
      const risk1y = calculateRiskMetrics(navAsc, benchData, RISK_FREE, 1);
      const risk3y = calculateRiskMetrics(navAsc, benchData, RISK_FREE, 3);
      const today = navDesc[0].date;

      await db.insert(fundMetrics).values({
        fundId: fund.id,
        date: today,
        ...returns,
        stdDev1y: risk1y.stdDev,
        stdDev3y: risk3y.stdDev,
        sharpe1y: risk1y.sharpe,
        sharpe3y: risk3y.sharpe,
        sortino1y: risk1y.sortino,
        sortino3y: risk3y.sortino,
        beta1y: risk1y.beta,
        beta3y: risk3y.beta,
        alpha1y: risk1y.alpha,
        alpha3y: risk3y.alpha,
        treynor1y: risk1y.treynor,
        maxDrawdown1y: risk1y.maxDrawdown,
        maxDrawdown3y: risk3y.maxDrawdown,
      }).onConflictDoNothing();

      processed++;
      if (processed % 500 === 0) {
        console.log(`  ✅ ${processed}/${allFunds.length} (${errors} errors)`);
      }
    } catch (err: any) {
      errors++;
    }
  }

  console.log(`\n✅ Calculation complete! Processed: ${processed}, Errors: ${errors}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
