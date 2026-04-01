/**
 * Moneycontrol scraper for:
 * - Fund manager tenure history (start/end dates)
 * - AUM history
 * - Additional fund metadata
 */
import axios from "axios";
import * as cheerio from "cheerio";

const http = axios.create({
  baseURL: "https://www.moneycontrol.com",
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
  },
});

export interface McManagerTenure {
  managerName: string;
  startDate: string | null;
  endDate: string | null; // null = current
  qualification: string | null;
}

export interface McFundData {
  aumCrores: number | null;
  expenseRatio: number | null;
  managers: McManagerTenure[];
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseNumber(str: string | undefined | null): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^0-9.]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function parseMcDate(dateStr: string): string | null {
  if (!dateStr) return null;
  // Format: "Jan 2019" or "01-Jan-2019"
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const m1 = dateStr.match(/(\w{3})\s+(\d{4})/);
  if (m1) return `${m1[2]}-${months[m1[1]] ?? "01"}-01`;
  const m2 = dateStr.match(/(\d{2})-(\w{3})-(\d{4})/);
  if (m2) return `${m2[3]}-${months[m2[2]] ?? "01"}-${m2[1]}`;
  const m3 = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m3) return dateStr.slice(0, 10);
  return null;
}

export async function scrapeMcFund(mcUrl: string): Promise<McFundData | null> {
  try {
    const { data: html } = await http.get(mcUrl);
    const $ = cheerio.load(html);

    let aumCrores: number | null = null;
    let expenseRatio: number | null = null;

    // Key stats table
    $("tr, .mf-keyinfo li").each((_: number, el: any) => {
      const label = $(el).find("td:first-child, .label").text().trim().toLowerCase();
      const val = $(el).find("td:last-child, td:nth-child(2), .value").text().trim();
      if (label.includes("aum") || label.includes("corpus") || label.includes("net assets")) {
        aumCrores = parseNumber(val);
      } else if (label.includes("expense") || label.includes("ter")) {
        expenseRatio = parseNumber(val);
      }
    });

    // Fund managers section
    const managers: McManagerTenure[] = [];
    $(".fund-manager-block, .mf-manager-detail, [class*='manager']").each((_: number, el: any) => {
      const name = $(el).find(".manager-name, h3, h4, strong, [class*='name']").first().text().trim();
      if (!name || name.length < 2) return;

      const tenureText = $(el).find("[class*='since'], [class*='tenure'], .date").text().trim();
      const qual = $(el).find("[class*='qual'], [class*='edu'], p").first().text().trim();

      // Try to parse "Managing since: Jan 2018"
      const sinceMatch = tenureText.match(/since[:\s]+([A-Za-z]+\s+\d{4})/i);
      const startDate = sinceMatch ? parseMcDate(sinceMatch[1]) : parseMcDate(tenureText);

      managers.push({
        managerName: name,
        startDate,
        endDate: null, // current manager by default
        qualification: qual.slice(0, 200) || null,
      });
    });

    return { aumCrores, expenseRatio, managers };
  } catch {
    return null;
  }
}

/**
 * Search Moneycontrol for a fund by name to get its URL
 */
export async function searchMcFund(fundName: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(fundName.slice(0, 50));
    const { data } = await http.get(
      `/mutual-funds/performance-tracker/returns/MFO?search=${query}&type=0`
    );
    const $ = cheerio.load(data);
    const link = $("a[href*='/mutual-funds/']").first().attr("href");
    return link ?? null;
  } catch {
    return null;
  }
}

export { sleep };
