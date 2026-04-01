import axios from "axios";

/**
 * AMFI Scheme Master format (pipe-delimited):
 * Scheme Code|ISIN Div Payout/IDCW|ISIN Div Reinvestment|Scheme Name|Net Asset Value|Date
 *
 * Full scheme master with category info:
 * https://www.amfiindia.com/spages/NAVAll.txt
 */

export interface AmfiScheme {
  schemeCode: string;
  isinDivPayout: string;
  isinDivReinvestment: string;
  schemeName: string;
  nav: string;
  date: string;
  // Parsed from section headers
  amcName: string;
  schemeType: string;    // Open Ended / Close Ended / Interval
  schemeCategory: string; // e.g. "Equity Scheme - Flexi Cap Fund"
}

export async function fetchAmfiSchemes(): Promise<AmfiScheme[]> {
  const { data } = await axios.get<string>(
    "https://www.amfiindia.com/spages/NAVAll.txt",
    { timeout: 30000, responseType: "text" }
  );
  return parseAmfiData(data);
}

export function parseAmfiData(raw: string): AmfiScheme[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const schemes: AmfiScheme[] = [];

  let currentAmcName = "";
  let currentSchemeType = "";
  let currentSchemeCategory = "";

  for (const line of lines) {
    // AMC header line (no semicolons, no pipes, usually ends with "Mutual Fund" or similar)
    if (!line.includes(";") && !line.includes("|")) {
      // Section header like "Open Ended Schemes(Equity Scheme - Flexi Cap Fund)"
      if (line.startsWith("Open Ended") || line.startsWith("Close Ended") || line.startsWith("Interval")) {
        const match = line.match(/^(Open Ended|Close Ended|Interval)\s+Schemes\((.+)\)/);
        if (match) {
          currentSchemeType = match[1];
          currentSchemeCategory = match[2];
        }
      } else if (line.length > 3) {
        currentAmcName = line;
      }
      continue;
    }

    // Data line: SchemeCode;ISINPayout;ISINReinvest;SchemeName;NAV;Date
    const parts = line.split(";");
    if (parts.length >= 6) {
      schemes.push({
        schemeCode: parts[0].trim(),
        isinDivPayout: parts[1].trim(),
        isinDivReinvestment: parts[2].trim(),
        schemeName: parts[3].trim(),
        nav: parts[4].trim(),
        date: parts[5].trim(),
        amcName: currentAmcName,
        schemeType: currentSchemeType,
        schemeCategory: currentSchemeCategory,
      });
    }
  }

  return schemes;
}

/** Maps AMFI category string → our category type */
export function mapAmfiCategory(amfiCategory: string): {
  type: string;
  subCategory: string;
  sebiCategory: string;
} {
  const cat = amfiCategory.toLowerCase();
  if (cat.includes("equity")) {
    return { type: "equity", subCategory: amfiCategory, sebiCategory: amfiCategory };
  } else if (cat.includes("debt") || cat.includes("bond") || cat.includes("gilt") || cat.includes("liquid") || cat.includes("money market") || cat.includes("overnight") || cat.includes("ultra short") || cat.includes("short duration") || cat.includes("medium duration") || cat.includes("long duration") || cat.includes("dynamic bond") || cat.includes("credit risk") || cat.includes("banking and psu") || cat.includes("floater") || cat.includes("10 year")) {
    if (cat.includes("liquid") || cat.includes("overnight") || cat.includes("money market")) {
      return { type: "liquid", subCategory: amfiCategory, sebiCategory: amfiCategory };
    }
    return { type: "debt", subCategory: amfiCategory, sebiCategory: amfiCategory };
  } else if (cat.includes("hybrid")) {
    return { type: "hybrid", subCategory: amfiCategory, sebiCategory: amfiCategory };
  } else if (cat.includes("index") || cat.includes("etf")) {
    return { type: "index", subCategory: amfiCategory, sebiCategory: amfiCategory };
  } else if (cat.includes("fund of fund") || cat.includes("fof")) {
    return { type: "fof", subCategory: amfiCategory, sebiCategory: amfiCategory };
  } else if (cat.includes("solution") || cat.includes("retirement") || cat.includes("children")) {
    return { type: "solution", subCategory: amfiCategory, sebiCategory: amfiCategory };
  }
  return { type: "other", subCategory: amfiCategory, sebiCategory: amfiCategory };
}

/** Infer plan type and option type from scheme name */
export function inferPlanOption(schemeName: string): {
  planType: "direct" | "regular";
  optionType: "growth" | "idcw" | "other";
} {
  const name = schemeName.toLowerCase();
  const planType = name.includes("direct") ? "direct" : "regular";
  let optionType: "growth" | "idcw" | "other" = "other";
  if (name.includes("growth") && !name.includes("idcw")) {
    optionType = "growth";
  } else if (name.includes("idcw") || name.includes("dividend") || name.includes("payout") || name.includes("reinvest")) {
    optionType = "idcw";
  } else if (name.includes("growth")) {
    optionType = "growth";
  }
  return { planType, optionType };
}
