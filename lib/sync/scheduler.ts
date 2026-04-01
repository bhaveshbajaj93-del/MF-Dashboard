/**
 * node-cron daily sync scheduler.
 * Import this in a custom Next.js server or run as standalone.
 *
 * Schedule:
 *   23:00 daily  — NAV sync → recalculate metrics
 *   23:30 daily  — Forward estimates sync (Tickertape / Trendlyne / Tijori)
 *   23:45 daily  — Screener.in custom formula fetch
 *   02:00 Sunday — Holdings scrape + portfolio changes + manager tenure update
 */
import cron from "node-cron";
import { db } from "@/lib/db/index";
import { funds, navHistory, fundMetrics } from "@/lib/db/schema";
import { fetchLatestNav } from "@/lib/api/mfapi";
import { calculateReturns, NavPoint } from "@/lib/calculations/returns";
import { asc, eq, desc, sql } from "drizzle-orm";

const DELAY = parseInt(process.env.SCRAPER_DELAY_MS ?? "2000");

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Sync latest NAV for all funds */
async function syncLatestNav() {
  console.log("[sync] Starting daily NAV sync...");
  const allFunds = await db.select({ id: funds.id, schemeCode: funds.schemeCode }).from(funds);
  let updated = 0, errors = 0;

  for (const fund of allFunds) {
    try {
      const data = await fetchLatestNav(fund.schemeCode);
      if (!data.data?.[0]) continue;

      const d = data.data[0];
      const nav = parseFloat(d.nav);
      const date = parseDate(d.date);
      if (isNaN(nav)) continue;

      // Upsert latest NAV
      await db.insert(navHistory).values({ fundId: fund.id, date, nav }).onConflictDoNothing();

      // Recalculate returns: fetch last 3650 days of NAV
      const rows = await db.select({ date: navHistory.date, nav: navHistory.nav })
        .from(navHistory).where(eq(navHistory.fundId, fund.id))
        .orderBy(desc(navHistory.date)).limit(3650);

      const returns = calculateReturns(rows as NavPoint[]);
      await db.insert(fundMetrics).values({ fundId: fund.id, date, ...returns }).onConflictDoNothing();

      updated++;
      await sleep(DELAY / 10); // much faster for just latest NAV
    } catch {
      errors++;
    }
  }
  console.log(`[sync] NAV sync done. Updated: ${updated}, Errors: ${errors}`);
}

/** Cron jobs */
export function startScheduler() {
  // Daily 11 PM: NAV sync
  cron.schedule("0 23 * * *", async () => {
    try { await syncLatestNav(); }
    catch (e) { console.error("[sync] NAV sync error:", e); }
  });

  // Daily 11:30 PM: Forward estimates
  cron.schedule("30 23 * * *", async () => {
    console.log("[sync] Forward estimates sync (stub) — implement in sync/forward-sync.ts");
  });

  // Daily 11:45 PM: Screener.in formulas
  cron.schedule("45 23 * * *", async () => {
    console.log("[sync] Screener.in sync (stub) — implement in sync/screener-sync.ts");
  });

  // Sunday 2 AM: Holdings + managers
  cron.schedule("0 2 * * 0", async () => {
    console.log("[sync] Weekly holdings + manager sync (stub)");
  });

  console.log("✅ Scheduler started. Daily NAV at 23:00, weekly holdings at Sun 02:00.");
}

function parseDate(dateStr: string): string {
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const parts = dateStr.split("-");
  if (parts.length === 3 && isNaN(Number(parts[1]))) {
    return `${parts[2]}-${months[parts[1]] ?? "01"}-${parts[0].padStart(2, "0")}`;
  }
  return dateStr;
}
