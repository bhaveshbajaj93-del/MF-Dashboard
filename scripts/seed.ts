/**
 * Seed script: fetch all fund schemes from AMFI + MFAPI.in,
 * populate amcs, categories, and funds tables.
 *
 * Run: npm run seed
 */
import "dotenv/config";
import { db } from "../lib/db/index";
import { amcs, categories, funds } from "../lib/db/schema";
import { fetchAmfiSchemes, mapAmfiCategory, inferPlanOption } from "../lib/api/amfi";
import { fetchAllSchemes } from "../lib/api/mfapi";
import { eq, sql } from "drizzle-orm";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("📥 Fetching AMFI scheme master...");
  const amfiSchemes = await fetchAmfiSchemes();
  console.log(`   Found ${amfiSchemes.length} AMFI schemes`);

  console.log("📥 Fetching MFAPI scheme list...");
  const mfapiSchemes = await fetchAllSchemes();
  console.log(`   Found ${mfapiSchemes.length} MFAPI schemes`);

  // Build lookup: scheme code → MFAPI scheme
  const mfapiMap = new Map(mfapiSchemes.map((s) => [String(s.schemeCode), s]));

  // ─── Upsert AMCs ────────────────────────────────────────────────────────────
  console.log("🏦 Upserting AMCs...");
  const amcNames = Array.from(new Set(amfiSchemes.map((s) => s.amcName).filter(Boolean)));
  const amcIdMap = new Map<string, number>();

  for (const name of amcNames) {
    if (!name) continue;
    const code = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 20);
    const existing = await db.select().from(amcs).where(eq(amcs.name, name)).limit(1);
    if (existing.length > 0) {
      amcIdMap.set(name, existing[0].id);
    } else {
      const [inserted] = await db.insert(amcs).values({ code, name }).returning();
      amcIdMap.set(name, inserted.id);
    }
  }
  console.log(`   Upserted ${amcIdMap.size} AMCs`);

  // ─── Upsert Categories ───────────────────────────────────────────────────────
  console.log("🗂️  Upserting categories...");
  const categoryKeys = Array.from(new Set(amfiSchemes.map((s) => s.schemeCategory).filter(Boolean)));
  const catIdMap = new Map<string, number>();

  for (const key of categoryKeys) {
    if (!key) continue;
    const mapped = mapAmfiCategory(key);
    const existing = await db.select().from(categories)
      .where(eq(categories.sebiCategory, key)).limit(1);
    if (existing.length > 0) {
      catIdMap.set(key, existing[0].id);
    } else {
      const [inserted] = await db.insert(categories).values({
        type: mapped.type,
        subCategory: mapped.subCategory,
        sebiCategory: mapped.sebiCategory,
        benchmarkIndex: null,
      }).returning();
      catIdMap.set(key, inserted.id);
    }
  }
  console.log(`   Upserted ${catIdMap.size} categories`);

  // ─── Upsert Funds ────────────────────────────────────────────────────────────
  console.log("💼 Upserting funds...");
  let inserted = 0, skipped = 0;

  for (const scheme of amfiSchemes) {
    if (!scheme.schemeCode) { skipped++; continue; }

    const mfapi = mfapiMap.get(scheme.schemeCode);
    const amcId = amcIdMap.get(scheme.amcName) ?? null;
    const catId = catIdMap.get(scheme.schemeCategory) ?? null;
    const { planType, optionType } = inferPlanOption(scheme.schemeName);
    const schemeCodeNum = parseInt(scheme.schemeCode);
    if (isNaN(schemeCodeNum)) { skipped++; continue; }

    const existing = await db.select({ id: funds.id }).from(funds)
      .where(eq(funds.schemeCode, schemeCodeNum)).limit(1);

    const values = {
      schemeCode: schemeCodeNum,
      isin: scheme.isinDivPayout !== "N.A." ? scheme.isinDivPayout : null,
      isinGrowth: scheme.isinDivReinvestment !== "N.A." ? scheme.isinDivReinvestment : null,
      name: scheme.schemeName,
      amcId,
      categoryId: catId,
      planType,
      optionType,
      fundHouse: scheme.amcName,
      benchmarkIndex: null,
    };

    if (existing.length === 0) {
      await db.insert(funds).values(values);
      inserted++;
    } else {
      await db.update(funds).set({ ...values, updatedAt: new Date().toISOString() })
        .where(eq(funds.schemeCode, schemeCodeNum));
    }
  }

  const total = await db.select({ count: sql<number>`count(*)` }).from(funds);
  console.log(`   Inserted ${inserted} new, skipped ${skipped}. Total funds: ${total[0].count}`);
  console.log("✅ Seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); });
