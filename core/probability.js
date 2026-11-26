/**
 * TAI XIU PRO - Probability Core Module
 * Combinatorics and theoretical probability calculations for 3-dice Tài Xỉu (Sic Bo).
 * All probabilities are computed dynamically from fundamental combinatorics (no hardcoding).
 */

/**
 * Generate the complete sample space of 3 fair 6-sided dice (Omega = 6^3 = 216 outcomes).
 * @returns {Array<{d1: number, d2: number, d3: number, sum: number, isTriple: boolean, result: 'tai' | 'xiu' | 'triple'}>}
 */
export function generateSampleSpace() {
  const outcomes = [];
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      for (let d3 = 1; d3 <= 6; d3++) {
        const sum = d1 + d2 + d3;
        const isTriple = (d1 === d2 && d2 === d3);
        let result = 'triple';
        if (!isTriple) {
          if (sum >= 11 && sum <= 17) {
            result = 'tai';
          } else if (sum >= 4 && sum <= 10) {
            result = 'xiu';
          }
        }
        outcomes.push({ d1, d2, d3, sum, isTriple, result });
      }
    }
  }
  return outcomes;
}

/**
 * Classify a specific 3-dice roll according to Tài Xỉu rules.
 * @param {number} d1 First die (1-6)
 * @param {number} d2 Second die (1-6)
 * @param {number} d3 Third die (1-6)
 * @returns {{sum: number, isTriple: boolean, tripleValue: number|null, result: 'tai' | 'xiu' | 'triple', isEven: boolean, isDouble: boolean, doubleValue: number|null}}
 */
export function classifyRoll(d1, d2, d3) {
  const v1 = Number(d1);
  const v2 = Number(d2);
  const v3 = Number(d3);

  if (![v1, v2, v3].every(v => Number.isInteger(v) && v >= 1 && v <= 6)) {
    throw new Error(`Giá trị xúc xắc không hợp lệ: [${d1}, ${d2}, ${d3}]. Mỗi viên phải từ 1 đến 6.`);
  }

  const sum = v1 + v2 + v3;
  const isTriple = (v1 === v2 && v2 === v3);
  const tripleValue = isTriple ? v1 : null;

  let result = 'triple';
  if (!isTriple) {
    if (sum >= 11 && sum <= 17) {
      result = 'tai';
    } else if (sum >= 4 && sum <= 10) {
      result = 'xiu';
    }
  }

  // Check doubles (bộ đôi)
  let isDouble = false;
  let doubleValue = null;
  if (!isTriple) {
    if (v1 === v2) { isDouble = true; doubleValue = v1; }
    else if (v1 === v3) { isDouble = true; doubleValue = v1; }
    else if (v2 === v3) { isDouble = true; doubleValue = v2; }
  }

  const isEven = (sum % 2 === 0);

  return {
    dice: [v1, v2, v3],
    sum,
    isTriple,
    tripleValue,
    result,
    isEven,
    isDouble,
    doubleValue
  };
}

/**
 * Compute full theoretical probabilities for Tài Xỉu.
 * Iterates through all 216 combinations dynamically.
 * @returns {object} Comprehensive theoretical metrics
 */
export function getTheoreticalProbabilities() {
  const space = generateSampleSpace();
  const totalOutcomes = space.length; // 216

  let taiCount = 0;
  let xiuCount = 0;
  let tripleCount = 0;
  let evenCount = 0;
  let oddCount = 0;

  // Sum distribution from 3 to 18
  const sumCounts = {};
  for (let s = 3; s <= 18; s++) {
    sumCounts[s] = {
      sum: s,
      count: 0,
      combinations: [],
      taiCount: 0,
      xiuCount: 0,
      tripleCount: 0
    };
  }

  // Face appearances
  const faceAppearances = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  for (const outcome of space) {
    const { d1, d2, d3, sum, isTriple, result } = outcome;

    if (result === 'tai') taiCount++;
    else if (result === 'xiu') xiuCount++;
    else if (result === 'triple') tripleCount++;

    if (sum % 2 === 0) evenCount++;
    else oddCount++;

    sumCounts[sum].count++;
    sumCounts[sum].combinations.push([d1, d2, d3]);
    if (result === 'tai') sumCounts[sum].taiCount++;
    else if (result === 'xiu') sumCounts[sum].xiuCount++;
    else if (result === 'triple') sumCounts[sum].tripleCount++;

    faceAppearances[d1]++;
    faceAppearances[d2]++;
    faceAppearances[d3]++;
  }

  // Build structured sum distribution
  const sumDistribution = [];
  for (let s = 3; s <= 18; s++) {
    const c = sumCounts[s].count;
    const prob = c / totalOutcomes;
    sumDistribution.push({
      sum: s,
      count: c,
      probability: prob,
      percentage: Number((prob * 100).toFixed(4)),
      percentageFormatted: (prob * 100).toFixed(2) + '%',
      taiCount: sumCounts[s].taiCount,
      xiuCount: sumCounts[s].xiuCount,
      tripleCount: sumCounts[s].tripleCount
    });
  }

  // Theoretical probability values
  const taiProbability = taiCount / totalOutcomes; // 105/216 = 0.486111...
  const xiuProbability = xiuCount / totalOutcomes; // 105/216 = 0.486111...
  const tripleProbability = tripleCount / totalOutcomes; // 6/216 = 0.02777...
  const houseEdge = tripleProbability; // 2.78% house advantage in standard rules

  return {
    totalOutcomes,
    tai: {
      count: taiCount,
      probability: taiProbability,
      percentage: Number((taiProbability * 100).toFixed(4)),
      displayPercent: (taiProbability * 100).toFixed(2) + '%'
    },
    xiu: {
      count: xiuCount,
      probability: xiuProbability,
      percentage: Number((xiuProbability * 100).toFixed(4)),
      displayPercent: (xiuProbability * 100).toFixed(2) + '%'
    },
    triple: {
      count: tripleCount,
      probability: tripleProbability,
      percentage: Number((tripleProbability * 100).toFixed(4)),
      displayPercent: (tripleProbability * 100).toFixed(2) + '%'
    },
    even: {
      count: evenCount,
      probability: evenCount / totalOutcomes,
      displayPercent: ((evenCount / totalOutcomes) * 100).toFixed(2) + '%'
    },
    odd: {
      count: oddCount,
      probability: oddCount / totalOutcomes,
      displayPercent: ((oddCount / totalOutcomes) * 100).toFixed(2) + '%'
    },
    houseEdge: {
      value: houseEdge,
      displayPercent: (houseEdge * 100).toFixed(2) + '%'
    },
    sumDistribution,
    // At least one specific face: 1 - (5/6)^3 = 91/216 = 42.13%
    singleFaceProbability: 91 / 216
  };
}
