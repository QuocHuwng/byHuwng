/**
 * TAI XIU PRO - Monte Carlo Simulation Module
 * High-performance stochastic simulation engine for 3-dice Tài Xỉu.
 * Supports up to 1,000,000+ iterations with sub-100ms execution.
 */

import { getTheoreticalProbabilities } from './probability.js';

/**
 * Run a Monte Carlo simulation for Tài Xỉu.
 * @param {number} iterations Number of simulated rolls (default 100,000)
 * @returns {object} Comprehensive simulation report
 */
export function runMonteCarlo(iterations = 100000) {
  const N = Math.max(100, Math.min(iterations, 2000000));
  const theoretical = getTheoreticalProbabilities();

  let simTai = 0;
  let simXiu = 0;
  let simTriples = 0;

  // Use Uint32Array for fast counting of sums 3 to 18
  const sumCounts = new Uint32Array(19);

  // Track streaks during simulation
  let currentStreakType = null;
  let currentStreakLen = 0;
  let maxTaiStreak = 0;
  let maxXiuStreak = 0;

  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  for (let i = 0; i < N; i++) {
    // Fast PRNG integer in [1, 6]
    const d1 = (Math.random() * 6 | 0) + 1;
    const d2 = (Math.random() * 6 | 0) + 1;
    const d3 = (Math.random() * 6 | 0) + 1;

    const sum = d1 + d2 + d3;
    sumCounts[sum]++;

    const isTriple = (d1 === d2 && d2 === d3);

    if (isTriple) {
      simTriples++;
      currentStreakType = 'triple';
      currentStreakLen = 1;
    } else if (sum >= 11) {
      simTai++;
      if (currentStreakType === 'tai') {
        currentStreakLen++;
      } else {
        currentStreakType = 'tai';
        currentStreakLen = 1;
      }
      if (currentStreakLen > maxTaiStreak) maxTaiStreak = currentStreakLen;
    } else {
      simXiu++;
      if (currentStreakType === 'xiu') {
        currentStreakLen++;
      } else {
        currentStreakType = 'xiu';
        currentStreakLen = 1;
      }
      if (currentStreakLen > maxXiuStreak) maxXiuStreak = currentStreakLen;
    }
  }

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const executionTimeMs = Number((endTime - startTime).toFixed(2));

  // Compute empirical probabilities
  const pTai = simTai / N;
  const pXiu = simXiu / N;
  const pTriple = simTriples / N;

  // Standard errors: SE = sqrt(p * (1-p) / N)
  const seTai = Math.sqrt((theoretical.tai.probability * (1 - theoretical.tai.probability)) / N);
  const seXiu = Math.sqrt((theoretical.xiu.probability * (1 - theoretical.xiu.probability)) / N);
  const seTriple = Math.sqrt((theoretical.triple.probability * (1 - theoretical.triple.probability)) / N);

  // Chi-Square goodness-of-fit for sum distribution (degrees of freedom: 16 - 1 = 15)
  let chiSquareSum = 0;
  const sumDistribution = [];

  for (let s = 3; s <= 18; s++) {
    const observed = sumCounts[s];
    const empiricalProb = observed / N;
    const theoItem = theoretical.sumDistribution.find(item => item.sum === s);
    const expected = theoItem.probability * N;

    const diff = observed - expected;
    chiSquareSum += (diff * diff) / expected;

    sumDistribution.push({
      sum: s,
      observedCount: observed,
      expectedCount: Number(expected.toFixed(1)),
      empiricalProb: Number(empiricalProb.toFixed(5)),
      empiricalPercent: Number((empiricalProb * 100).toFixed(3)),
      theoreticalProb: theoItem.probability,
      theoreticalPercent: Number((theoItem.probability * 100).toFixed(3)),
      diffPercent: Number(((empiricalProb - theoItem.probability) * 100).toFixed(3))
    });
  }

  return {
    iterations: N,
    executionTimeMs,
    results: {
      tai: {
        count: simTai,
        empiricalProb: pTai,
        empiricalPercent: Number((pTai * 100).toFixed(3)),
        theoreticalProb: theoretical.tai.probability,
        theoreticalPercent: Number((theoretical.tai.probability * 100).toFixed(3)),
        deltaPercent: Number(((pTai - theoretical.tai.probability) * 100).toFixed(3)),
        standardError: Number(seTai.toFixed(6)),
        marginOfError95: Number((1.96 * seTai * 100).toFixed(3)),
        maxStreak: maxTaiStreak
      },
      xiu: {
        count: simXiu,
        empiricalProb: pXiu,
        empiricalPercent: Number((pXiu * 100).toFixed(3)),
        theoreticalProb: theoretical.xiu.probability,
        theoreticalPercent: Number((theoretical.xiu.probability * 100).toFixed(3)),
        deltaPercent: Number(((pXiu - theoretical.xiu.probability) * 100).toFixed(3)),
        standardError: Number(seXiu.toFixed(6)),
        marginOfError95: Number((1.96 * seXiu * 100).toFixed(3)),
        maxStreak: maxXiuStreak
      },
      triple: {
        count: simTriples,
        empiricalProb: pTriple,
        empiricalPercent: Number((pTriple * 100).toFixed(3)),
        theoreticalProb: theoretical.triple.probability,
        theoreticalPercent: Number((theoretical.triple.probability * 100).toFixed(3)),
        deltaPercent: Number(((pTriple - theoretical.triple.probability) * 100).toFixed(3)),
        standardError: Number(seTriple.toFixed(6)),
        marginOfError95: Number((1.96 * seTriple * 100).toFixed(3))
      }
    },
    sumDistribution,
    chiSquare: {
      statistic: Number(chiSquareSum.toFixed(3)),
      degreesOfFreedom: 15,
      // Critical value for 15 df at alpha = 0.05 is 24.996
      criticalValue95: 24.996,
      fitsTheoreticalModel: chiSquareSum <= 24.996
    }
  };
}
