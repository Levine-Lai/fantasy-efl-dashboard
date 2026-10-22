import {normalize,uniquePlayer} from './attach-attacking-data.mjs';
export function alignAdvanced(players,squads,advanced) {
const fullTeams = new Map(squads.map(t=>[`${t.competitionId}:${normalize(t.shortName || t.name)}`,normalize(t.name)]));
let matched=0;
for (const player of players) {
  const team = fullTeams.get(`${player.competitionId}:${normalize(player.team)}`);
  const row = team ? uniquePlayer(advanced.players,player,team,players) : null;
  if(row && row.apps===player.appearances && row.mins>0) { const {name,team,competitionId,...metrics}=row; player.advanced={...metrics,updatedAt:advanced.capturedAt}; matched++; }
}
return matched;
}
