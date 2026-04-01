/**
 * Value Research Online (VRO) scraper.
 * Scrapes: fund details, star rating, AUM, expense ratio,
 *          portfolio holdings, sector allocation, fund manager info.
 *
 * VRO fund URLs follow pattern:
 *   https://www.valueresearchonline.com/funds/<SCHEME_CODE>/
 */
import axios from "axios";
import * as cheerio from "cheerio";

const BASE = "https://www.valueresearchonline.com";
const DELAY = parseInt(process.env.SCRAPER_DELAY_MS ?? "2000");

const http = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

export interface VroFundDetails {
  schemeCode: number;
  starRating: number | null;
  aumCrores: number | null;
  expenseRatio: number | null;
  exitLoad: string | null;
  fundObjective: string | null;
  vroUrl: string;
}

export interface VroHolding {
  stockName: string;
  isin: string | null;
  sector: string | null;
  percentage: number;
}

export interface VroSectorAllocation {
  sectorName: string;
  percentage: number;
}

export interface VroManagerInfo {
  name: string;
  startDate: string | null;
  qualification: string | null;
  bio: string | null;
}

export interface VroFundData {
  details: VroFundDetails;
  holdings: VroHolding[];
  sectors: VroSectorAllocation[];
  managers: VroManagerInfo[];
  assetAllocation: {
    equityPct: number | null;
    debtPct: number | null;
    cashPct: number | null;
  } | null;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseNumber(str: string | undefined | null): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^0-9.-]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

export async function scrapeVroFund(schemeCode: number): Promise<VroFundData | null> {
  const url = `/funds/${schemeCode}/`;
  try {
    const { data: html } = await http.get(url);
    const $ = cheerio.load(html);

    // ─── Star Rating ───────────────────────────────────────────────────────────
    let starRating: number | null = null;
    const ratingEl = $(".rating-stars, [class*='star-rating'], [class*='fund-star']").first();
    const ratingText = ratingEl.attr("data-rating") ?? ratingEl.attr("title") ?? "";
    const ratingMatch = ratingText.match(/(\d)/);
    if (ratingMatch) starRating = parseInt(ratingMatch[1]);

    // ─── AUM & Expense Ratio ───────────────────────────────────────────────────
    let aumCrores: number | null = null;
    let expenseRatio: number | null = null;
    let exitLoad: string | null = null;

    $("table tr, .fund-details tr, .key-stats tr").each((_: number, row: any) => {
      const label = $(row).find("td:first-child, th:first-child").text().trim().toLowerCase();
      const value = $(row).find("td:last-child, td:nth-child(2)").text().trim();
      if (label.includes("aum") || label.includes("corpus")) {
        aumCrores = parseNumber(value);
      } else if (label.includes("expense") || label.includes("ter")) {
        expenseRatio = parseNumber(value);
      } else if (label.includes("exit load")) {
        exitLoad = value.slice(0, 200);
      }
    });

    // ─── Fund Objective ────────────────────────────────────────────────────────
    const fundObjective = $(".fund-objective, [class*='objective']").first().text().trim().slice(0, 500) || null;

    // ─── Portfolio Holdings ────────────────────────────────────────────────────
    const holdings: VroHolding[] = [];
    $("table.holdings-table tr, table[class*='portfolio'] tr, .holding-row").each((_: number, row: any) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const stockName = $(cells[0]).text().trim();
        const pctText = $(cells[cells.length - 1]).text().trim();
        const pct = parseNumber(pctText);
        if (stockName && pct && pct > 0 && stockName !== "Name") {
          holdings.push({
            stockName,
            isin: $(cells[0]).attr("data-isin") ?? null,
            sector: $(cells[1]).text().trim() || null,
            percentage: pct,
          });
        }
      }
    });

    // ─── Sector Allocation ─────────────────────────────────────────────────────
    const sectors: VroSectorAllocation[] = [];
    $(".sector-allocation tr, [class*='sector'] tr").each((_: number, row: any) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const name = $(cells[0]).text().trim();
        const pct = parseNumber($(cells[cells.length - 1]).text());
        if (name && pct && pct > 0) {
          sectors.push({ sectorName: name, percentage: pct });
        }
      }
    });

    // ─── Asset Allocation ──────────────────────────────────────────────────────
    let assetAllocation = null;
    let equityPct: number | null = null, debtPct: number | null = null, cashPct: number | null = null;
    $("[class*='asset-alloc'] tr, .asset-allocation tr").each((_: number, row: any) => {
      const label = $(row).find("td:first-child").text().trim().toLowerCase();
      const val = parseNumber($(row).find("td:last-child").text());
      if (label.includes("equity")) equityPct = val;
      else if (label.includes("debt")) debtPct = val;
      else if (label.includes("cash")) cashPct = val;
    });
    if (equityPct !== null || debtPct !== null) {
      assetAllocation = { equityPct, debtPct, cashPct };
    }

    // ─── Fund Managers ─────────────────────────────────────────────────────────
    const managers: VroManagerInfo[] = [];
    $(".fund-manager, [class*='manager']").each((_: number, el: any) => {
      const name = $(el).find("[class*='name'], h3, h4, strong").first().text().trim();
      const since = $(el).find("[class*='since'], [class*='date']").first().text().trim();
      const bio = $(el).find("p, [class*='bio']").first().text().trim();
      if (name && name.length > 2) {
        managers.push({
          name,
          startDate: parseManagerDate(since),
          qualification: null,
          bio: bio.slice(0, 500) || null,
        });
      }
    });

    return {
      details: {
        schemeCode,
        starRating,
        aumCrores,
        expenseRatio,
        exitLoad,
        fundObjective: fundObjective || null,
        vroUrl: `${BASE}${url}`,
      },
      holdings,
      sectors,
      managers,
      assetAllocation,
    };
  } catch (err: any) {
    return null;
  }
}

function parseManagerDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\w+)\s+(\d{4})/);
  if (match) {
    const months: Record<string, string> = {
      January: "01", February: "02", March: "03", April: "04",
      May: "05", June: "06", July: "07", August: "08",
      September: "09", October: "10", November: "11", December: "12",
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    const month = months[match[1]] ?? "01";
    return `${match[2]}-${month}-01`;
  }
  return null;
}

export { sleep };
