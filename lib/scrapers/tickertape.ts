/**
 * Tickertape.in scraper for forward estimates (free).
 * Fetches: Forward PE, Forward P/B, EPS growth, Revenue growth, analyst target price.
 */
import axios from "axios";
import * as cheerio from "cheerio";

const http = axios.create({
  baseURL: "https://www.tickertape.in",
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

export interface ForwardEstimate {
  isin: string;
  source: "tickertape";
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

function parseNumber(str: string | null | undefined): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^0-9.-]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

/**
 * Fetch forward estimates for a stock by its Tickertape slug.
 * Slug is typically the NSE ticker symbol in lowercase.
 */
export async function fetchTickertapeEstimates(
  isin: string,
  nseSymbol: string
): Promise<ForwardEstimate | null> {
  try {
    const slug = nseSymbol.toLowerCase();
    const { data: html } = await http.get(`/stocks/${slug}-${isin}/financials-estimates`);
    const $ = cheerio.load(html);

    let forwardPe: number | null = null;
    let forwardPb: number | null = null;
    let epsGrowth1y: number | null = null;
    let epsGrowth3y: number | null = null;
    let revenueGrowth1y: number | null = null;
    let revenueGrowth3y: number | null = null;
    let pegRatio: number | null = null;
    let targetPrice: number | null = null;
    let upsidePct: number | null = null;
    let analystCount: number | null = null;

    // Parse valuation metrics
    $("tr, [class*='metric-row'], [class*='valuation']").each((_: number, el: any) => {
      const label = $(el).find("td:first-child, [class*='label']").text().trim().toLowerCase();
      const val = $(el).find("td:last-child, td:nth-child(2), [class*='value']").text().trim();
      if (label.includes("forward p/e") || label.includes("forward pe")) {
        forwardPe = parseNumber(val);
      } else if (label.includes("forward p/b") || label.includes("forward pb")) {
        forwardPb = parseNumber(val);
      } else if (label.includes("peg")) {
        pegRatio = parseNumber(val);
      }
    });

    // Parse analyst target
    const targetEl = $("[class*='target-price'], [class*='analyst-target']");
    targetPrice = parseNumber(targetEl.text());
    const upEl = $("[class*='upside'], [class*='potential']");
    upsidePct = parseNumber(upEl.text());
    const countEl = $("[class*='analyst-count'], [class*='coverage']");
    analystCount = parseNumber(countEl.text());

    // Parse EPS growth estimates from table
    // Usually in a table with rows for different years
    $("[class*='eps-growth'], [class*='earnings-growth']").each((_: number, el: any) => {
      const label = $(el).find("[class*='year'], td:first-child").text();
      const val = parseNumber($(el).find("[class*='value'], td:last-child").text());
      if (label.includes("1") || label.includes("FY")) epsGrowth1y = val;
      else if (label.includes("3")) epsGrowth3y = val;
    });

    return {
      isin,
      source: "tickertape",
      forwardPe,
      forwardPb,
      epsGrowth1y,
      epsGrowth3y,
      revenueGrowth1y,
      revenueGrowth3y,
      pegRatio,
      targetPrice,
      upsidePct,
      analystCount,
    };
  } catch {
    return null;
  }
}
