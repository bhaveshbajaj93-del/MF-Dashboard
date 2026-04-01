import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── AMCs ────────────────────────────────────────────────────────────────────
export const amcs = sqliteTable("amcs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  website: text("website"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─── SEBI Categories ─────────────────────────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  subCategory: text("sub_category").notNull(),
  sebiCategory: text("sebi_category"),
  benchmarkIndex: text("benchmark_index"),
});

// ─── Funds ───────────────────────────────────────────────────────────────────
export const funds = sqliteTable("funds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schemeCode: integer("scheme_code").notNull().unique(),
  isin: text("isin"),
  isinGrowth: text("isin_growth"),
  isinIdcw: text("isin_idcw"),
  name: text("name").notNull(),
  amcId: integer("amc_id").references(() => amcs.id),
  categoryId: integer("category_id").references(() => categories.id),
  planType: text("plan_type"),
  optionType: text("option_type"),
  benchmarkIndex: text("benchmark_index"),
  launchDate: text("launch_date"),
  minSip: real("min_sip"),
  minLumpsum: real("min_lumpsum"),
  fundHouse: text("fund_house"),
  exitLoad: text("exit_load"),
  fundObjective: text("fund_objective"),
  vroUrl: text("vro_url"),
  moneycontrolUrl: text("moneycontrol_url"),
  tickertapeUrl: text("tickertape_url"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (t) => ({
  amcIdx: index("funds_amc_idx").on(t.amcId),
  categoryIdx: index("funds_category_idx").on(t.categoryId),
}));

// ─── NAV History ─────────────────────────────────────────────────────────────
export const navHistory = sqliteTable("nav_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fundId: integer("fund_id").notNull().references(() => funds.id),
  date: text("date").notNull(),
  nav: real("nav").notNull(),
}, (t) => ({
  fundDateIdx: uniqueIndex("nav_history_fund_date_idx").on(t.fundId, t.date),
  dateIdx: index("nav_history_date_idx").on(t.date),
}));

// ─── Fund Metrics ─────────────────────────────────────────────────────────────
export const fundMetrics = sqliteTable("fund_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fundId: integer("fund_id").notNull().references(() => funds.id),
  date: text("date").notNull(),
  aumCrores: real("aum_crores"),
  expenseRatio: real("expense_ratio"),
  starRating: integer("star_rating"),
  return1d: real("return_1d"),
  return1w: real("return_1w"),
  return1m: real("return_1m"),
  return3m: real("return_3m"),
  return6m: real("return_6m"),
  return1y: real("return_1y"),
  return3y: real("return_3y"),
  return5y: real("return_5y"),
  return10y: real("return_10y"),
  stdDev1y: real("std_dev_1y"),
  stdDev3y: real("std_dev_3y"),
  sharpe1y: real("sharpe_1y"),
  sharpe3y: real("sharpe_3y"),
  sortino1y: real("sortino_1y"),
  sortino3y: real("sortino_3y"),
  beta1y: real("beta_1y"),
  beta3y: real("beta_3y"),
  alpha1y: real("alpha_1y"),
  alpha3y: real("alpha_3y"),
  treynor1y: real("treynor_1y"),
  maxDrawdown1y: real("max_drawdown_1y"),
  maxDrawdown3y: real("max_drawdown_3y"),
  categoryRank: integer("category_rank"),
  amcRank: integer("amc_rank"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (t) => ({
  fundDateIdx: uniqueIndex("fund_metrics_fund_date_idx").on(t.fundId, t.date),
  return1yIdx: index("fund_metrics_return1y_idx").on(t.return1y),
  sharpe3yIdx: index("fund_metrics_sharpe3y_idx").on(t.sharpe3y),
}));

// ─── Fund Holdings ────────────────────────────────────────────────────────────
export const fundHoldings = sqliteTable("fund_holdings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fundId: integer("fund_id").notNull().references(() => funds.id),
  month: text("month").notNull(),
  stockName: text("stock_name").notNull(),
  isin: text("isin"),
  sector: text("sector"),
  percentage: real("percentage"),
  marketValueCrores: real("market_value_crores"),
  isNewEntry: integer("is_new_entry", { mode: "boolean" }).default(false),
  isFullExit: integer("is_full_exit", { mode: "boolean" }).default(false),
  pctChange: real("pct_change"),
}, (t) => ({
  fundMonthIdx: index("fund_holdings_fund_month_idx").on(t.fundId, t.month),
  isinIdx: index("fund_holdings_isin_idx").on(t.isin),
}));

// ─── Fund Asset Allocation ────────────────────────────────────────────────────
export const fundAssetAllocation = sqliteTable("fund_asset_allocation", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fundId: integer("fund_id").notNull().references(() => funds.id),
  month: text("month").notNull(),
  equityPct: real("equity_pct"),
  debtPct: real("debt_pct"),
  cashPct: real("cash_pct"),
  reitPct: real("reit_pct"),
  goldPct: real("gold_pct"),
  otherPct: real("other_pct"),
  largeCapPct: real("large_cap_pct"),
  midCapPct: real("mid_cap_pct"),
  smallCapPct: real("small_cap_pct"),
}, (t) => ({
  fundMonthIdx: uniqueIndex("fund_asset_alloc_idx").on(t.fundId, t.month),
}));

// ─── Fund Sector Allocation ──────────────────────────────────────────────────
export const fundSectorAllocation = sqliteTable("fund_sector_allocation", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fundId: integer("fund_id").notNull().references(() => funds.id),
  month: text("month").notNull(),
  sectorName: text("sector_name").notNull(),
  percentage: real("percentage").notNull(),
}, (t) => ({
  fundMonthIdx: index("fund_sector_alloc_fund_month_idx").on(t.fundId, t.month),
}));

// ─── Benchmark Sector Allocation ─────────────────────────────────────────────
export const benchmarkSectorAllocation = sqliteTable("benchmark_sector_allocation", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  benchmarkName: text("benchmark_name").notNull(),
  month: text("month").notNull(),
  sectorName: text("sector_name").notNull(),
  percentage: real("percentage").notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex("benchmark_sector_alloc_idx").on(t.benchmarkName, t.month, t.sectorName),
}));

// ─── Managers ────────────────────────────────────────────────────────────────
export const managers = sqliteTable("managers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  qualification: text("qualification"),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  totalFundsManaged: integer("total_funds_managed").default(0),
  totalAumManaged: real("total_aum_managed"),
  yearsExperience: integer("years_experience"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─── Fund Manager History ─────────────────────────────────────────────────────
export const fundManagerHistory = sqliteTable("fund_manager_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fundId: integer("fund_id").notNull().references(() => funds.id),
  managerId: integer("manager_id").notNull().references(() => managers.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  tenureReturnCagr: real("tenure_return_cagr"),
  tenureBenchmarkCagr: real("tenure_benchmark_cagr"),
  tenureAlpha: real("tenure_alpha"),
  tenureSharpe: real("tenure_sharpe"),
  tenureMaxDrawdown: real("tenure_max_drawdown"),
  tenureCategoryRank: integer("tenure_category_rank"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (t) => ({
  fundIdx: index("fund_manager_history_fund_idx").on(t.fundId),
  managerIdx: index("fund_manager_history_manager_idx").on(t.managerId),
}));

// ─── Benchmark NAV ────────────────────────────────────────────────────────────
export const benchmarkNav = sqliteTable("benchmark_nav", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  indexName: text("index_name").notNull(),
  date: text("date").notNull(),
  value: real("value").notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex("benchmark_nav_idx").on(t.indexName, t.date),
  dateIdx: index("benchmark_nav_date_idx").on(t.date),
}));

// ─── Stock Forward Estimates ──────────────────────────────────────────────────
export const stockForwardEstimates = sqliteTable("stock_forward_estimates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  isin: text("isin").notNull(),
  source: text("source").notNull(),
  date: text("date").notNull(),
  forwardPe: real("forward_pe"),
  forwardPb: real("forward_pb"),
  epsGrowth1y: real("eps_growth_1y"),
  epsGrowth3y: real("eps_growth_3y"),
  revenueGrowth1y: real("revenue_growth_1y"),
  revenueGrowth3y: real("revenue_growth_3y"),
  pegRatio: real("peg_ratio"),
  targetPrice: real("target_price"),
  upsidePct: real("upside_pct"),
  analystCount: integer("analyst_count"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (t) => ({
  uniqueIdx: uniqueIndex("stock_fwd_est_isin_source_date_idx").on(t.isin, t.source, t.date),
  isinIdx: index("stock_fwd_est_isin_idx").on(t.isin),
}));

// ─── Screener Custom Data ─────────────────────────────────────────────────────
export const screenerCustomData = sqliteTable("screener_custom_data", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  isin: text("isin").notNull(),
  formulaName: text("formula_name").notNull(),
  value: real("value"),
  fetchedAt: text("fetched_at").default(sql`(datetime('now'))`),
}, (t) => ({
  uniqueIdx: uniqueIndex("screener_custom_isin_formula_idx").on(t.isin, t.formulaName),
}));

// ─── Fund Portfolio Intelligence ──────────────────────────────────────────────
export const fundPortfolioIntelligence = sqliteTable("fund_portfolio_intelligence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fundId: integer("fund_id").notNull().references(() => funds.id),
  month: text("month").notNull(),
  wtdForwardPe: real("wtd_forward_pe"),
  wtdForwardPb: real("wtd_forward_pb"),
  wtdEpsGrowth1y: real("wtd_eps_growth_1y"),
  wtdEpsGrowth3y: real("wtd_eps_growth_3y"),
  wtdRevenueGrowth1y: real("wtd_revenue_growth_1y"),
  wtdRevenueGrowth3y: real("wtd_revenue_growth_3y"),
  screenerFormulas: text("screener_formulas"),
  dataCoveragePct: real("data_coverage_pct"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (t) => ({
  uniqueIdx: uniqueIndex("fund_portfolio_intel_idx").on(t.fundId, t.month),
}));

// ─── Scrape Log ───────────────────────────────────────────────────────────────
export const scrapeLog = sqliteTable("scrape_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  fundId: integer("fund_id"),
  scrapedAt: text("scraped_at").default(sql`(datetime('now'))`),
  status: text("status").notNull(),
  errorMsg: text("error_msg"),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type Amc = typeof amcs.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Fund = typeof funds.$inferSelect;
export type NavHistory = typeof navHistory.$inferSelect;
export type FundMetrics = typeof fundMetrics.$inferSelect;
export type FundHolding = typeof fundHoldings.$inferSelect;
export type FundAssetAllocation = typeof fundAssetAllocation.$inferSelect;
export type FundSectorAllocation = typeof fundSectorAllocation.$inferSelect;
export type BenchmarkSectorAllocation = typeof benchmarkSectorAllocation.$inferSelect;
export type Manager = typeof managers.$inferSelect;
export type FundManagerHistory = typeof fundManagerHistory.$inferSelect;
export type BenchmarkNav = typeof benchmarkNav.$inferSelect;
export type StockForwardEstimate = typeof stockForwardEstimates.$inferSelect;
export type ScreenerCustomData = typeof screenerCustomData.$inferSelect;
export type FundPortfolioIntelligence = typeof fundPortfolioIntelligence.$inferSelect;
