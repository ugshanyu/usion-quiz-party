import { test } from 'node:test';
import assert from 'node:assert/strict';
import { points } from '../server/scoring.js';

test('wrong answers score 0', () => {
  assert.equal(points(false, 0, 20), 0);
  assert.equal(points(false, 5000, 20), 0);
});

test('instant correct answer scores 1000', () => {
  assert.equal(points(true, 0, 20), 1000);
});

test('correct at the full time limit scores 500', () => {
  assert.equal(points(true, 20000, 20), 500);
});

test('halfway scores 750', () => {
  assert.equal(points(true, 10000, 20), 750);
});

test('elapsed is clamped to the window (no negative or bonus points)', () => {
  assert.equal(points(true, 999999, 20), 500);
  assert.equal(points(true, -50, 20), 1000);
});

test('garbage inputs degrade safely', () => {
  assert.equal(points(true, NaN, 20), 1000);
  assert.equal(points(true, 0, 0), 1000);
});

test('point multiplier scales the score (default 1)', () => {
  assert.equal(points(true, 0, 20, 2), 2000);
  assert.equal(points(true, 20000, 20, 3), 1500);
  assert.equal(points(true, 0, 20, undefined), 1000);
  assert.equal(points(false, 0, 20, 5), 0);
  assert.equal(points(true, 0, 20, 99), 10000); // clamped to ×10
});
