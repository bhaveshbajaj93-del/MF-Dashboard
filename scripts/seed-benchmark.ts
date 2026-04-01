/**
 * Seed benchmark NAV data from MFAPI.in using index fund proxies.
 * We use the following index funds as benchmarks:
 *   Nifty 50         → UTI Nifty 50 Index Fund (scheme 120716)
 *   Nifty 500        → UTI Nifty 500 Value 50 proxy / Nippon India Nifty 500
 *   Nifty Midcap 150 → UTI Nifty Midcap 150 Index Fund
 *   Nifty Smallcap   → UTI Nifty Smallcap 250 Index Fund
 *   Sensex           → HDFC Index Fund - Sensex Plan
 *   Nifty Next 50    → UTI Nifty Next 50 Index Fund
 *
 * Run: npm run seed:benchmark
 */
import "dotenv/config";
import { db } from "../lib/db/index";
import { benchmarkNav } from "../lib/db/schema";
import { fetchNavHistory } from "../lib/api/mfapi";

const BENCHMARKS: Array<{ name: string; schemeCode: number }> = [
  { name: "Nifty 50",          schemeCode: 120716 },
  { name: "Nifty Next 50",     schemeCode: 120757 },
  { name: "Nifty 500",         schemeCode: 148622 },
  { name: "Nifty Midcap 150",  schemeCode: 148621 },
  { name: "Nifty Smallcap 250",schemeCode: 148620 },
  { name: "Sensex",            schemeCode: 119598 },
  { name: "Nifty Bank",        schemeCode: 147946 },
];

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
  return dateStr;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("📊 Seeding benchmark NAV data...");

  for (const bench of BENCHMARKS) {
    console.log(`  Fetching ${bench.name} (scheme ${bench.schemeCode})...`);
    try {
      const data = await fetchNavHistory(bench.schemeCode);
      if (!data.data?.length) {
        console.warn(`  ⚠️  No data for ${bench.name}`);
        continue;
      }

      const rows = data.data
        .filter((d) => d.nav && !isNaN(parseFloat(d.nav)))
        .map((d) => ({
          indexName: bench.name,
          date: parseDate(d.date),
          value: parseFloat(d.nav),
        }));

      for (let i = 0; i < rows.length; i += 500) {
        await db.insert(benchmarkNav).values(rows.slice(i, i + 500)).onConflictDoNothing();
      }
      console.log(`  ✅ ${bench.name}: ${rows.length} data points`);
    } catch (err: any) {
      console.error(`  ❌ ${bench.name}: ${err.message}`);
    }
    await sleep(300);
  }

  console.log("\n✅ Benchmark seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); });
