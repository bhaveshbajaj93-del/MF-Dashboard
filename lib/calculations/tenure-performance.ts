import { NavPoint, calculateCAGR } from "./returns";
import { calculateRiskMetrics } from "./risk-metrics";
import { differenceInDays, parseISO } from "date-fns";

export interface TenureStats {
  tenureReturnCagr: number | null;
  tenureBenchmarkCagr: number | null;
  tenureAlpha: number | null;
  tenureSharpe: number | null;
  tenureMaxDrawdown: number | null;
}

/**
 * Calculate performance stats for a manager's tenure at a fund.
 * fundNav and benchNav must be ASC sorted.
 */
export function calculateTenurePerformance(
  fundNav: NavPoint[],
  benchNav: NavPoint[],
  startDate: string,
  endDate: string,
  riskFreeAnnual: number
): TenureStats {
  const fundSlice = fundNav.filter((p) => p.date >= startDate && p.date <= endDate);
  const benchSlice = benchNav.filter((p) => p.date >= startDate && p.date <= endDate);

  if (fundSlice.length < 5) {
    return { tenureReturnCagr: null, tenureBenchmarkCagr: null, tenureAlpha: null, tenureSharpe: null, tenureMaxDrawdown: null };
  }

  const days = differenceInDays(parseISO(endDate), parseISO(startDate));
  const years = Math.max(days / 365, 0.01);

  const fundStart = fundSlice[0].nav;
  const fundEnd = fundSlice[fundSlice.length - 1].nav;
  const tenureReturnCagr = calculateCAGR(fundStart, fundEnd, years) * 100;

  let tenureBenchmarkCagr: number | null = null;
  if (benchSlice.length >= 5) {
    const bStart = benchSlice[0].nav;
    const bEnd = benchSlice[benchSlice.length - 1].nav;
    tenureBenchmarkCagr = calculateCAGR(bStart, bEnd, years) * 100;
  }

  const tenureAlpha =
    tenureReturnCagr !== null && tenureBenchmarkCagr !== null
      ? tenureReturnCagr - tenureBenchmarkCagr
      : null;

  // Use a simplified Sharpe for shorter tenures
  const metrics = calculateRiskMetrics(fundSlice, benchSlice, riskFreeAnnual, years);

  return {
    tenureReturnCagr: tenureReturnCagr !== null ? parseFloat(tenureReturnCagr.toFixed(2)) : null,
    tenureBenchmarkCagr: tenureBenchmarkCagr !== null ? parseFloat(tenureBenchmarkCagr.toFixed(2)) : null,
    tenureAlpha: tenureAlpha !== null ? parseFloat(tenureAlpha.toFixed(2)) : null,
    tenureSharpe: metrics.sharpe,
    tenureMaxDrawdown: metrics.maxDrawdown,
  };
}
