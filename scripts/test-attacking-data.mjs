import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {uniquePlayer} from './attach-attacking-data.mjs';
const src=await readFile(new URL('../lib/attacking-metrics.ts',import.meta.url),'utf8');
const {attackingValue}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const player={id:1,position:'MID',attacking:{xg:2,xa:3,xgi:5,mins:180,apps:3,shots:8,crosses:12,dribbles:4,actionMins:360,actionApps:5}};
assert.equal(attackingValue(player,'xgi90'),2.5);
assert.equal(attackingValue(player,'xa90'),1.5);
assert.equal(attackingValue(player,'shots90'),2,'Use Statz minutes for Statz actions');
assert.equal(attackingValue(player,'crossesPerGame'),2.4,'Use source appearances');
assert.equal(attackingValue({...player,attacking:{...player.attacking,xa:null}},'xa90'),null);
assert.equal(attackingValue({...player,position:'GK'},'xa'),null);
const official=[{fullName:'John Smith',competitionId:10,team:'A'},{fullName:'James Smith',competitionId:10,team:'A'}];
assert.equal(uniquePlayer([{name:'J. Smith',team:'A',competitionId:10}],official[0],'A',official),null,'Ambiguous abbreviation cannot match');
assert.equal(uniquePlayer([{name:'John Smith',team:'B',competitionId:10}],official[0],'A',official),null,'Do not cross teams');
for(const [name,fullName] of [['Géza Dávid Turi','Géza Turi'],['Matthew Max Dibley-Dias','Matt Dibley-Dias'],['Brendan Sarpong-Wiredu','Brendan Wiredu']]) {
 const p={fullName,competitionId:12,team:'Example'},r={name,competitionId:12,team:'Example'};
 assert.equal(uniquePlayer([r],p,'Example',[p]),r);
 assert.equal(uniquePlayer([r,{...r}],p,'Example',[p]),null,'Duplicate canonical names remain ambiguous');
 assert.equal(uniquePlayer([{...r,competitionId:11}],p,'Example',[p]),null,'Name variants never cross leagues');
}
const midPlayer={fullName:'Alex Example',competitionId:12,team:'Example'};
const midRow={name:'Alex John Example',competitionId:12,team:'Example'};
assert.equal(uniquePlayer([midRow],midPlayer,'Example',[midPlayer]),midRow);
assert.equal(uniquePlayer([midRow,{...midRow,name:'Alex James Example'}],midPlayer,'Example',[midPlayer]),null);
assert.equal(uniquePlayer([midRow],midPlayer,'Example',[midPlayer,{...midPlayer,fullName:'Alex James Example'}]),null);
assert.equal(uniquePlayer([{...midRow,name:'Adam John Example'}],midPlayer,'Example',[midPlayer]),null);
const data=JSON.parse(await readFile(new URL('../pages/dashboard.json',import.meta.url),'utf8'));
const fm=data.playerStats.filter(p=>p.attacking?.xa!=null),actions=data.playerStats.filter(p=>p.attacking?.shots!=null);
assert.ok(fm.length>1000);assert.ok(actions.length>1400);
for(const p of data.playerStats){const a=p.attacking;if(!a)continue;for(const value of [a.xg,a.xa,a.xgi,a.shots,a.crosses,a.dribbles])assert.ok(value==null||Number.isFinite(value)&&value>=0);if(a.xgi!=null)assert.ok(Math.abs(a.xgi-a.xg-a.xa)<1e-9);}
assert.equal(data.setPieces.teams.length,72);
assert.equal(new Set(data.setPieces.teams.map(t=>t.id)).size,72);
for(const league of [10,11,12])assert.equal(data.setPieces.teams.filter(t=>t.competitionId===league).length,24);
for(const t of data.setPieces.teams){assert.ok(!/[<>]/.test(t.freeKicks+t.corners));for(const p of t.penalties){assert.ok(p.taken>0);assert.ok(p.scored==null||p.scored>=0&&p.scored<=p.taken);}}
console.log(`Attacking data passed: ${fm.length} xA matches, ${actions.length} action matches; same-source xGI, source denominators, ambiguous names and 72 set-piece teams.`);
