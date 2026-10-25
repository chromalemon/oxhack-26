import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultScenario } from './analysis.js';
import { buildPitchSvg, buildTacticalReport } from './report.js';

test('tactical report includes placed players, recommendations, and model coverage', () => {
  const scenario = { ...createDefaultScenario(), name: 'Right half-space', notes: 'Look for the 8' };
  const report = buildTacticalReport(scenario);
  assert.match(report.text, /Right half-space/);
  assert.match(report.text, /Look for the 8/);
  assert.match(report.text, /Top recommendation/);
  assert.match(report.text, /placed 3 players/);
  assert.match(report.text, /Model 0.5-local/);
});

test('pitch svg encodes every marker from the user-built state', () => {
  const svg = buildPitchSvg(createDefaultScenario());
  assert.match(svg, /<svg /);
  assert.equal((svg.match(/<circle /g) || []).length, 4);
});
