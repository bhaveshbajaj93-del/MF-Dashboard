/**
 * Calculates portfolio-level weighted averages of any stock-level metric.
 * Used for forward estimates and Screener.in custom formulas.
 */

export interface HoldingWeight {
  isin: string;
  percentage: number; // 0–100
}

export interface StockMetric {
  isin: string;
  value: number | null;
}

export interface WeightedResult {
  weightedAvg: number | null;
  coveragePct: number; // % of portfolio weight that had data
}

/**
 * Calculate weighted average of a metric across portfolio holdings.
 * Skips holdings where the metric value is null/undefined.
 */
export function weightedAverage(
  holdings: HoldingWeight[],
  metrics: StockMetric[]
): WeightedResult {
  const metricMap = new Map<string, number | null>();
  for (const m of metrics) {
    metricMap.set(m.isin, m.value);
  }

  let weightedSum = 0;
  let coveredWeight = 0;
  const totalWeight = holdings.reduce((s, h) => s + h.percentage, 0);

  for (const holding of holdings) {
    if (!holding.isin) continue;
    const value = metricMap.get(holding.isin);
    if (value !== null && value !== undefined && isFinite(value)) {
      weightedSum += holding.percentage * value;
      coveredWeight += holding.percentage;
    }
  }

  if (coveredWeight === 0 || totalWeight === 0) {
    return { weightedAvg: null, coveragePct: 0 };
  }

  // Normalise by covered weight (not total) to avoid bias from missing data
  const weightedAvg = weightedSum / coveredWeight;
  const coveragePct = (coveredWeight / totalWeight) * 100;

  return {
    weightedAvg: parseFloat(weightedAvg.toFixed(2)),
    coveragePct: parseFloat(coveragePct.toFixed(1)),
  };
}

/**
 * Calculate multiple metrics in one pass.
 * Returns Map<metricName, WeightedResult>
 */
export function weightedAverageMultiple(
  holdings: HoldingWeight[],
  metricsByName: Map<string, StockMetric[]>
): Map<string, WeightedResult> {
  const results = new Map<string, WeightedResult>();
  for (const [name, metrics] of Array.from(metricsByName.entries())) {
    results.set(name, weightedAverage(holdings, metrics));
  }
  return results;
}
