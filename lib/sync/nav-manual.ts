import { db } from "@/lib/db/index";
import { funds, navHistory, fundMetrics } from "@/lib/db/schema";
import { fetchLatestNav } from "@/lib/api/mfapi";
import { calculateReturns, NavPoint } from "@/lib/calculations/returns";
import { eq, desc } from "drizzle-orm";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

export async function syncLatestNavManual() {
  const allFunds = await db.select({ id: funds.id, schemeCode: funds.schemeCode }).from(funds).limit(100);
  let updated = 0, errors = 0;

  for (const fund of allFunds) {
    try {
      const data = await fetchLatestNav(fund.schemeCode);
      if (!data.data?.[0]) continue;
      const d = data.data[0];
      const nav = parseFloat(d.nav);
      const date = parseDate(d.date);
      if (isNaN(nav)) continue;
      await db.insert(navHistory).values({ fundId: fund.id, date, nav }).onConflictDoNothing();
      updated++;
      await sleep(50);
    } catch {
      errors++;
    }
  }
  return { updated, errors };
}
