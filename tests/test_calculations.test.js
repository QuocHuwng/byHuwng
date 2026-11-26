/**
 * TAI XIU PRO - Unit Test Suite
 * Validates combinatorics, theoretical probabilities, simulation engine,
 * Wilson score interval, and streak/pattern analysis.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSampleSpace, classifyRoll, getTheoreticalProbabilities } from '../core/probability.js';
import { runMonteCarlo } from '../core/simulation.js';
import { calcWilsonScoreInterval, calcBinomialProbability, calcZScore, analyzeStreaks, calcTransitionMatrix } from '../core/statistics.js';
import { detectPatterns, analyzeSessions } from '../core/analyzer.js';

test('Sample Space contains exactly 216 combinations', () => {
  const space = generateSampleSpace();
  assert.equal(space.length, 216);

  // Check all sums are within [3, 18]
  for (const outcome of space) {
    assert.ok(outcome.sum >= 3 && outcome.sum <= 18);
    assert.ok(outcome.d1 >= 1 && outcome.d1 <= 6);
    assert.ok(outcome.d2 >= 1 && outcome.d2 <= 6);
    assert.ok(outcome.d3 >= 1 && outcome.d3 <= 6);
  }
});

test('Theoretical probabilities match Tài Xỉu exact mathematical rules', () => {
  const theo = getTheoreticalProbabilities();

  assert.equal(theo.totalOutcomes, 216);
  assert.equal(theo.tai.count, 105, 'Tài must have exactly 105 outcomes');
  assert.equal(theo.xiu.count, 105, 'Xỉu must have exactly 105 outcomes');
  assert.equal(theo.triple.count, 6, 'Triples must have exactly 6 outcomes');

  // Verify percentages
  // 105 / 216 = 0.4861111...
  assert.equal(theo.tai.percentage, 48.6111);
  assert.equal(theo.xiu.percentage, 48.6111);
  assert.equal(theo.triple.percentage, 2.7778);

  assert.equal(theo.tai.displayPercent, '48.61%');
  assert.equal(theo.xiu.displayPercent, '48.61%');
  assert.equal(theo.triple.displayPercent, '2.78%');

  // Verify total sum combinations count
  const sum3 = theo.sumDistribution.find(s => s.sum === 3);
  const sum4 = theo.sumDistribution.find(s => s.sum === 4);
  const sum10 = theo.sumDistribution.find(s => s.sum === 10);
  const sum11 = theo.sumDistribution.find(s => s.sum === 11);
  const sum17 = theo.sumDistribution.find(s => s.sum === 17);
  const sum18 = theo.sumDistribution.find(s => s.sum === 18);

  assert.equal(sum3.count, 1); // (1,1,1)
  assert.equal(sum4.count, 3);
  assert.equal(sum10.count, 27);
  assert.equal(sum11.count, 27);
  assert.equal(sum17.count, 3);
  assert.equal(sum18.count, 1); // (6,6,6)

  // Verify sum of all combination counts is 216
  const totalCounts = theo.sumDistribution.reduce((acc, curr) => acc + curr.count, 0);
  assert.equal(totalCounts, 216);
});

test('classifyRoll correctly identifies Tài, Xỉu, and Triples', () => {
  // Triple 1-1-1 (sum 3)
  const roll3 = classifyRoll(1, 1, 1);
  assert.equal(roll3.result, 'triple');
  assert.equal(roll3.sum, 3);
  assert.equal(roll3.isTriple, true);
  assert.equal(roll3.tripleValue, 1);

  // Triple 6-6-6 (sum 18)
  const roll18 = classifyRoll(6, 6, 6);
  assert.equal(roll18.result, 'triple');
  assert.equal(roll18.sum, 18);
  assert.equal(roll18.isTriple, true);
  assert.equal(roll18.tripleValue, 6);

  // Triple 4-4-4 (sum 12 - would be Tài if not triple, but triple overrides!)
  const roll12 = classifyRoll(4, 4, 4);
  assert.equal(roll12.result, 'triple');
  assert.equal(roll12.sum, 12);
  assert.equal(roll12.isTriple, true);

  // Xỉu (sum 4-10 non-triple)
  const rollXiu = classifyRoll(1, 2, 4); // sum 7
  assert.equal(rollXiu.result, 'xiu');
  assert.equal(rollXiu.sum, 7);
  assert.equal(rollXiu.isTriple, false);

  // Tài (sum 11-17 non-triple)
  const rollTai = classifyRoll(4, 5, 5); // sum 14, double 5
  assert.equal(rollTai.result, 'tai');
  assert.equal(rollTai.sum, 14);
  assert.equal(rollTai.isDouble, true);
  assert.equal(rollTai.doubleValue, 5);
});

test('Monte Carlo simulation runs fast and converges close to theoretical values', () => {
  const result = runMonteCarlo(100000);
  assert.equal(result.iterations, 100000);
  assert.ok(result.executionTimeMs < 1000, `Execution took ${result.executionTimeMs}ms, should be under 1000ms`);

  // Check convergence within 3 sigma (~0.5%)
  assert.ok(Math.abs(result.results.tai.empiricalPercent - 48.61) < 1.0, `Tai empirical: ${result.results.tai.empiricalPercent}%`);
  assert.ok(Math.abs(result.results.xiu.empiricalPercent - 48.61) < 1.0, `Xiu empirical: ${result.results.xiu.empiricalPercent}%`);
  assert.ok(Math.abs(result.results.triple.empiricalPercent - 2.78) < 0.5, `Triple empirical: ${result.results.triple.empiricalPercent}%`);
});

test('Wilson Score Interval calculates valid confidence boundaries', () => {
  // 50 successes out of 100
  const ci = calcWilsonScoreInterval(50, 100, 0.95);
  assert.ok(ci.lower > 0.39 && ci.lower < 0.42);
  assert.ok(ci.upper > 0.58 && ci.upper < 0.62);
  assert.ok(ci.lower < ci.upper);
});

test('Streak and Pattern analyzers correctly detect Cầu Bệt and Cầu Đảo', () => {
  const betSessions = [
    { result: 'xiu' },
    { result: 'tai' },
    { result: 'tai' },
    { result: 'tai' },
    { result: 'tai' }
  ];
  const betAnalysis = detectPatterns(betSessions);
  assert.equal(betAnalysis.betLength, 4);
  assert.ok(betAnalysis.activePattern.name.includes('Cầu Bệt Tài'));

  const daoSessions = [
    { result: 'xiu' },
    { result: 'tai' },
    { result: 'xiu' },
    { result: 'tai' },
    { result: 'xiu' }
  ];
  const daoAnalysis = detectPatterns(daoSessions);
  assert.equal(daoAnalysis.daoLength, 5);
  assert.ok(daoAnalysis.activePattern.name.includes('Cầu Đảo'));
});

test('analyzeSessions correctly handles empty and populated history', () => {
  const emptyAnalysis = analyzeSessions([]);
  assert.equal(emptyAnalysis.totalAnalyzed, 0);

  const sampleSessions = [
    { id: '1', timestamp: Date.now(), dice: [1, 2, 3], sum: 6, result: 'xiu' },
    { id: '2', timestamp: Date.now(), dice: [4, 5, 6], sum: 15, result: 'tai' },
    { id: '3', timestamp: Date.now(), dice: [2, 2, 2], sum: 6, result: 'triple' }
  ];

  const analysis = analyzeSessions(sampleSessions, 'all');
  assert.equal(analysis.totalAnalyzed, 3);
  assert.equal(analysis.summary.tai.count, 1);
  assert.equal(analysis.summary.xiu.count, 1);
  assert.equal(analysis.summary.triple.count, 1);
});
