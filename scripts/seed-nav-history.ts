/**
 * Seed NAV history for all funds from MFAPI.in.
 * Run AFTER seed.ts.
 *
 * This will take 3-6 hours for all ~8000 funds.
 * You can re-run safely – it skips existing entries.
 *
 * Run: npm run seed:nav-history
 */
import "dotenv/config";
import { db } from "../lib/db/index";
import { funds, navHistory, fundMetrics } from "../lib/db/schema";
import { fetchNavHistory } from "../lib/api/mfapi";
import { calculateReturns } from "../lib/calculations/returns";
import { eq, sql, asc } from "drizzle-orm";

const DELAY_MS = 150; // be polite to MFAPI.in
const BATCH_SIZE = 500;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const allFunds = await db.select({ id: funds.id, schemeCode: funds.schemeCode, name: funds.name })
    .from(funds).orderBy(asc(funds.id));

  console.log(`📥 Fetching NAV history for ${allFunds.length} funds...`);

  let processed = 0;
  let errors = 0;

  for (const fund of allFunds) {
    try {
      // Check if we already have recent data
      const existing = await db.select({ count: sql<number>`count(*)` })
        .from(navHistory).where(eq(navHistory.fundId, fund.id));
      if (existing[0].count > 100) {
        processed++;
        if (processed % 500 === 0) console.log(`  ⏭️  Skipped ${processed}/${allFunds.length} (already have data)`);
        continue;
      }

      const mfData = await fetchNavHistory(fund.schemeCode);

      if (!mfData.data || mfData.data.length === 0) {
        errors++;
        continue;
      }

      // Parse and batch insert NAV history
      const navRows = mfData.data
        .filter((d) => d.nav && !isNaN(parseFloat(d.nav)))
        .map((d) => ({
          fundId: fund.id,
          date: parseDate(d.date),
          nav: parseFloat(d.nav),
        }));

      // Insert in batches
      for (let i = 0; i < navRows.length; i += BATCH_SIZE) {
        const batch = navRows.slice(i, i + BATCH_SIZE);
        await db.insert(navHistory).values(batch).onConflictDoNothing();
      }

      // Calculate and store returns in fund_metrics
      const sortedDesc = navRows.sort((a, b) => b.date.localeCompare(a.date));
      const returns = calculateReturns(sortedDesc);
      const today = sortedDesc[0]?.date ?? new Date().toISOString().split("T")[0];

      await db.insert(fundMetrics).values({
        fundId: fund.id,
        date: today,
        ...returns,
      }).onConflictDoNothing();

      processed++;
      if (processed % 100 === 0) {
        console.log(`  ✅ ${processed}/${allFunds.length} funds processed (${errors} errors)`);
      }

      await sleep(DELAY_MS);
    } catch (err: any) {
      errors++;
      if (errors % 50 === 0) {
        console.error(`  ❌ Error on fund ${fund.schemeCode}: ${err.message}`);
      }
      await sleep(DELAY_MS * 2);
    }
  }

  console.log(`\n✅ NAV history seed complete! Processed: ${processed}, Errors: ${errors}`);
  const total = await db.select({ count: sql<number>`count(*)` }).from(navHistory);
  console.log(`   Total NAV rows in DB: ${total[0].count.toLocaleString()}`);
}

/** Convert DD-Mon-YYYY → YYYY-MM-DD */
function parseDate(dateStr: string): string {
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${months[m] ?? "01"}-${d.padStart(2, "0")}`;
  }
  return dateStr; // already YYYY-MM-DD
}

main().catch((e) => { console.error(e); process.exit(1); });
