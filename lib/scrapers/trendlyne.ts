/**
 * Trendlyne scraper for broker consensus forward estimates.
 * Requires TRENDLYNE_SESSION_COOKIE in .env.local (subscription needed).
 */
import axios from "axios";
import * as cheerio from "cheerio";

const http = axios.create({
  baseURL: "https://trendlyne.com",
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-IN,en;q=0.9",
  },
});

function parseNumber(str: string | null | undefined): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^0-9.-]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

export interface TrendlyneEstimate {
  isin: string;
  source: "trendlyne";
  forwardPe: number | null;
  forwardPb: number | null;
  epsGrowth1y: number | null;
  epsGrowth3y: number | null;
  revenueGrowth1y: number | null;
  revenueGrowth3y: number | null;
  pegRatio: number | null;
  targetPrice: number | null;
  upsidePct: number | null;
  analystCount: number | null;
}

export async function fetchTrendlyneEstimates(
  isin: string,
  symbol: string
): Promise<TrendlyneEstimate | null> {
  const cookie = process.env.TRENDLYNE_SESSION_COOKIE;
  if (!cookie) return null;

  try {
    const { data: html } = await http.get(`/equity/${symbol.toLowerCase()}/forecasts/`, {
      headers: { Cookie: cookie },
    });
    const $ = cheerio.load(html);

    let forwardPe: number | null = null;
    let forwardPb: number | null = null;
    let epsGrowth1y: number | null = null;
    let epsGrowth3y: number | null = null;
    let revenueGrowth1y: number | null = null;
    let revenueGrowth3y: number | null = null;
    let targetPrice: number | null = null;
    let upsidePct: number | null = null;
    let analystCount: number | null = null;

    // Parse broker consensus table
    $("[class*='consensus'], [class*='forecast'] tr").each((_: number, el: any) => {
      const label = $(el).find("td:first-child, th").text().trim().toLowerCase();
      const val = $(el).find("td:last-child, td:nth-child(2)").text().trim();
      if (label.includes("forward pe") || label.includes("price/earnings")) forwardPe = parseNumber(val);
      else if (label.includes("forward pb") || label.includes("price/book")) forwardPb = parseNumber(val);
      else if (label.includes("eps growth") && label.includes("1")) epsGrowth1y = parseNumber(val);
      else if (label.includes("eps growth") && label.includes("3")) epsGrowth3y = parseNumber(val);
      else if (label.includes("revenue") && label.includes("1")) revenueGrowth1y = parseNumber(val);
      else if (label.includes("revenue") && label.includes("3")) revenueGrowth3y = parseNumber(val);
      else if (label.includes("target")) targetPrice = parseNumber(val);
      else if (label.includes("upside")) upsidePct = parseNumber(val);
      else if (label.includes("analyst") || label.includes("coverage")) analystCount = parseNumber(val);
    });

    return {
      isin, source: "trendlyne",
      forwardPe, forwardPb, epsGrowth1y, epsGrowth3y,
      revenueGrowth1y, revenueGrowth3y,
      pegRatio: forwardPe && epsGrowth1y ? parseFloat((forwardPe / epsGrowth1y).toFixed(2)) : null,
      targetPrice, upsidePct, analystCount,
    };
  } catch {
    return null;
  }
}
