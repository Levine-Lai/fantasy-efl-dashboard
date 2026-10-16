import type { RoundFixture, RoundIndex, RoundView } from "./dashboard-data";

export function fixtureCounts(fixtures:RoundFixture[]) {
  const counts = new Map<number,number>();
  for (const game of fixtures) {
    if (["postponed","cancelled"].includes(game.status)) continue;
    for (const id of [game.homeId,game.awayId]) counts.set(id,(counts.get(id) ?? 0)+1);
  }
  return counts;
}

export function defaultRound(rounds:RoundIndex[], now=Date.now()) {
  return rounds.find(round=>round.state==="current")?.id
    ?? rounds.find(round=>round.state!=="completed" && Date.parse(round.lockoutAt)>now)?.id
    ?? rounds.at(-1)?.id;
}

const requests = new Map<string,Promise<RoundView>>();
export function loadRound(round:RoundIndex) {
  let request=requests.get(round.file);
  if (!request) {
    request=fetch(new URL(round.file,document.baseURI)).then(async response=>{
      if(!response.ok) throw new Error("该轮数据暂时无法加载，请重试");
      const result=await response.json() as RoundView;
      if(result.meta.roundId!==round.id || !Array.isArray(result.fixtures)) throw new Error("轮次数据不匹配，请刷新页面");
      return result;
    }).catch(error=>{requests.delete(round.file);throw error;});
    requests.set(round.file,request);
  }
  return request;
}
