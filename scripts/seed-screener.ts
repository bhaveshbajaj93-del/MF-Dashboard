/**
 * Fetch user's custom screen formulas from Screener.in and calculate
 * portfolio-weighted averages per fund.
 *
 * Run: npm run seed:screener
 * Requires: SCREENER_SESSION_COOKIE in .env.local
 * Prerequisites: seed-fund-details must have run (provides ISINs in fund_holdings).
 *
 * Resumable: screener_custom_data upserts are idempotent.
 */
import "dotenv/config";
import { db } from "../lib/db/index";
import {
  funds,
  fundHoldings,
  screenerCustomData,
  fundPortfolioIntelligence,
} from "../lib/db/schema";
import { fetchUserScreens, fetchStockIsin } from "../lib/scrapers/screenerio";
import {
  weightedAverage,
  HoldingWeight,
  StockMetric,
} from "../lib/calculations/portfolio-weighted";
import { eq, and, inArray, isNotNull } from "drizzle-orm";

const ISIN_DELAY = 1000; // ms between ISIN lookup calls
const TODAY = new Date().toISOString().slice(0, 10);

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const cookie = process.env.SCREENER_SESSION_COOKIE;
  if (!cookie) {
    console.warn("⚠️  SCREENER_SESSION_COOKIE not set in .env.local — skipping");
    process.exit(0);
  }

  const month = currentMonth();
  console.log("🔍 Fetching Screener.in custom screens...");

  const screens = await fetchUserScreens();
  if (screens.length === 0) {
    console.warn("⚠️  No screens returned from Screener.in (check cookie or login)");
    process.exit(0);
  }

  console.log(`  Found ${screens.length} screen(s)`);

  // ─── Phase 1: Resolve ISINs for all stocks ────────────────────────────────

  // Build a deduped list of all stocks across all screens
  const allStocks = new Map<string, { name: string; isin: string | null; formulaValues: Record<string, number | null> }>();
  for (const screen of screens) {
    for (const stock of screen.stocks) {
      if (!allStocks.has(stock.symbol)) {
        allStocks.set(stock.symbol, {
          name: stock.name,
          isin: stock.isin,
          formulaValues: stock.formulaValues,
        });
      } else {
        // Merge formula values from multiple screens for the same stock
        const existing = allStocks.get(stock.symbol)!;
        Object.assign(existing.formulaValues, stock.formulaValues);
        if (!existing.isin && stock.isin) existing.isin = stock.isin;
      }
    }
  }

  console.log(`  Resolving ISINs for ${allStocks.size} unique stocks...`);

  // ISIN lookup cache — avoids duplicate HTTP calls
  const isinCache = new Map<string, string | null>();

  for (const [symbol, stock] of Array.from(allStocks.entries())) {
    if (stock.isin) {
      isinCache.set(symbol, stock.isin);
      continue;
    }

    if (isinCache.has(symbol)) {
      stock.isin = isinCache.get(symbol) ?? null;
      continue;
    }

    const isin = await fetchStockIsin(symbol, cookie);
    isinCache.set(symbol, isin);
    stock.isin = isin;
    await sleep(ISIN_DELAY);
  }

  const resolved = Array.from(isinCache.values()).filter(Boolean).length;
  console.log(`  Resolved ${resolved}/${allStocks.size} ISINs`);

  // ─── Phase 2: Store screener_custom_data ─────────────────────────────────

  console.log("\n💾 Storing screener custom data...");

  let stored = 0;
  const allFormulaNames = new Set<string>();

  for (const [, stock] of Array.from(allStocks.entries())) {
    if (!stock.isin) continue;

    for (const [formulaName, value] of Object.entries(stock.formulaValues)) {
      allFormulaNames.add(formulaName);

      await db
        .insert(screenerCustomData)
        .values({
          isin: stock.isin,
          formulaName,
          value: typeof value === "number" && isFinite(value) ? value : null,
          fetchedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [screenerCustomData.isin, screenerCustomData.formulaName],
          set: {
            value: typeof value === "number" && isFinite(value) ? value : null,
            fetchedAt: new Date().toISOString(),
          },
        });

      stored++;
    }
  }

  console.log(`  Stored ${stored} formula values across ${allFormulaNames.size} formula(s)`);

  if (allFormulaNames.size === 0) {
    console.log("  No formula data found — check that your Screener.in screens have custom columns");
    process.exit(0);
  }

  // ─── Phase 3: Fund portfolio weighted averages ────────────────────────────

  console.log("\n📊 Calculating portfolio-weighted screener formulas per fund...");

  const allFunds = await db.select({ id: funds.id }).from(funds).orderBy(funds.id);
  let fundsDone = 0;

  for (const fund of allFunds) {
    try {
      // Load non-exit holdings with ISINs for current month
      const holdings = await db
        .select({ isin: fundHoldings.isin, percentage: fundHoldings.percentage })
        .from(fundHoldings)
        .where(
          and(
            eq(fundHoldings.fundId, fund.id),
            eq(fundHoldings.month, month),
            eq(fundHoldings.isFullExit, false),
            isNotNull(fundHoldings.isin)
          )
        );

      if (holdings.length === 0) continue;

      const isins = holdings.map((h) => h.isin as string);

      const holdingWeights: HoldingWeight[] = holdings.map((h) => ({
        isin: h.isin as string,
        percentage: h.percentage ?? 0,
      }));

      // Build weighted average for each formula
      const formulaResults: Record<string, { weightedAvg: number | null; coveragePct: number }> = {};

      for (const formulaName of Array.from(allFormulaNames)) {
        const customRows = await db
          .select({ isin: screenerCustomData.isin, value: screenerCustomData.value })
          .from(screenerCustomData)
          .where(
            and(
              inArray(screenerCustomData.isin, isins),
              eq(screenerCustomData.formulaName, formulaName)
            )
          );

        const metrics: StockMetric[] = customRows.map((r) => ({
          isin: r.isin,
          value: r.value,
        }));

        const result = weightedAverage(holdingWeights, metrics);
        formulaResults[formulaName] = result;
      }

      // Serialize formula results to JSON
      const screenerFormulasJson = JSON.stringify(formulaResults);

      // Read existing row to avoid overwriting forward estimate columns
      const existing = await db
        .select({ screenerFormulas: fundPortfolioIntelligence.screenerFormulas })
        .from(fundPortfolioIntelligence)
        .where(
          and(
            eq(fundPortfolioIntelligence.fundId, fund.id),
            eq(fundPortfolioIntelligence.month, month)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Row exists — only update screenerFormulas field
        await db
          .update(fundPortfolioIntelligence)
          .set({
            screenerFormulas: screenerFormulasJson,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(fundPortfolioIntelligence.fundId, fund.id),
              eq(fundPortfolioIntelligence.month, month)
            )
          );
      } else {
        // No row yet — insert with only screener data (fwd estimates will be null)
        await db.insert(fundPortfolioIntelligence).values({
          fundId: fund.id,
          month,
          wtdForwardPe: null,
          wtdForwardPb: null,
          wtdEpsGrowth1y: null,
          wtdEpsGrowth3y: null,
          wtdRevenueGrowth1y: null,
          wtdRevenueGrowth3y: null,
          dataCoveragePct: null,
          screenerFormulas: screenerFormulasJson,
        });
      }

      fundsDone++;
    } catch {
      // silently skip
    }
  }

  console.log(`✅ Done! ${fundsDone} funds updated with screener formula weighted averages`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
