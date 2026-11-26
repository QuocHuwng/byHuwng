/**
 * TAI XIU PRO - Statistics Core Module
 * Rigorous statistical calculations: Wilson score confidence intervals,
 * Binomial distributions, streak analysis, and Markov transition matrices.
 */

/**
 * Calculate Wilson Score Confidence Interval for a proportion.
 * Recommended by statisticians over the normal approximation, especially for small n.
 * @param {number} successes Number of successes (k)
 * @param {number} total Total number of trials (n)
 * @param {number} confidence Confidence level, e.g. 0.95 (default) or 0.99
 * @returns {{center: number, lower: number, upper: number, margin: number, lowerPercent: string, upperPercent: string}}
 */
export function calcWilsonScoreInterval(successes, total, confidence = 0.95) {
  if (total <= 0) {
    return { center: 0, lower: 0, upper: 0, margin: 0, lowerPercent: '0.00%', upperPercent: '0.00%' };
  }

  // Z critical value
  let z = 1.95996; // 95%
  if (confidence === 0.99) z = 2.57583;
  else if (confidence === 0.90) z = 1.64485;

  const n = total;
  const p = successes / n;
  const z2 = z * z;

  const denominator = 1 + z2 / n;
  const centerAdjusted = (p + z2 / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;

  const lower = Math.max(0, centerAdjusted - margin);
  const upper = Math.min(1, centerAdjusted + margin);

  return {
    center: centerAdjusted,
    lower,
    upper,
    margin,
    lowerPercent: (lower * 100).toFixed(2) + '%',
    upperPercent: (upper * 100).toFixed(2) + '%',
    displayRange: `${(lower * 100).toFixed(2)}% - ${(upper * 100).toFixed(2)}%`
  };
}

/**
 * Calculate log-factorial using Stirling/Ramanujan approximation for large numbers.
 */
function logFactorial(n) {
  if (n <= 1) return 0;
  if (n <= 10) {
    let f = 1;
    for (let i = 2; i <= n; i++) f *= i;
    return Math.log(f);
  }
  // Ramanujan's formula for ln(n!)
  return n * Math.log(n) - n + (Math.log(n * (1 + 4 * n * (1 + 2 * n)))) / 6 + Math.log(Math.PI) / 2;
}

/**
 * Calculate Binomial probability P(X = k) = C(n, k) * p^k * (1-p)^(n-k)
 * @param {number} n Total trials
 * @param {number} k Successes
 * @param {number} p Success probability per trial
 * @returns {number} Probability
 */
export function calcBinomialProbability(n, k, p) {
  if (k < 0 || k > n) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;

  // Use log scale to avoid floating point overflow
  const logComb = logFactorial(n) - logFactorial(k) - logFactorial(n - k);
  const logProb = logComb + k * Math.log(p) + (n - k) * Math.log(1 - p);
  return Math.exp(logProb);
}

/**
 * Calculate Z-Score and standard error for testing observed vs expected count.
 * @param {number} observed Observed successes
 * @param {number} total Total trials
 * @param {number} expectedProb Theoretical probability
 * @returns {{zScore: number, pValue: number, isSignificant: boolean}}
 */
export function calcZScore(observed, total, expectedProb) {
  if (total <= 0) return { zScore: 0, pValue: 1, isSignificant: false };
  const expected = total * expectedProb;
  const variance = total * expectedProb * (1 - expectedProb);
  const se = Math.sqrt(variance);
  if (se === 0) return { zScore: 0, pValue: 1, isSignificant: false };

  // Continuity correction
  const diff = observed - expected;
  const ccDiff = diff > 0 ? diff - 0.5 : (diff < 0 ? diff + 0.5 : 0);
  const z = ccDiff / se;

  // Approximate two-tailed p-value from standard normal
  const absZ = Math.abs(z);
  // Rational approximation for complementary error function
  const t = 1 / (1 + 0.2316419 * absZ);
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const phi = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * absZ * absZ);
  const tail = phi * poly;
  const pValue = 2 * tail;

  return {
    zScore: Number(z.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    isSignificant: pValue < 0.05
  };
}

/**
 * Analyze streaks (runs of consecutive identical results) in a history list.
 * @param {Array<{result: 'tai' | 'xiu' | 'triple'}>} sessions Ordered chronologically (oldest to newest)
 * @returns {object} Comprehensive streak metrics
 */
export function analyzeStreaks(sessions) {
  if (!sessions || sessions.length === 0) {
    return {
      currentStreak: { type: null, length: 0 },
      maxTaiStreak: 0,
      maxXiuStreak: 0,
      maxTripleStreak: 0,
      allStreaks: [],
      taiStreaks: [],
      xiuStreaks: [],
      streakDistribution: {},
      averageStreakTai: 0,
      averageStreakXiu: 0
    };
  }

  const streaks = [];
  let currentType = sessions[0].result;
  let currentLength = 1;
  let startIndex = 0;

  for (let i = 1; i < sessions.length; i++) {
    const res = sessions[i].result;
    if (res === currentType) {
      currentLength++;
    } else {
      streaks.push({
        type: currentType,
        length: currentLength,
        startIndex,
        endIndex: i - 1
      });
      currentType = res;
      currentLength = 1;
      startIndex = i;
    }
  }

  // Add the last ongoing streak
  streaks.push({
    type: currentType,
    length: currentLength,
    startIndex,
    endIndex: sessions.length - 1
  });

  const taiStreaks = streaks.filter(s => s.type === 'tai');
  const xiuStreaks = streaks.filter(s => s.type === 'xiu');
  const tripleStreaks = streaks.filter(s => s.type === 'triple');

  const maxTaiStreak = taiStreaks.reduce((max, s) => Math.max(max, s.length), 0);
  const maxXiuStreak = xiuStreaks.reduce((max, s) => Math.max(max, s.length), 0);
  const maxTripleStreak = tripleStreaks.reduce((max, s) => Math.max(max, s.length), 0);

  const avgTai = taiStreaks.length > 0
    ? Number((taiStreaks.reduce((sum, s) => sum + s.length, 0) / taiStreaks.length).toFixed(2))
    : 0;

  const avgXiu = xiuStreaks.length > 0
    ? Number((xiuStreaks.reduce((sum, s) => sum + s.length, 0) / xiuStreaks.length).toFixed(2))
    : 0;

  // Streak length histogram
  const streakDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, '6+': 0 };
  for (const s of streaks) {
    if (s.type === 'tai' || s.type === 'xiu') {
      if (s.length >= 6) streakDistribution['6+']++;
      else streakDistribution[s.length]++;
    }
  }

  const lastStreak = streaks[streaks.length - 1];

  return {
    currentStreak: {
      type: lastStreak.type,
      length: lastStreak.length,
      display: `${lastStreak.type === 'tai' ? 'Tài' : lastStreak.type === 'xiu' ? 'Xỉu' : 'Bộ ba'} (${lastStreak.length} phiên)`
    },
    maxTaiStreak,
    maxXiuStreak,
    maxTripleStreak,
    allStreaks: streaks,
    taiStreaks,
    xiuStreaks,
    streakDistribution,
    averageStreakTai: avgTai,
    averageStreakXiu: avgXiu
  };
}

/**
 * Calculate first-order Markov transition probabilities between outcomes.
 * @param {Array<{result: 'tai' | 'xiu' | 'triple'}>} sessions Ordered chronologically
 * @returns {object} Transition counts and probabilities
 */
export function calcTransitionMatrix(sessions) {
  const transitions = {
    'tai->tai': 0,
    'tai->xiu': 0,
    'tai->triple': 0,
    'xiu->xiu': 0,
    'xiu->tai': 0,
    'xiu->triple': 0,
    'triple->tai': 0,
    'triple->xiu': 0,
    'triple->triple': 0
  };

  if (!sessions || sessions.length < 2) {
    return { transitions, totalTransitions: 0, probabilities: {} };
  }

  for (let i = 0; i < sessions.length - 1; i++) {
    const from = sessions[i].result;
    const to = sessions[i + 1].result;
    const key = `${from}->${to}`;
    if (key in transitions) {
      transitions[key]++;
    }
  }

  const totalFromTai = transitions['tai->tai'] + transitions['tai->xiu'] + transitions['tai->triple'];
  const totalFromXiu = transitions['xiu->xiu'] + transitions['xiu->tai'] + transitions['xiu->triple'];

  const pTaiToTai = totalFromTai > 0 ? transitions['tai->tai'] / totalFromTai : 0;
  const pTaiToXiu = totalFromTai > 0 ? transitions['tai->xiu'] / totalFromTai : 0;
  const pXiuToXiu = totalFromXiu > 0 ? transitions['xiu->xiu'] / totalFromXiu : 0;
  const pXiuToTai = totalFromXiu > 0 ? transitions['xiu->tai'] / totalFromXiu : 0;

  return {
    transitions,
    totalTransitions: sessions.length - 1,
    probabilities: {
      taiToTai: Number((pTaiToTai * 100).toFixed(2)),
      taiToXiu: Number((pTaiToXiu * 100).toFixed(2)),
      xiuToXiu: Number((pXiuToXiu * 100).toFixed(2)),
      xiuToTai: Number((pXiuToTai * 100).toFixed(2))
    }
  };
}
