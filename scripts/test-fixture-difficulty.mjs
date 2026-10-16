import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../lib/fixture-difficulty.ts',import.meta.url),'utf8');
const {fixtureDifficulty,difficultyBand,gameweekOpportunity,expectedTeamPoints,gameweekExpectedPoints}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
assert.equal(gameweekOpportunity([{overall:80},{overall:40}]),60,'Double fixtures are averaged, not summed');
assert.ok(gameweekOpportunity([{overall:75}])>gameweekOpportunity([{overall:50},{overall:50}]),'Quantity must not override easier difficulty');
assert.equal(gameweekOpportunity([]),null);
assert.equal(gameweekOpportunity([{overall:90},null]),null,'A missing opponent cannot be treated as easy');
const team=id=>({id,competitionId:10,name:'Team '+id,overall:{played:20,xg:1.5,xga:1.5}});
const own=team(1),opponent=team(2),league=[own,opponent,team(3)];
const base=fixtureDifficulty(own,opponent,true,league);
assert.equal(base.overall,50);assert.equal(base.attack,50);assert.equal(base.defense,50);
const dangerous={...opponent,overall:{played:20,xg:3,xga:3}};
const mixed=fixtureDifficulty(own,dangerous,true,league);
assert.ok(mixed.attack>70&&mixed.defense<30);
assert.ok(Math.abs(mixed.overall-50)<1e-9,'Weak defending plus strong attacking must not automatically produce a green overall fixture');
const easy={...opponent,overall:{played:20,xg:.5,xga:3}};
assert.ok(fixtureDifficulty(own,easy,true,league).overall>70);
const betterAttack={...own,overall:{...own.overall,xg:2.5}};
assert.ok(fixtureDifficulty(betterAttack,opponent,true,league).attack>base.attack);
const betterDefense={...own,overall:{...own.overall,xga:.6}};
const defensive=fixtureDifficulty(betterDefense,opponent,true,league);
assert.ok(defensive.defense>base.defense&&defensive.ownDefenseIndex>100);
assert.ok(Math.abs(fixtureDifficulty(own,{...easy,overall:{...easy.overall,played:1}},true,league).overall-50)<Math.abs(fixtureDifficulty(own,easy,true,league).overall-50),'Small samples shrink toward the neutral baseline');
assert.equal(fixtureDifficulty({...own,overall:null},opponent,true,league),null);
assert.equal(fixtureDifficulty(own,{...opponent,competitionId:11},true,league),null);
assert.deepEqual([100,70,69,58,50,42,41,30,29,0,null].map(difficultyBand),[1,1,2,2,3,3,4,4,5,5,0]);
const venue={...own,home:{played:5,xg:2,xga:.8},away:{played:5,xg:1,xga:2.2}};
const venueLeague=[venue,{...opponent,home:venue.home,away:venue.away},team(3)];
const h=fixtureDifficulty(venue,venueLeague[1],true,venueLeague),a=fixtureDifficulty(venueLeague[1],venue,false,venueLeague);
assert.ok(Math.abs(h.xg-a.xga)<1e-9&&Math.abs(h.xga-a.xg)<1e-9,'Both views of the same match must agree on predicted goals');
const data=JSON.parse(await readFile(new URL('../pages/dashboard.json',import.meta.url),'utf8'));
const calendar=JSON.parse(await readFile(new URL('../public/'+data.fixtureMatrixFile.replace(/^\.\//,''),import.meta.url),'utf8'));
assert.equal(calendar.teams.length,72);assert.equal(calendar.rounds.length,42);
assert.equal(calendar.teams.filter(t=>t.overall).length,72);
assert.ok(calendar.teams.filter(t=>t.home&&t.away).length>=60);
const teams=new Map(calendar.teams.map(t=>[t.id,t]));
for(const round of calendar.rounds)for(const game of round.games){
  assert.ok(teams.has(game.homeId)&&teams.has(game.awayId));
  assert.ok(!('homeScore' in game)&&!('date' in game),'Matrix payload must not include unnecessary scores or time fields');
  if(['completed','postponed','cancelled'].includes(game.status)||round.state==='completed')continue;
  const result=fixtureDifficulty(teams.get(game.homeId),teams.get(game.awayId),true,calendar.teams);
  assert.ok(result&&Number.isFinite(result.xg)&&Number.isFinite(result.xga));
  for(const key of ['attack','defense','overall'])assert.ok(result[key]>=0&&result[key]<=100);
}
console.log('FDR checks passed: balanced danger, both own strengths, sample shrinkage, venue reciprocity, missing sources, all 72 teams and compact fixture payload');

const equal=expectedTeamPoints({xg:1.5,xga:1.5},true);
assert.ok(equal.win>0&&equal.win<1&&equal.draw>0);
assert.ok(Math.abs(2*equal.win+equal.draw-1)<1e-10);
assert.ok(Math.abs(expectedTeamPoints({xg:1.5,xga:1.5},false).total-equal.total-2*equal.win)<1e-10,'Away victory bonus');
assert.ok(expectedTeamPoints({xg:2.5,xga:1.5},true).total>equal.total);
assert.ok(expectedTeamPoints({xg:1.5,xga:.5},true).total>equal.total);
assert.equal(expectedTeamPoints({xg:0,xga:0},true).total,5,'0-0: draw and clean sheet');
assert.equal(expectedTeamPoints(null,true),null);
assert.equal(gameweekExpectedPoints([]),null);
assert.equal(gameweekExpectedPoints([{result:null,home:true}]),null);
assert.equal(gameweekExpectedPoints([{result:{xg:1.5,xga:1.5},home:true},{result:{xg:1.5,xga:1.5},home:true}]),2*equal.total,'Double GW sums expected points');
console.log('Official club expectation model: probabilities, bonuses, monotonicity and double GW passed.');

const dashboard=JSON.parse(await readFile(new URL('../pages/dashboard.json',import.meta.url),'utf8'));
const generated=JSON.parse(await readFile(new URL('../public/'+dashboard.fixtureMatrixFile.replace(/^\.\//,''),import.meta.url),'utf8'));
const selected=generated.rounds.find(r=>r.id===dashboard.meta.roundId);
if(selected.state!=='completed'){
 const ranked=generated.teams.flatMap(team=>{
  const matches=selected.games.filter(g=>!['completed','postponed','cancelled'].includes(g.status)&&(g.homeId===team.id||g.awayId===team.id)).map(g=>{const home=g.homeId===team.id;return {home,result:fixtureDifficulty(team,generated.teams.find(t=>t.id===(home?g.awayId:g.homeId)),home,generated.teams)};});
  const score=gameweekExpectedPoints(matches);return score==null?[]:[{id:team.id,score}];
 }).sort((a,b)=>b.score-a.score);
 assert.deepEqual(dashboard.teams.map(t=>t.id),ranked.map(t=>t.id),'Header recommendations and fixture rankings agree');
 for(const t of dashboard.teams)assert.equal(t.score,Number(ranked.find(r=>r.id===t.id).score.toFixed(1)));
}
console.log('Generated club recommendations equal shared fixture expectations.');

assert.equal(gameweekOpportunity([{attack:80,defense:10},{attack:40,defense:90}],'attack'),60);
assert.equal(gameweekOpportunity([{attack:80,defense:10},{attack:40,defense:90}],'defense'),50);
assert.equal(fixtureDifficulty({...own,overall:{...own.overall,xga:3}},opponent,true,league).attack,base.attack,'Attack ignores own defending');
assert.equal(fixtureDifficulty(own,{...opponent,overall:{...opponent.overall,xg:3}},true,league).attack,base.attack,'Attack ignores opponent attacking');
assert.equal(fixtureDifficulty({...own,overall:{...own.overall,xg:3}},opponent,true,league).defense,base.defense,'Defense ignores own attacking');
assert.equal(fixtureDifficulty(own,{...opponent,overall:{...opponent.overall,xga:3}},true,league).defense,base.defense,'Defense ignores opponent defending');
console.log('Directional fixture rankings passed: attack and defense are isolated, doubles averaged.');
