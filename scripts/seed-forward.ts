/**
 * Fetch forward PE/PB/EPS estimates for all stocks held across funds.
 * Uses Tickertape (free) as primary source, Trendlyne as secondary (requires subscription).
 * Then calculates portfolio-weighted averages per fund.
 *
 * Run: npm run seed:forward
 * Prerequisites: seed-fund-details must have run (provides ISINs in fund_holdings).
 *
 * Resumable: skips stocks that have fresh data (< 7 days old).
 */
import "dotenv/config";
import { db } from "../lib/db/index";
import {
  funds,
  fundHoldings,
  stockForwardEstimates,
  fundPortfolioIntelligence,
} from "../lib/db/schema";
import { fetchTickertapeEstimates } from "../lib/scrapers/tickertape";
import { fetchTrendlyneEstimates } from "../lib/scrapers/trendlyne";
import {
  weightedAverageMultiple,
  HoldingWeight,
  StockMetric,
} from "../lib/calculations/portfolio-weighted";
import { eq, and, gte, inArray, isNotNull, sql } from "drizzle-orm";

const DELAY = parseInt(process.env.SCRAPER_DELAY_MS ?? "1500");
const TODAY = new Date().toISOString().slice(0, 10);
const FRESH_CUTOFF = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Derive a best-guess NSE ticker symbol from a stock name.
 * e.g. "Reliance Industries Ltd" → "RELIANCE"
 *      "HDFC Bank Limited"       → "HDFCBANK"
 *      "Infosys Ltd"             → "INFOSY" (approx)
 * Many tickers match the first word or first two words stripped of common suffixes.
 * This is a heuristic — Tickertape gracefully returns null when the slug doesn't match.
 */
function deriveSymbol(stockName: string): string {
  return stockName
    .replace(/\b(Ltd|Limited|Industries|Corporation|Corp|Inc|Co|Company|Bank|Finance|Financial|Services|Technologies|Technology|Enterprises|Holdings|Group|Solutions|International|Pharma|Pharmaceuticals|Chemicals|Energy|Power|Infrastructure|Infra|Capital|Ventures|Healthcare|Automotive|Auto)\b\.?/gi, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 12);
}

async function main() {
  const month = currentMonth();

  // ─── Phase 1: Stock-level forward estimates ───────────────────────────────

  // Get all distinct (isin, stockName) pairs from recent holdings
  const stockRows = await db
    .selectDistinct({ isin: fundHoldings.isin, stockName: fundHoldings.stockName })
    .from(fundHoldings)
    .where(and(isNotNull(fundHoldings.isin), eq(fundHoldings.isFullExit, false)));

  console.log(`📈 Fetching forward estimates for ${stockRows.length} unique stocks...`);

  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  for (const stock of stockRows) {
    if (!stock.isin) continue;

    try {
      // Resumability: skip if fresh data exists
      const fresh = await db
        .select({ id: stockForwardEstimates.id })
        .from(stockForwardEstimates)
        .where(
          and(
            eq(stockForwardEstimates.isin, stock.isin),
            eq(stockForwardEstimates.source, "tickertape"),
            gte(stockForwardEstimates.date, FRESH_CUTOFF)
          )
        )
        .limit(1);

      if (fresh.length > 0) {
        skipped++;
        continue;
      }

      const symbol = deriveSymbol(stock.stockName);

      // Tickertape (free, primary)
      const ttEst = await fetchTickertapeEstimates(stock.isin, symbol);
      if (ttEst) {
        await db
          .insert(stockForwardEstimates)
          .values({
            isin: stock.isin,
            source: "tickertape",
            date: TODAY,
            forwardPe: ttEst.forwardPe,
            forwardPb: ttEst.forwardPb,
            epsGrowth1y: ttEst.epsGrowth1y,
            epsGrowth3y: ttEst.epsGrowth3y,
            revenueGrowth1y: ttEst.revenueGrowth1y,
            revenueGrowth3y: ttEst.revenueGrowth3y,
            pegRatio: ttEst.pegRatio,
            targetPrice: ttEst.targetPrice,
            upsidePct: ttEst.upsidePct,
            analystCount: ttEst.analystCount,
          })
          .onConflictDoUpdate({
            target: [
              stockForwardEstimates.isin,
              stockForwardEstimates.source,
              stockForwardEstimates.date,
            ],
            set: {
              forwardPe: ttEst.forwardPe,
              forwardPb: ttEst.forwardPb,
              epsGrowth1y: ttEst.epsGrowth1y,
              epsGrowth3y: ttEst.epsGrowth3y,
              revenueGrowth1y: ttEst.revenueGrowth1y,
              revenueGrowth3y: ttEst.revenueGrowth3y,
              pegRatio: ttEst.pegRatio,
              targetPrice: ttEst.targetPrice,
              upsidePct: ttEst.upsidePct,
              analystCount: ttEst.analystCount,
              updatedAt: new Date().toISOString(),
            },
          });
        fetched++;
      }

      // Trendlyne (subscription, secondary) — scraper checks cookie internally
      if (process.env.TRENDLYNE_SESSION_COOKIE) {
        const tlEst = await fetchTrendlyneEstimates(stock.isin, symbol);
        if (tlEst) {
          await db
            .insert(stockForwardEstimates)
            .values({
              isin: stock.isin,
              source: "trendlyne",
              date: TODAY,
              forwardPe: tlEst.forwardPe,
              forwardPb: tlEst.forwardPb,
              epsGrowth1y: tlEst.epsGrowth1y,
              epsGrowth3y: tlEst.epsGrowth3y,
              revenueGrowth1y: tlEst.revenueGrowth1y,
              revenueGrowth3y: tlEst.revenueGrowth3y,
              pegRatio: tlEst.pegRatio,
              targetPrice: tlEst.targetPrice,
              upsidePct: tlEst.upsidePct,
              analystCount: tlEst.analystCount,
            })
            .onConflictDoUpdate({
              target: [
                stockForwardEstimates.isin,
                stockForwardEstimates.source,
                stockForwardEstimates.date,
              ],
              set: {
                forwardPe: tlEst.forwardPe,
                forwardPb: tlEst.forwardPb,
                epsGrowth1y: tlEst.epsGrowth1y,
                epsGrowth3y: tlEst.epsGrowth3y,
                revenueGrowth1y: tlEst.revenueGrowth1y,
                revenueGrowth3y: tlEst.revenueGrowth3y,
                pegRatio: tlEst.pegRatio,
                targetPrice: tlEst.targetPrice,
                upsidePct: tlEst.upsidePct,
                analystCount: tlEst.analystCount,
                updatedAt: new Date().toISOString(),
              },
            });
        }
      }
    } catch (err: any) {
      errors++;
    }

    if ((fetched + skipped + errors) % 100 === 0 && fetched + skipped + errors > 0) {
      console.log(
        `  📊 ${fetched} fetched, ${skipped} skipped, ${errors} errors (${fetched + skipped + errors}/${stockRows.length})`
      );
    }

    await sleep(DELAY);
  }

  console.log(`\n✅ Phase 1 done: ${fetched} fetched, ${skipped} skipped, ${errors} errors`);

  // ─── Phase 2: Portfolio-level weighted averages per fund ─────────────────

  console.log("\n📊 Calculating portfolio-weighted forward estimates per fund...");

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

      // Fetch latest forward estimates for these ISINs
      // Prefer trendlyne over tickertape when both exist (more analyst coverage)
      const estimates = await db
        .select({
          isin: stockForwardEstimates.isin,
          source: stockForwardEstimates.source,
          forwardPe: stockForwardEstimates.forwardPe,
          forwardPb: stockForwardEstimates.forwardPb,
          epsGrowth1y: stockForwardEstimates.epsGrowth1y,
          epsGrowth3y: stockForwardEstimates.epsGrowth3y,
          revenueGrowth1y: stockForwardEstimates.revenueGrowth1y,
          revenueGrowth3y: stockForwardEstimates.revenueGrowth3y,
          date: stockForwardEstimates.date,
        })
        .from(stockForwardEstimates)
        .where(inArray(stockForwardEstimates.isin, isins))
        .orderBy(stockForwardEstimates.date);

      // Deduplicate: for each ISIN prefer trendlyne, else tickertape (latest date wins)
      const bestEst = new Map<
        string,
        { forwardPe: number | null; forwardPb: number | null; epsGrowth1y: number | null; epsGrowth3y: number | null; revenueGrowth1y: number | null; revenueGrowth3y: number | null }
      >();
      for (const est of estimates) {
        const existing = bestEst.get(est.isin);
        if (!existing || est.source === "trendlyne") {
          bestEst.set(est.isin, {
            forwardPe: est.forwardPe,
            forwardPb: est.forwardPb,
            epsGrowth1y: est.epsGrowth1y,
            epsGrowth3y: est.epsGrowth3y,
            revenueGrowth1y: est.revenueGrowth1y,
            revenueGrowth3y: est.revenueGrowth3y,
          });
        }
      }

      const holdingWeights: HoldingWeight[] = holdings.map((h) => ({
        isin: h.isin as string,
        percentage: h.percentage ?? 0,
      }));

      const metricsMap = new Map<string, StockMetric[]>([
        ["forwardPe",       Array.from(bestEst.entries()).map(([isin, e]) => ({ isin, value: e.forwardPe }))],
        ["forwardPb",       Array.from(bestEst.entries()).map(([isin, e]) => ({ isin, value: e.forwardPb }))],
        ["epsGrowth1y",     Array.from(bestEst.entries()).map(([isin, e]) => ({ isin, value: e.epsGrowth1y }))],
        ["epsGrowth3y",     Array.from(bestEst.entries()).map(([isin, e]) => ({ isin, value: e.epsGrowth3y }))],
        ["revenueGrowth1y", Array.from(bestEst.entries()).map(([isin, e]) => ({ isin, value: e.revenueGrowth1y }))],
        ["revenueGrowth3y", Array.from(bestEst.entries()).map(([isin, e]) => ({ isin, value: e.revenueGrowth3y }))],
      ]);

      const results = weightedAverageMultiple(holdingWeights, metricsMap);

      await db
        .insert(fundPortfolioIntelligence)
        .values({
          fundId: fund.id,
          month,
          wtdForwardPe: results.get("forwardPe")?.weightedAvg ?? null,
          wtdForwardPb: results.get("forwardPb")?.weightedAvg ?? null,
          wtdEpsGrowth1y: results.get("epsGrowth1y")?.weightedAvg ?? null,
          wtdEpsGrowth3y: results.get("epsGrowth3y")?.weightedAvg ?? null,
          wtdRevenueGrowth1y: results.get("revenueGrowth1y")?.weightedAvg ?? null,
          wtdRevenueGrowth3y: results.get("revenueGrowth3y")?.weightedAvg ?? null,
          dataCoveragePct: results.get("forwardPe")?.coveragePct ?? null,
          screenerFormulas: null,
        })
        .onConflictDoUpdate({
          target: [fundPortfolioIntelligence.fundId, fundPortfolioIntelligence.month],
          set: {
            wtdForwardPe: results.get("forwardPe")?.weightedAvg ?? null,
            wtdForwardPb: results.get("forwardPb")?.weightedAvg ?? null,
            wtdEpsGrowth1y: results.get("epsGrowth1y")?.weightedAvg ?? null,
            wtdEpsGrowth3y: results.get("epsGrowth3y")?.weightedAvg ?? null,
            wtdRevenueGrowth1y: results.get("revenueGrowth1y")?.weightedAvg ?? null,
            wtdRevenueGrowth3y: results.get("revenueGrowth3y")?.weightedAvg ?? null,
            dataCoveragePct: results.get("forwardPe")?.coveragePct ?? null,
            updatedAt: new Date().toISOString(),
            // NOTE: screenerFormulas is intentionally NOT updated here
            // It is populated by seed-screener.ts and must not be overwritten
          },
        });

      fundsDone++;
    } catch {
      // silently skip
    }
  }

  console.log(`✅ Phase 2 done: ${fundsDone} funds updated with portfolio intelligence`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
