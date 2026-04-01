import { subDays, subMonths, subYears, parseISO, differenceInDays } from "date-fns";

export interface NavPoint {
  date: string; // YYYY-MM-DD
  nav: number;
}

/** Find NAV closest to target date (searching backward up to 7 days) */
export function findNavOnOrBefore(navData: NavPoint[], targetDate: Date): number | null {
  const targetStr = formatDate(targetDate);
  // navData is sorted desc by date from DB
  for (const point of navData) {
    if (point.date <= targetStr) return point.nav;
  }
  return null;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** CAGR = (endNav/startNav)^(1/years) - 1 */
export function calculateCAGR(startNav: number, endNav: number, years: number): number {
  if (years <= 0 || startNav <= 0) return 0;
  return Math.pow(endNav / startNav, 1 / years) - 1;
}

/** Absolute return for periods < 1 year */
export function absoluteReturn(startNav: number, endNav: number): number {
  if (startNav <= 0) return 0;
  return (endNav - startNav) / startNav;
}

export interface FundReturns {
  return1d: number | null;
  return1w: number | null;
  return1m: number | null;
  return3m: number | null;
  return6m: number | null;
  return1y: number | null;
  return3y: number | null;
  return5y: number | null;
  return10y: number | null;
}

/**
 * Calculate all standard return periods from NAV history.
 * navData: sorted DESC by date (latest first)
 */
export function calculateReturns(navData: NavPoint[]): FundReturns {
  if (navData.length === 0) {
    return {
      return1d: null, return1w: null, return1m: null, return3m: null,
      return6m: null, return1y: null, return3y: null, return5y: null, return10y: null,
    };
  }

  const latestNav = navData[0].nav;
  const today = parseISO(navData[0].date);

  const navOn = (daysBack?: number, monthsBack?: number, yearsBack?: number): number | null => {
    let target = new Date(today);
    if (daysBack) target = subDays(today, daysBack);
    if (monthsBack) target = subMonths(today, monthsBack);
    if (yearsBack) target = subYears(today, yearsBack);
    return findNavOnOrBefore(navData, target);
  };

  const pct = (startNav: number | null, years?: number): number | null => {
    if (!startNav) return null;
    if (years && years >= 1) return calculateCAGR(startNav, latestNav, years) * 100;
    return absoluteReturn(startNav, latestNav) * 100;
  };

  return {
    return1d: pct(navOn(1)),
    return1w: pct(navOn(7)),
    return1m: pct(navOn(undefined, 1)),
    return3m: pct(navOn(undefined, 3)),
    return6m: pct(navOn(undefined, 6)),
    return1y: pct(navOn(undefined, undefined, 1), 1),
    return3y: pct(navOn(undefined, undefined, 3), 3),
    return5y: pct(navOn(undefined, undefined, 5), 5),
    return10y: pct(navOn(undefined, undefined, 10), 10),
  };
}

/** Compute rolling returns over a window (e.g., 1Y) at monthly intervals */
export function calculateRollingReturns(
  navData: NavPoint[],
  windowYears: number
): Array<{ date: string; return: number }> {
  const result: Array<{ date: string; return: number }> = [];
  // navData sorted DESC
  const reversed = [...navData].reverse(); // ASC

  for (let i = reversed.length - 1; i >= 0; i--) {
    const endPoint = reversed[i];
    const endDate = parseISO(endPoint.date);
    const startDate = subYears(endDate, windowYears);
    const startStr = formatDate(startDate);

    // Find start nav
    const startPoint = reversed.find((p) => p.date >= startStr);
    if (!startPoint) continue;

    const daysDiff = differenceInDays(endDate, parseISO(startPoint.date));
    if (daysDiff < windowYears * 365 * 0.85) continue; // need at least 85% of the period

    const years = daysDiff / 365;
    const ret = calculateCAGR(startPoint.nav, endPoint.nav, years) * 100;
    result.push({ date: endPoint.date, return: parseFloat(ret.toFixed(2)) });

    // Only keep monthly data points for rolling chart
    i -= 20; // skip ~20 trading days (1 month) at a time
  }

  return result.reverse();
}
