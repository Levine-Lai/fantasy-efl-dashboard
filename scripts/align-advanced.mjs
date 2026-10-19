export function alignAdvanced(players,squads,advanced) {
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fullTeams = new Map(squads.map(t=>[`${t.competitionId}:${normalize(t.shortName || t.name)}`,normalize(t.name)]));
const alias = name => {const parts=name.trim().split(/\s+/);return parts.length>1?normalize(parts[0][0]+parts.slice(1).join('')):'';};
let matched=0;
for (const player of players) {
  const team = fullTeams.get(`${player.competitionId}:${normalize(player.team)}`);
  const candidates = advanced.players.filter(row=>row.competitionId===player.competitionId && normalize(row.team)===team);
  const exact = candidates.filter(row=>normalize(row.name)===normalize(player.fullName));
  const abbreviated = candidates.filter(row=>alias(row.name)===alias(player.fullName));
  const officialUnique = players.filter(row=>row.competitionId===player.competitionId && row.team===player.team && alias(row.fullName)===alias(player.fullName)).length===1;
  const row = exact.length===1 ? exact[0] : !exact.length && officialUnique && abbreviated.length===1 ? abbreviated[0] : null;
  if(row && row.apps===player.appearances && row.mins>0) { const {name,team,competitionId,...metrics}=row; player.advanced={...metrics,updatedAt:advanced.capturedAt}; matched++; }
}
return matched;
}
