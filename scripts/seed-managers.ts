/**
 * Populate fund managers and their tenure history from Value Research Online.
 * Calculates per-tenure CAGR, alpha, Sharpe, max drawdown.
 *
 * Run: npm run seed:managers
 * Prerequisites: seed-nav-history, seed-benchmark must have run.
 *
 * Resumable: skips fund_manager_history entries that already exist.
 */
import "dotenv/config";
import { db } from "../lib/db/index";
import {
  funds,
  managers,
  fundManagerHistory,
  navHistory,
  benchmarkNav,
} from "../lib/db/schema";
import { scrapeVroFund, sleep } from "../lib/scrapers/valueresearch";
import { scrapeMcFund } from "../lib/scrapers/moneycontrol";
import { calculateTenurePerformance } from "../lib/calculations/tenure-performance";
import { NavPoint } from "../lib/calculations/returns";
import { eq, and, asc, sql } from "drizzle-orm";

const DELAY = parseInt(process.env.SCRAPER_DELAY_MS ?? "2500");
const RISK_FREE = parseFloat(process.env.RISK_FREE_RATE_ANNUAL ?? "0.065");
const today = new Date().toISOString().slice(0, 10);

// Cache benchmark NAV data to avoid repeated DB queries
const benchCache = new Map<string, NavPoint[]>();

async function getBenchmark(name: string): Promise<NavPoint[]> {
  if (benchCache.has(name)) return benchCache.get(name)!;
  const rows = await db
    .select({ date: benchmarkNav.date, nav: benchmarkNav.value })
    .from(benchmarkNav)
    .where(eq(benchmarkNav.indexName, name))
    .orderBy(asc(benchmarkNav.date));
  const result = rows.map((r) => ({ date: r.date, nav: r.nav }));
  benchCache.set(name, result);
  return result;
}

async function getFundNav(fundId: number): Promise<NavPoint[]> {
  const rows = await db
    .select({ date: navHistory.date, nav: navHistory.nav })
    .from(navHistory)
    .where(eq(navHistory.fundId, fundId))
    .orderBy(asc(navHistory.date));
  return rows.map((r) => ({ date: r.date, nav: r.nav }));
}

async function upsertManager(name: string, qualification: string | null, bio: string | null): Promise<number> {
  // Check if manager exists
  const existing = await db
    .select({ id: managers.id, qualification: managers.qualification, bio: managers.bio })
    .from(managers)
    .where(eq(managers.name, name))
    .limit(1);

  if (existing.length > 0) {
    // Update qualification/bio only if they were previously null
    if ((!existing[0].qualification && qualification) || (!existing[0].bio && bio)) {
      await db
        .update(managers)
        .set({
          qualification: existing[0].qualification ?? qualification ?? undefined,
          bio: existing[0].bio ?? bio ?? undefined,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(managers.id, existing[0].id));
    }
    return existing[0].id;
  }

  const inserted = await db
    .insert(managers)
    .values({ name, qualification, bio, updatedAt: new Date().toISOString() })
    .returning({ id: managers.id });
  return inserted[0].id;
}

async function historyExists(fundId: number, managerId: number, startDate: string): Promise<boolean> {
  const rows = await db
    .select({ id: fundManagerHistory.id })
    .from(fundManagerHistory)
    .where(
      and(
        eq(fundManagerHistory.fundId, fundId),
        eq(fundManagerHistory.managerId, managerId),
        eq(fundManagerHistory.startDate, startDate)
      )
    )
    .limit(1);
  return rows.length > 0;
}

async function main() {
  const allFunds = await db
    .select({
      id: funds.id,
      schemeCode: funds.schemeCode,
      name: funds.name,
      benchmarkIndex: funds.benchmarkIndex,
      moneycontrolUrl: funds.moneycontrolUrl,
    })
    .from(funds)
    .orderBy(funds.id);

  console.log(`👤 Seeding managers for ${allFunds.length} funds...`);
  let processed = 0;
  let errors = 0;

  for (const fund of allFunds) {
    try {
      const vroData = await scrapeVroFund(fund.schemeCode);

      let managerList: Array<{ name: string; startDate: string | null; endDate: string | null; qualification: string | null; bio: string | null }> = [];

      if (vroData && vroData.managers.length > 0) {
        managerList = vroData.managers.map((m) => ({
          name: m.name,
          startDate: m.startDate,
          endDate: null, // VRO only shows current managers
          qualification: m.qualification,
          bio: m.bio,
        }));
      } else if (fund.moneycontrolUrl) {
        // Fallback: try MoneyControl for manager tenure data
        const mcData = await scrapeMcFund(fund.moneycontrolUrl);
        if (mcData && mcData.managers.length > 0) {
          managerList = mcData.managers.map((m) => ({
            name: m.managerName,
            startDate: m.startDate,
            endDate: m.endDate,
            qualification: m.qualification,
            bio: null,
          }));
        }
      }

      if (managerList.length === 0) {
        processed++;
        await sleep(DELAY);
        continue;
      }

      // Load fund NAV once (shared across all managers of this fund)
      const fundNav = await getFundNav(fund.id);
      const benchName = fund.benchmarkIndex ?? "Nifty 50";
      const benchData = await getBenchmark(benchName);

      for (const mgr of managerList) {
        if (!mgr.name || mgr.name.length < 2) continue;

        const managerId = await upsertManager(mgr.name, mgr.qualification, mgr.bio);

        // Use today as endDate for current managers
        const effectiveStart = mgr.startDate ?? "2000-01-01";
        const effectiveEnd = mgr.endDate ?? today;

        // Guard: skip if this exact record already exists
        if (await historyExists(fund.id, managerId, effectiveStart)) continue;

        // Calculate tenure performance stats
        const tenureStats = calculateTenurePerformance(
          fundNav,
          benchData,
          effectiveStart,
          effectiveEnd,
          RISK_FREE
        );

        await db.insert(fundManagerHistory).values({
          fundId: fund.id,
          managerId,
          startDate: effectiveStart,
          endDate: mgr.endDate, // null for current managers
          tenureReturnCagr: tenureStats.tenureReturnCagr,
          tenureBenchmarkCagr: tenureStats.tenureBenchmarkCagr,
          tenureAlpha: tenureStats.tenureAlpha,
          tenureSharpe: tenureStats.tenureSharpe,
          tenureMaxDrawdown: tenureStats.tenureMaxDrawdown,
          updatedAt: new Date().toISOString(),
        });
      }

      processed++;
      if (processed % 200 === 0) {
        console.log(`  ✅ ${processed}/${allFunds.length} funds processed (${errors} errors)`);
      }
    } catch (err: any) {
      errors++;
      if (errors <= 20) console.error(`  ❌ Fund ${fund.id} (${fund.name}): ${err.message}`);
    }

    await sleep(DELAY);
  }

  // Update totalFundsManaged count for all managers
  console.log("  📊 Updating manager fund counts...");
  await db.run(
    sql`UPDATE managers SET total_funds_managed = (
      SELECT COUNT(DISTINCT fund_id) FROM fund_manager_history WHERE manager_id = managers.id
    )`
  );

  console.log(`\n✅ Done! Processed: ${processed}, Errors: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
