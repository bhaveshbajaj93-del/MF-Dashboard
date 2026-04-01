import { NavPoint } from "./returns";
import { parseISO, subYears, differenceInDays } from "date-fns";

const TRADING_DAYS_PER_YEAR = 252;

export interface RiskMetrics {
  stdDev: number | null;       // annualised std dev (%)
  sharpe: number | null;       // (annualised return - Rf) / annualised stdDev
  sortino: number | null;      // (annualised return - Rf) / downside stdDev
  beta: number | null;         // Cov(fund, bench) / Var(bench)
  alpha: number | null;        // fund return - [Rf + beta*(bench - Rf)]  (annualised %)
  treynor: number | null;      // (fund return - Rf) / beta
  maxDrawdown: number | null;  // max peak-to-trough drawdown (%)
}

function dailyReturns(navData: NavPoint[]): number[] {
  // navData assumed ASC sorted
  const returns: number[] = [];
  for (let i = 1; i < navData.length; i++) {
    returns.push((navData[i].nav - navData[i - 1].nav) / navData[i - 1].nav);
  }
  return returns;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDeviation(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function annualise(dailyVal: number, periods = TRADING_DAYS_PER_YEAR): number {
  return dailyVal * Math.sqrt(periods);
}

function maxDrawdownCalc(navData: NavPoint[]): number {
  let peak = -Infinity;
  let maxDD = 0;
  for (const point of navData) {
    if (point.nav > peak) peak = point.nav;
    const dd = (peak - point.nav) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

/**
 * Calculate risk metrics for a given lookback period.
 * @param fundNav   NAV history for the fund (ASC sorted)
 * @param benchNav  NAV history for benchmark (ASC sorted, same index)
 * @param riskFreeAnnual  risk-free rate (e.g. 0.065 for 6.5%)
 * @param yearsBack lookback window (1 or 3)
 */
export function calculateRiskMetrics(
  fundNav: NavPoint[],
  benchNav: NavPoint[],
  riskFreeAnnual: number,
  yearsBack: number
): RiskMetrics {
  if (fundNav.length < 60) {
    return { stdDev: null, sharpe: null, sortino: null, beta: null, alpha: null, treynor: null, maxDrawdown: null };
  }

  const latestDate = parseISO(fundNav[fundNav.length - 1].date);
  const cutoff = subYears(latestDate, yearsBack);
  const cutStr = cutoff.toISOString().split("T")[0];

  const fundSlice = fundNav.filter((p) => p.date >= cutStr);
  const benchSlice = benchNav.filter((p) => p.date >= cutStr);

  if (fundSlice.length < 30) {
    return { stdDev: null, sharpe: null, sortino: null, beta: null, alpha: null, treynor: null, maxDrawdown: null };
  }

  const fundDailyRet = dailyReturns(fundSlice);
  const days = differenceInDays(latestDate, cutoff);
  const years = days / 365;

  // Annualised return
  const startNav = fundSlice[0].nav;
  const endNav = fundSlice[fundSlice.length - 1].nav;
  const annualisedReturn = (Math.pow(endNav / startNav, 1 / years) - 1) * 100;

  // Std Dev
  const dailyStd = stdDeviation(fundDailyRet);
  const annualisedStd = annualise(dailyStd) * 100;

  // Risk-free daily
  const rfDaily = riskFreeAnnual / TRADING_DAYS_PER_YEAR;
  const rfAnnual = riskFreeAnnual * 100;

  // Sharpe
  const excessReturn = annualisedReturn - rfAnnual;
  const sharpe = annualisedStd > 0 ? excessReturn / annualisedStd : null;

  // Sortino (downside std dev = only negative returns below Rf)
  const downsideReturns = fundDailyRet.filter((r) => r < rfDaily);
  let sortino: number | null = null;
  if (downsideReturns.length > 0) {
    const downsideVariance = downsideReturns.reduce((acc, r) => acc + Math.pow(r - rfDaily, 2), 0) / fundDailyRet.length;
    const downsideStd = Math.sqrt(downsideVariance) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
    sortino = downsideStd > 0 ? excessReturn / downsideStd : null;
  }

  // Beta and Alpha (require benchmark data)
  let beta: number | null = null;
  let alpha: number | null = null;
  let treynor: number | null = null;

  if (benchSlice.length >= 30) {
    const benchDailyRet = dailyReturns(benchSlice);

    // Align fund and bench returns by date
    const fundMap = new Map<string, number>();
    for (let i = 1; i < fundSlice.length; i++) {
      fundMap.set(fundSlice[i].date, (fundSlice[i].nav - fundSlice[i - 1].nav) / fundSlice[i - 1].nav);
    }
    const benchMap = new Map<string, number>();
    for (let i = 1; i < benchSlice.length; i++) {
      benchMap.set(benchSlice[i].date, (benchSlice[i].nav - benchSlice[i - 1].nav) / benchSlice[i - 1].nav);
    }

    const commonDates = Array.from(fundMap.keys()).filter((d) => benchMap.has(d));
    if (commonDates.length >= 30) {
      const fx = commonDates.map((d) => fundMap.get(d)!);
      const bx = commonDates.map((d) => benchMap.get(d)!);
      const fMean = mean(fx);
      const bMean = mean(bx);

      let cov = 0, varB = 0;
      for (let i = 0; i < commonDates.length; i++) {
        cov += (fx[i] - fMean) * (bx[i] - bMean);
        varB += Math.pow(bx[i] - bMean, 2);
      }
      cov /= commonDates.length;
      varB /= commonDates.length;

      if (varB > 0) {
        beta = cov / varB;

        // Benchmark annualised return
        const bStart = benchSlice[0].nav;
        const bEnd = benchSlice[benchSlice.length - 1].nav;
        const benchReturn = (Math.pow(bEnd / bStart, 1 / years) - 1) * 100;

        // Jensen's Alpha: Rf + beta*(Rm - Rf)
        alpha = annualisedReturn - (rfAnnual + beta * (benchReturn - rfAnnual));
        treynor = beta !== 0 ? excessReturn / beta : null;
      }
    }
  }

  const maxDrawdown = maxDrawdownCalc(fundSlice);

  return {
    stdDev: parseFloat(annualisedStd.toFixed(2)),
    sharpe: sharpe !== null ? parseFloat(sharpe.toFixed(3)) : null,
    sortino: sortino !== null ? parseFloat(sortino.toFixed(3)) : null,
    beta: beta !== null ? parseFloat(beta.toFixed(3)) : null,
    alpha: alpha !== null ? parseFloat(alpha.toFixed(2)) : null,
    treynor: treynor !== null ? parseFloat(treynor.toFixed(3)) : null,
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
  };
}
