/**
 * Screener.in scraper.
 * Uses session cookie to auto-fetch user's custom screens/formulas.
 * Requires SCREENER_SESSION_COOKIE in .env.local.
 *
 * Flow:
 * 1. Fetch user's saved screens from Screener.in
 * 2. For each screen, fetch the stock data with custom formula columns
 * 3. Map stock → ISIN via NSE symbol
 * 4. Store in screener_custom_data table
 */
import axios from "axios";
import * as cheerio from "cheerio";

const http = axios.create({
  baseURL: "https://www.screener.in",
  timeout: 30000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Referer": "https://www.screener.in/",
  },
});

export interface ScreenerStock {
  name: string;
  symbol: string;
  isin: string | null;
  formulaValues: Record<string, number | null>; // formulaName → value
}

export interface ScreenerScreen {
  id: string;
  name: string;
  stocks: ScreenerStock[];
}

function getCsrfToken(cookie: string): string {
  const match = cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : "";
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch all user's saved screens from Screener.in
 */
export async function fetchUserScreens(): Promise<ScreenerScreen[]> {
  const cookie = process.env.SCREENER_SESSION_COOKIE;
  if (!cookie) {
    console.warn("⚠️  SCREENER_SESSION_COOKIE not set in .env.local");
    return [];
  }

  try {
    // Fetch the screens list page
    const { data: html } = await http.get("/screens/", {
      headers: { Cookie: cookie },
    });
    const $ = cheerio.load(html);
    const screens: ScreenerScreen[] = [];

    // Parse screen links from the page
    $("a[href*='/screens/']").each((_: number, el: any) => {
      const href = $(el).attr("href") ?? "";
      const idMatch = href.match(/\/screens\/(\d+)/);
      if (!idMatch) return;
      const name = $(el).text().trim();
      if (name && idMatch[1]) {
        screens.push({ id: idMatch[1], name, stocks: [] });
      }
    });

    // Fetch stock data for each screen
    for (const screen of screens) {
      await sleep(1500);
      const stockData = await fetchScreenData(screen.id, cookie);
      screen.stocks = stockData;
    }

    return screens;
  } catch (err: any) {
    console.error("Screener.in fetch error:", err.message);
    return [];
  }
}

/**
 * Fetch the stock data (with custom formula columns) for a specific screen
 */
async function fetchScreenData(screenId: string, cookie: string): Promise<ScreenerStock[]> {
  try {
    // Screener.in screens export as JSON via /api/screens/<id>/
    const { data } = await http.get(`/api/screens/${screenId}/?format=json`, {
      headers: {
        Cookie: cookie,
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json",
      },
    });

    const stocks: ScreenerStock[] = [];

    if (data && data.data) {
      // data.columns contains column names
      // data.data contains rows
      const columns: string[] = data.columns ?? [];

      for (const row of data.data) {
        const stock: ScreenerStock = {
          name: row[0] ?? "",
          symbol: row[1] ?? "",
          isin: null,
          formulaValues: {},
        };

        // Map custom formula columns (columns 2+ are custom formulas)
        for (let i = 2; i < columns.length; i++) {
          const colName = columns[i];
          const val = typeof row[i] === "number" ? row[i] : parseFloat(row[i]);
          stock.formulaValues[colName] = isNaN(val) ? null : val;
        }

        stocks.push(stock);
      }
    } else {
      // Fallback: scrape HTML version
      const { data: html } = await http.get(`/screens/${screenId}/`, {
        headers: { Cookie: cookie },
      });
      const $ = cheerio.load(html);

      const headers: string[] = [];
      $("table thead th").each((_: number, th: any) => {
        headers.push($(th).text().trim());
      });

      $("table tbody tr").each((_: number, row: any) => {
        const cells = $(row).find("td");
        const name = $(cells[0]).text().trim();
        const symbol = $(cells[1]).text().trim();
        if (!name) return;

        const stock: ScreenerStock = { name, symbol, isin: null, formulaValues: {} };
        for (let i = 2; i < headers.length; i++) {
          const val = parseFloat($(cells[i]).text().replace(/[^0-9.-]/g, ""));
          stock.formulaValues[headers[i]] = isNaN(val) ? null : val;
        }
        stocks.push(stock);
      });
    }

    return stocks;
  } catch {
    return [];
  }
}

/**
 * Fetch ISIN for a stock symbol from Screener.in company page
 */
export async function fetchStockIsin(symbol: string, cookie: string): Promise<string | null> {
  try {
    const { data: html } = await http.get(`/company/${symbol}/`, {
      headers: { Cookie: cookie },
    });
    const $ = cheerio.load(html);
    // ISIN is usually in company overview
    const isinEl = $("span:contains('ISIN'), td:contains('ISIN')").next();
    const isin = isinEl.text().trim();
    return isin.match(/^IN[A-Z0-9]{10}$/) ? isin : null;
  } catch {
    return null;
  }
}
