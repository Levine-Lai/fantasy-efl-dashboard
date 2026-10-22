import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { number, validateBootstrap, normalizeHistory } from './generate-fpl-data.mjs';
const source = await readFile(new URL('../lib/fpl-data.ts', import.meta.url), 'utf8');
const { fplMetrics, matchSample, total, fplTeamRows, fplRankings, fplReferenceXI, fplShirt } = await import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64'));
assert.equal(number(null), null); assert.equal(number(''), null); assert.equal(number('not-a-number'), null); assert.equal(number('0.00'), 0);
const fixture = (id, event, finished = true) => ({ id, event, finished });
const base = { fixture: 1, kickoff_time: '2026-08-22T14:00:00Z', opponent_team: 2, was_home: true, minutes: 90, total_points: 6, goals_scored: 0, assists: 0, clean_sheets: 1, goals_conceded: 0, saves: 0, bonus: 0, bps: 22, starts: 1, expected_goals: '0.00', expected_assists: '0.10', expected_goal_involvements: '0.10', defensive_contribution: 10 };
const fixtures = new Map([fixture(1, 1), fixture(2, 1), fixture(3, 2), fixture(4, null), fixture(5, 2, false)].map(f => [f.id, f]));
const raw = [base, { ...base, fixture: 2, kickoff_time: '2026-08-25T14:00:00Z', minutes: 45, total_points: 2, defensive_contribution: 9 }, { ...base, fixture: 3, kickoff_time: '2026-08-29T14:00:00Z', minutes: 0 }, { ...base, fixture: 4 }, { ...base, fixture: 5 }];
const history = normalizeHistory(raw, fixtures);
assert.equal(history.length, 3, 'Ignore unfinished and unassigned fixtures');
assert.throws(() => normalizeHistory([base, base], fixtures), /duplicate/);
assert.throws(() => normalizeHistory([{ ...base, total_points: undefined }], fixtures), /invalid/);
const p = { id: 1, position: 'DEF', price: 5, ownership: 0, history };
const sample = matchSample(p, 1);
assert.equal(sample.length, 2, 'Double GW is two appearances');
assert.equal(matchSample(p, 2).length, 2, 'Exclude zero minute rows from appearance rates');
assert.equal(matchSample(p, 1, 1)[0].fixture, 2, 'Recent sample follows actual match date');
assert.equal(matchSample(p, 0).length, 0, 'No future rows');
const metric = key => fplMetrics.find(m => m.key === key);
assert.equal(metric('ppg').value(p, sample), 4);
assert.equal(metric('points90').value(p, sample), 8 * 90 / 135);
assert.equal(metric('xg').value(p, sample), 0, 'Real zero is retained');
assert.equal(metric('ownership').value(p, sample), 0);
assert.equal(metric('dcRate').value(p, sample), 50, 'DEF threshold is 10 per match');
assert.equal(metric('dcRate').value({ ...p, position: 'MID' }, sample), 0, 'MID threshold is 12 per match');
assert.equal(metric('defensive').value({ ...p, position: 'GK' }, sample), null);
assert.equal(metric('saves').value(p, sample), null);
assert.equal(metric('xg').value(p, [{ ...history[0], xg: null }]), null);
assert.equal(total([], 'minutes'), null);
assert.equal(total([{ ...history[0], xg: null }, history[1]], 'xg'), null, 'Partial missing numerator is never divided by all minutes');
const bootstrap = { elements: [{ id: 1, team: 1, element_type: 2, now_cost: 50, minutes: 90 }], teams: [{ id: 1 }], events: [{ deadline_time: '2026-08-21T17:30:00Z' }] };
assert.equal(validateBootstrap(bootstrap), '2026-27');
assert.throws(() => validateBootstrap({ ...bootstrap, elements: [...bootstrap.elements, ...bootstrap.elements] }), /duplicate/);
assert.throws(() => validateBootstrap({ ...bootstrap, elements: [{ ...bootstrap.elements[0], team: 99 }] }), /invalid/);
const data = JSON.parse(await readFile(new URL('../public/fpl/dashboard.json', import.meta.url), 'utf8'));
assert.equal(data.schemaVersion, 1); assert.ok(data.players.length); assert.ok(data.teams.length); assert.ok(data.events.some(e => e.id === data.currentEvent));
const teamIds = new Set(data.teams.map(t => t.id)), fixtureMap = new Map(data.fixtures.map(f => [f.id, f]));
let rows = 0;
for (const p of data.players) {
  assert.ok(teamIds.has(p.team)); assert.ok(p.price > 0); assert.equal(new Set(p.history.map(h => h.fixture)).size, p.history.length);
  for (const h of p.history) { const f = fixtureMap.get(h.fixture); assert.ok(f?.finished); assert.equal(h.round, f.event); assert.ok(h.minutes >= 0); assert.ok(teamIds.has(h.opponent)); if (h.xg != null && h.xa != null && h.xgi != null) assert.ok(Math.abs(h.xg + h.xa - h.xgi) < .025); rows++; }
}
assert.ok(rows > 0);
for (const t of data.teams) {
  for (const key of ['logo','jerseyUrl','keeperJerseyUrl']) { assert.ok(t[key], `Missing ${key} for ${t.name}`); assert.ok(t[key].startsWith('./chart-assets/'), `Image should be cached: ${key}`); await readFile(new URL('../public/' + t[key].slice(2), import.meta.url)); }
  assert.notEqual(t.jerseyUrl, t.keeperJerseyUrl, 'Keepers use their own kit');
}
assert.equal(fplShirt({team:data.teams[0].id,position:'GK'},data.teams[0]),data.teams[0].keeperJerseyUrl);
const clubRows=fplTeamRows(data,data.currentEvent);
assert.equal(clubRows.length,data.teams.length);
assert.equal(clubRows.reduce((n,r)=>n+r.goals,0),clubRows.reduce((n,r)=>n+r.conceded,0));
assert.ok(fplTeamRows(data,data.currentEvent,3).every(r=>r.played<=3));
const checked=data.events.find(e=>e.finished&&e.checked);
if(checked) {
  const actual=fplRankings(data,checked.id);
  for(const row of actual) assert.equal(row.score,row.player.history.filter(m=>m.round===checked.id).reduce((n,m)=>n+m.points,0));
  const xi=fplReferenceXI(actual,data.rules.teamLimit);
  assert.equal(xi.length,11); assert.equal(new Set(xi.map(r=>r.player.id)).size,11);
  assert.equal(xi.filter(r=>r.player.position==='GK').length,1);
  assert.ok(xi.filter(r=>r.player.position==='DEF').length>=3);
  assert.ok(xi.filter(r=>r.player.position==='MID').length>=2);
  assert.ok(xi.filter(r=>r.player.position==='FWD').length>=1);
  for(const t of data.teams) assert.ok(xi.filter(r=>r.player.team===t.id).length<=data.rules.teamLimit);
}
const future=data.events.find(e=>!e.finished&&!e.current&&!e.next);
if(future)assert.equal(fplRankings(data,future.id).length,0,'Do not fabricate forecasts outside the official horizon');
console.log(`FPL checks passed: missing vs zero, double GW, date order, per90 denominators, defensive thresholds, bootstrap validation; ${data.players.length} players / ${rows} settled rows and asset references verified.`);
