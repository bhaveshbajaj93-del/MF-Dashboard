/**
 * Scrape fund details, holdings, sector allocation, and asset allocation
 * from Value Research Online for all funds in the database.
 *
 * Run: npm run seed:fund-details
 *
 * Resumable: skips funds that already have holdings for the current month.
 * Expected runtime: 4-8 hours for ~8000 funds (2.5s delay each).
 */
import "dotenv/config";
import { db } from "../lib/db/index";
import {
  funds,
  fundHoldings,
  fundSectorAllocation,
  fundAssetAllocation,
  fundMetrics,
  scrapeLog,
} from "../lib/db/schema";
import { scrapeVroFund, sleep } from "../lib/scrapers/valueresearch";
import { eq, and, desc, sql } from "drizzle-orm";

const DELAY = parseInt(process.env.SCRAPER_DELAY_MS ?? "2500");

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

async function main() {
  const allFunds = await db
    .select({ id: funds.id, schemeCode: funds.schemeCode, name: funds.name })
    .from(funds)
    .orderBy(funds.id);

  const month = currentMonth();
  const pMonth = prevMonth(month);
  console.log(`🏦 Seeding fund details for ${allFunds.length} funds (month: ${month})`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const fund of allFunds) {
    try {
      // Resumability: skip if this fund already has holdings for current month
      const existing = await db
        .select({ id: fundHoldings.id })
        .from(fundHoldings)
        .where(and(eq(fundHoldings.fundId, fund.id), eq(fundHoldings.month, month)))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const vroData = await scrapeVroFund(fund.schemeCode);

      if (!vroData || vroData.holdings.length === 0) {
        await db.insert(scrapeLog).values({
          source: "valueresearch",
          fundId: fund.id,
          status: "error",
          errorMsg: vroData ? "no holdings returned" : "scrape returned null",
        });
        errors++;
        await sleep(DELAY);
        continue;
      }

      // Load previous month holdings for change detection
      const prevHoldings = await db
        .select({
          isin: fundHoldings.isin,
          stockName: fundHoldings.stockName,
          percentage: fundHoldings.percentage,
        })
        .from(fundHoldings)
        .where(
          and(
            eq(fundHoldings.fundId, fund.id),
            eq(fundHoldings.month, pMonth),
            eq(fundHoldings.isFullExit, false)
          )
        );

      // Build lookup map: prefer ISIN, fallback to stockName
      const prevMap = new Map<string, number>();
      for (const h of prevHoldings) {
        if (h.isin) prevMap.set(h.isin, h.percentage ?? 0);
        prevMap.set(h.stockName, h.percentage ?? 0);
      }

      // Track ISINs present in current holdings (for exit detection)
      const currentIsins = new Set<string>();
      const currentNames = new Set<string>();

      // Build current holding rows
      const holdingRows: (typeof fundHoldings.$inferInsert)[] = [];
      for (const h of vroData.holdings) {
        const key = h.isin ?? h.stockName;
        const prevPct = prevMap.get(h.isin ?? "") ?? prevMap.get(h.stockName) ?? null;
        const isNew = prevPct === null;

        holdingRows.push({
          fundId: fund.id,
          month,
          stockName: h.stockName,
          isin: h.isin,
          sector: h.sector,
          percentage: h.percentage,
          marketValueCrores: null,
          isNewEntry: isNew,
          isFullExit: false,
          pctChange: isNew ? null : parseFloat((h.percentage - prevPct!).toFixed(3)),
        });

        if (h.isin) currentIsins.add(h.isin);
        currentNames.add(h.stockName);
      }

      // Detect full exits: in prev month but not in current
      for (const ph of prevHoldings) {
        const stillPresent = (ph.isin && currentIsins.has(ph.isin)) || currentNames.has(ph.stockName);
        if (!stillPresent) {
          holdingRows.push({
            fundId: fund.id,
            month,
            stockName: ph.stockName,
            isin: ph.isin,
            sector: null,
            percentage: 0,
            marketValueCrores: null,
            isNewEntry: false,
            isFullExit: true,
            pctChange: ph.percentage !== null ? -ph.percentage : null,
          });
        }
      }

      // Delete existing rows for this fund+month (clean slate for re-runs)
      await db
        .delete(fundHoldings)
        .where(and(eq(fundHoldings.fundId, fund.id), eq(fundHoldings.month, month)));

      // Insert holdings in batches of 100
      for (let i = 0; i < holdingRows.length; i += 100) {
        await db.insert(fundHoldings).values(holdingRows.slice(i, i + 100));
      }

      // Sector allocation — delete then insert
      await db
        .delete(fundSectorAllocation)
        .where(
          and(eq(fundSectorAllocation.fundId, fund.id), eq(fundSectorAllocation.month, month))
        );

      if (vroData.sectors.length > 0) {
        await db.insert(fundSectorAllocation).values(
          vroData.sectors.map((s) => ({
            fundId: fund.id,
            month,
            sectorName: s.sectorName,
            percentage: s.percentage,
          }))
        );
      }

      // Asset allocation — upsert (has unique index)
      if (vroData.assetAllocation) {
        const aa = vroData.assetAllocation;
        await db
          .insert(fundAssetAllocation)
          .values({
            fundId: fund.id,
            month,
            equityPct: aa.equityPct,
            debtPct: aa.debtPct,
            cashPct: aa.cashPct,
            reitPct: null,
            goldPct: null,
            otherPct: null,
            largeCapPct: null,
            midCapPct: null,
            smallCapPct: null,
          })
          .onConflictDoUpdate({
            target: [fundAssetAllocation.fundId, fundAssetAllocation.month],
            set: {
              equityPct: aa.equityPct,
              debtPct: aa.debtPct,
              cashPct: aa.cashPct,
            },
          });
      }

      // Update fund record with VRO metadata
      const d = vroData.details;
      if (d.vroUrl || d.exitLoad || d.fundObjective) {
        await db
          .update(funds)
          .set({
            vroUrl: d.vroUrl,
            exitLoad: d.exitLoad ?? undefined,
            fundObjective: d.fundObjective ?? undefined,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(funds.id, fund.id));
      }

      // Update latest fund_metrics row with AUM/expense/starRating from VRO
      if (d.aumCrores !== null || d.expenseRatio !== null || d.starRating !== null) {
        const latestMetric = await db
          .select({ id: fundMetrics.id })
          .from(fundMetrics)
          .where(eq(fundMetrics.fundId, fund.id))
          .orderBy(desc(fundMetrics.date))
          .limit(1);

        if (latestMetric.length > 0) {
          await db
            .update(fundMetrics)
            .set({
              aumCrores: d.aumCrores ?? undefined,
              expenseRatio: d.expenseRatio ?? undefined,
              starRating: d.starRating ?? undefined,
            })
            .where(eq(fundMetrics.id, latestMetric[0].id));
        }
      }

      await db.insert(scrapeLog).values({
        source: "valueresearch",
        fundId: fund.id,
        status: "success",
      });

      processed++;
      if ((processed + skipped) % 100 === 0) {
        console.log(
          `  ✅ ${processed} done, ${skipped} skipped, ${errors} errors (total: ${processed + skipped + errors}/${allFunds.length})`
        );
      }
    } catch (err: any) {
      errors++;
      await db.insert(scrapeLog).values({
        source: "valueresearch",
        fundId: fund.id,
        status: "error",
        errorMsg: err.message?.slice(0, 500),
      });
    }

    await sleep(DELAY);
  }

  console.log(`\n✅ Done! Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
