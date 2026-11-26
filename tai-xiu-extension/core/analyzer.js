/**
 * TAI XIU PRO - Pattern & Historical Analyzer Module
 * Analyzes session history, detects patterns (Cầu bệt, Cầu đảo, 1-2, 2-2),
 * computes windowed statistics, and applies probability theory.
 */

import { getTheoreticalProbabilities } from './probability.js';
import { calcWilsonScoreInterval, calcZScore, analyzeStreaks, calcTransitionMatrix } from './statistics.js';

/**
 * Identify patterns ("Soi cầu") from the tail of the session history.
 * @param {Array<{result: 'tai' | 'xiu' | 'triple'}>} sessions Ordered chronologically (oldest to newest)
 * @returns {object} Detected patterns and active pattern details
 */
export function detectPatterns(sessions) {
  if (!sessions || sessions.length < 3) {
    return {
      activePattern: {
        name: 'Chưa đủ dữ liệu',
        description: 'Cần tối thiểu 3-5 phiên để nhận diện dạng cầu.',
        confidence: 'N/A',
        badge: 'info'
      },
      streakInfo: null,
      detectedTypes: []
    };
  }

  const results = sessions.map(s => s.result);
  const n = results.length;
  const lastRes = results[n - 1];

  // 1. Check Cầu Bệt (consecutive identical results >= 3)
  let betCount = 1;
  for (let i = n - 2; i >= 0; i--) {
    if (results[i] === lastRes) {
      betCount++;
    } else {
      break;
    }
  }

  // 2. Check Cầu Đảo / Cầu 1-1 (alternating T-X-T-X)
  let daoCount = 1;
  let expectedAlt = lastRes === 'tai' ? 'xiu' : (lastRes === 'xiu' ? 'tai' : null);
  if (expectedAlt) {
    for (let i = n - 2; i >= 0; i--) {
      if (results[i] === expectedAlt) {
        daoCount++;
        expectedAlt = expectedAlt === 'tai' ? 'xiu' : 'tai';
      } else {
        break;
      }
    }
  }

  // 3. Check Cầu 2-2 (TT-XX-TT...)
  let is22Pattern = false;
  let len22 = 0;
  if (n >= 4) {
    const tail4 = results.slice(-4);
    if ((tail4[0] === tail4[1] && tail4[2] === tail4[3] && tail4[0] !== tail4[2] && tail4[0] !== 'triple' && tail4[2] !== 'triple')) {
      is22Pattern = true;
      len22 = 4;
      if (n >= 6) {
        const tail6 = results.slice(-6);
        if (tail6[0] === tail6[1] && tail6[0] === tail4[0]) len22 = 6;
      }
    }
  }

  // 4. Check Cầu 1-2 hoặc 2-1
  let is12Pattern = false;
  if (n >= 3) {
    const tail3 = results.slice(-3);
    if (tail3[0] !== tail3[1] && tail3[1] === tail3[2] && tail3[0] !== 'triple' && tail3[1] !== 'triple') {
      is12Pattern = true; // 1-2
    } else if (tail3[0] === tail3[1] && tail3[1] !== tail3[2] && tail3[0] !== 'triple' && tail3[2] !== 'triple') {
      is12Pattern = true; // 2-1
    }
  }

  const detectedTypes = [];
  let activePattern = {
    name: 'Cầu ngẫu nhiên',
    description: 'Chưa có chuỗi lặp rõ rệt. Các biến cố phân tán ngẫu nhiên tự nhiên.',
    badge: 'secondary',
    length: 1
  };

  if (betCount >= 3) {
    const typeName = lastRes === 'tai' ? 'Tài' : (lastRes === 'xiu' ? 'Xỉu' : 'Bộ ba');
    detectedTypes.push('Cầu Bệt');
    activePattern = {
      name: `Cầu Bệt ${typeName} (${betCount} phiên)`,
      description: `Đang xuất hiện chuỗi ${betCount} phiên ${typeName} liên tiếp. Theo lý thuyết xác suất, lần gieo tiếp theo vẫn độc lập (P = 48.61%).`,
      badge: 'bet',
      length: betCount
    };
  } else if (daoCount >= 3) {
    detectedTypes.push('Cầu Đảo (1-1)');
    activePattern = {
      name: `Cầu Đảo 1-1 (${daoCount} nhịp)`,
      description: `Đang có chuỗi xen kẽ Tài - Xỉu qua ${daoCount} phiên. Tính ngẫu nhiên cho thấy chuỗi đảo có thể đứt gãy bất kỳ lúc nào.`,
      badge: 'dao',
      length: daoCount
    };
  } else if (is22Pattern) {
    detectedTypes.push('Cầu 2-2');
    activePattern = {
      name: `Cầu 2-2 (${len22} phiên)`,
      description: `Dạng chuỗi cặp đôi (2 Tài - 2 Xỉu). Thống kê độc lập: xác suất không bị ràng buộc bởi nhịp 2-2.`,
      badge: 'pattern',
      length: len22
    };
  } else if (is12Pattern) {
    detectedTypes.push('Cầu 1-2 / 2-1');
    activePattern = {
      name: 'Nhịp Cầu 1-2 / 2-1',
      description: 'Nhịp đơn đôi xen kẽ ngắn hạn trong dữ liệu gần đây.',
      badge: 'pattern',
      length: 3
    };
  }

  return {
    activePattern,
    detectedTypes,
    betLength: betCount,
    daoLength: daoCount
  };
}

/**
 * Perform comprehensive analysis on a given list of sessions.
 * @param {Array<{id: string, timestamp: number, dice: [number, number, number], sum: number, result: 'tai' | 'xiu' | 'triple'}>} allSessions
 * @param {number|'all'} windowSize Window filter (10, 20, 50, 100, 500, or 'all')
 * @returns {object} Comprehensive analysis report
 */
export function analyzeSessions(allSessions, windowSize = 'all') {
  const theoretical = getTheoreticalProbabilities();

  if (!allSessions || allSessions.length === 0) {
    return {
      totalAnalyzed: 0,
      windowSize,
      summary: null,
      theoretical,
      streaks: analyzeStreaks([]),
      patterns: detectPatterns([]),
      transitions: calcTransitionMatrix([]),
      sumDistribution: theoretical.sumDistribution.map(item => ({
        sum: item.sum,
        observedCount: 0,
        theoreticalCount: 0,
        empiricalProb: 0,
        empiricalPercent: '0.00%',
        theoreticalProb: item.probability,
        theoreticalPercent: item.percentageFormatted,
        diffPercent: 0
      }))
    };
  }

  // Filter window: chronological order
  const filtered = windowSize === 'all'
    ? [...allSessions]
    : allSessions.slice(-Number(windowSize));

  const n = filtered.length;
  let taiCount = 0;
  let xiuCount = 0;
  let tripleCount = 0;

  // Track sum occurrences in filtered window
  const sumCounts = {};
  for (let s = 3; s <= 18; s++) sumCounts[s] = 0;

  // Track individual dice faces
  const faceCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  for (const session of filtered) {
    if (session.result === 'tai') taiCount++;
    else if (session.result === 'xiu') xiuCount++;
    else if (session.result === 'triple') tripleCount++;

    sumCounts[session.sum] = (sumCounts[session.sum] || 0) + 1;

    if (session.dice && Array.isArray(session.dice)) {
      for (const d of session.dice) {
        if (faceCounts[d] !== undefined) faceCounts[d]++;
      }
    }
  }

  // Percentages & Confidence Intervals
  const pTai = n > 0 ? taiCount / n : 0;
  const pXiu = n > 0 ? xiuCount / n : 0;
  const pTriple = n > 0 ? tripleCount / n : 0;

  const ciTai = calcWilsonScoreInterval(taiCount, n, 0.95);
  const ciXiu = calcWilsonScoreInterval(xiuCount, n, 0.95);
  const ciTriple = calcWilsonScoreInterval(tripleCount, n, 0.95);

  const zTestTai = calcZScore(taiCount, n, theoretical.tai.probability);
  const zTestXiu = calcZScore(xiuCount, n, theoretical.xiu.probability);

  // Sum distribution comparison
  const sumDistribution = theoretical.sumDistribution.map(theoItem => {
    const observed = sumCounts[theoItem.sum] || 0;
    const empiricalProb = n > 0 ? observed / n : 0;
    return {
      sum: theoItem.sum,
      observedCount: observed,
      theoreticalCount: Number((theoItem.probability * n).toFixed(1)),
      empiricalProb,
      empiricalPercent: (empiricalProb * 100).toFixed(2) + '%',
      theoreticalProb: theoItem.probability,
      theoreticalPercent: (theoItem.probability * 100).toFixed(2) + '%',
      diffPercent: Number(((empiricalProb - theoItem.probability) * 100).toFixed(2))
    };
  });

  // Streaks, patterns, transitions
  const streaks = analyzeStreaks(filtered);
  const patterns = detectPatterns(filtered);
  const transitions = calcTransitionMatrix(filtered);

  return {
    totalAnalyzed: n,
    windowSize,
    summary: {
      tai: {
        count: taiCount,
        empiricalProb: pTai,
        empiricalPercent: (pTai * 100).toFixed(2) + '%',
        theoreticalPercent: theoretical.tai.displayPercent,
        deltaPercent: ((pTai - theoretical.tai.probability) * 100).toFixed(2) + '%',
        ci95: ciTai,
        zTest: zTestTai
      },
      xiu: {
        count: xiuCount,
        empiricalProb: pXiu,
        empiricalPercent: (pXiu * 100).toFixed(2) + '%',
        theoreticalPercent: theoretical.xiu.displayPercent,
        deltaPercent: ((pXiu - theoretical.xiu.probability) * 100).toFixed(2) + '%',
        ci95: ciXiu,
        zTest: zTestXiu
      },
      triple: {
        count: tripleCount,
        empiricalProb: pTriple,
        empiricalPercent: (pTriple * 100).toFixed(2) + '%',
        theoreticalPercent: theoretical.triple.displayPercent,
        deltaPercent: ((pTriple - theoretical.triple.probability) * 100).toFixed(2) + '%',
        ci95: ciTriple
      }
    },
    theoretical,
    streaks,
    patterns,
    transitions,
    sumDistribution,
    faceCounts,
    scientificDisclaimer: {
      title: 'Khoa học Xác suất & Ngụy biện Con Bạc (Gambler\'s Fallacy)',
      keyPoints: [
        'Biến cố độc lập: Mỗi lần gieo xúc xắc là một sự kiện hoàn toàn độc lập P(A ∩ B) = P(A) · P(B). Xúc xắc không có bộ nhớ về các lần trước.',
        'Quy luật chuỗi: Dù Tài đã xuất hiện 10 lần liên tiếp, xác suất lần thứ 11 ra Tài vẫn chính xác là 48.61%, không hề giảm xuống hay tăng lên.',
        'Lợi thế nhà cái (House Edge): Xuất hiện do 6 tổ hợp Bộ ba (2.78%). Khi về Bộ ba, người chơi cược Tài hoặc Xỉu đều thua.',
        'Luật số lớn (Law of Large Numbers): Tỷ lệ thực tế chỉ tiệm cận xác suất lý thuyết 48.61% khi số lượng phiên tiến dần đến vô cùng.'
      ]
    }
  };
}
