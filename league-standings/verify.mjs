import vm from 'node:vm';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const elements=new Map();const context={window:{},document:{getElementById(id){if(!elements.has(id))elements.set(id,{value:'',setAttribute(){},addEventListener(){}});return elements.get(id)}},location:{hash:''},history:{replaceState(){}},URLSearchParams};vm.createContext(context);
vm.runInContext(await fs.readFile(new URL('./data.js',import.meta.url),'utf8'),context);vm.runInContext(await fs.readFile(new URL('./rules.js',import.meta.url),'utf8'),context);vm.runInContext(await fs.readFile(new URL('./fastest.js',import.meta.url),'utf8'),context);vm.runInContext(await fs.readFile(new URL('./app.js',import.meta.url),'utf8'),context);
const weeks=context.window.LEAGUE_DATA.orders.length;
assert.equal(weeks,context.window.FASTEST_LAPS.weeks.length);
for(let i=0;i<weeks;i++){assert.equal(new Set(context.window.LEAGUE_DATA.orders[i]).size,28);assert.equal(context.window.LEAGUE_DATA.scores[i].length,28);assert.ok(context.window.LEAGUE_DATA.scores[i].every(Number.isFinite));}
assert.equal(elements.get('week').value,'all');
assert.deepEqual([...elements.get('week').innerHTML.matchAll(/value="([^"]+)"/g)].map(m=>m[1]),['all',...Array.from({length:weeks},(_,i)=>String(weeks-i))]);
assert.ok(!elements.get('results').innerHTML.includes('class="lap-badge"'));
elements.get('week').value='7';vm.runInContext('render()',context);
assert.ok(elements.get('results').innerHTML.includes('class="lap-badge"'));
for(let w=1;w<=weeks;w++)for(const mode of ['weekly','cumulative']){const d=vm.runInContext(`standings('drivers','${mode}',${w})`,context),t=vm.runInContext(`standings('teams','${mode}',${w})`,context);assert.equal(d.length,28);assert.equal(t.length,14);const laps=context.window.FASTEST_LAPS.weeks.slice(mode==='weekly'?w-1:0,w).filter(l=>l.winnerId).length;assert.equal(d.reduce((s,r)=>s+r.base,0),101*(mode==='weekly'?1:w));assert.equal(d.reduce((s,r)=>s+r.points,0),101*(mode==='weekly'?1:w)+laps);assert.equal(t.reduce((s,r)=>s+r.points,0),101*(mode==='weekly'?1:w)+laps);if(mode==='weekly'){assert.equal(d.filter(r=>r.base>0).length,10);assert.equal(d.filter(r=>r.fastest>0).length,laps);}for(const team of t)assert.equal(team.points,team.ids.reduce((s,id)=>s+d.find(r=>r.name===context.window.LEAGUE_DATA.people[id-1][0]).points,0));}
for(const lap of context.window.FASTEST_LAPS.weeks){assert.ok(lap.candidates.every(c=>c.rank<=10));if(lap.winnerId){assert.equal(lap.winnerId,lap.candidates[0].id);assert.ok(lap.candidates.every(c=>c.vicePoints<=lap.vicePoints));}}
assert.equal(context.window.FASTEST_LAPS.weeks[3].winnerId,21);assert.equal(context.window.FASTEST_LAPS.weeks[8].winnerId,23);
const confirmedGW7=[4,66,22,22,39,34,8,10,37,35,16,52,29,26,9,32,21,0,4,1,34,2,36,22,65,10,52,26];
const gw7=vm.runInContext("standings('drivers','cumulative',7)",context);for(let i=0;i<28;i++)assert.equal(gw7.find(r=>r.ids[0]===i+1).points,confirmedGW7[i]);
const gw3=vm.runInContext("standings('drivers','weekly',3)",context);assert.equal(gw3.at(-1).name,'Eric');assert.equal(gw3.at(-1).points,0);assert.equal(gw3.at(-1).dq,true);assert.equal(gw3.find(r=>r.name==='bad k').rank,10);assert.equal(gw3.find(r=>r.name==='bad k').base,1);
const final=vm.runInContext("standings('drivers','cumulative',9)",context);assert.equal(final[0].name,'Benben');assert.equal(final[0].points,108);assert.equal(context.window.LEAGUE_DATA.update.week,weeks);
assert.equal(context.window.LEAGUE_DATA.update.finalBasis,'user-confirmed-current-scores');
assert.equal(context.window.LEAGUE_DATA.update.provisional,false);
const gw10=vm.runInContext("standings('drivers','weekly',10)",context);assert.equal(gw10[0].name,'bad k');assert.equal(gw10[0].points,25);assert.equal(gw10.find(r=>r.name==='Tierney').fastest,1);assert.equal(context.window.FASTEST_LAPS.weeks[9].maximum,48);
console.log(`${weeks*4} standings verified: all weeks, both modes, both leaderboards.`);console.log(JSON.stringify(vm.runInContext("standings('teams','cumulative',"+weeks+")",context).slice(0,3).map(r=>[r.name,r.points])));
