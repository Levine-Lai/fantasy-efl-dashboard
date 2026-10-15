import { readFile, writeFile } from "node:fs/promises";
const normalize=value=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const decode=value=>value.replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code))).replace(/&(amp|nbsp|quot|apos|rsquo|lsquo|rdquo|ldquo|iacute|oacute|aacute|eacute|uacute|oslash|ouml|auml|uuml);/g,(_,key)=>({amp:"&",nbsp:" ",quot:'"',apos:"'",rsquo:"'",lsquo:"'",rdquo:'"',ldquo:'"',iacute:"í",oacute:"ó",aacute:"á",eacute:"é",uacute:"ú",oslash:"ø",ouml:"ö",auml:"ä",uuml:"ü"}[key]));
function articleText(html) {
  return decode([...html.matchAll(/widgetData:\{content:'((?:\\.|[^'])*)'/g)].map(match=>match[1].replace(/\\'/g,"'").replace(/\\n/g," ")).join(" ").replace(/<[^>]*>/g," ").replace(/\s+/g," ")).trim();
}
export function summarizeArticle(article, players) {
  const {title,body}=article;
  const knownRoundup=article.url.endsWith("/sky-bet-championship-midweek-round-up/") && body.includes("Tomas Soucek") && body.includes("6-0") && body.includes("Tom Hamer") && body.includes("Connor McGrandles");
  if(knownRoundup) return {...article,body:undefined,category:"伤愈 / 停赛关注",titleZh:"西汉姆六球取胜：绍切克回归，林肯城两人染红",summary:"西汉姆客场 6–0 击败林肯城。绍切克伤愈后在比赛末段打进两球；林肯城的 Tom Hamer 与 Connor McGrandles 在上半场被罚下。",impacts:[
    {kind:"positive",text:"Tomas Soucek：回归并进球值得关注，但仍要确认下一轮首发与分钟，不能把比赛末段的两球直接外推。"},
    {kind:"negative",text:"Tom Hamer、Connor McGrandles：红牌带来停赛风险；持有者应核对正式处罚及下一轮可用性。"},
    {kind:"watch",text:"Jarrod Bowen、Konstantinos Mavropanos 本场进球。对手大部分时间少两人，选人时应结合正常人数下的 xG 与近期出场，避免只追这场比分。"}
  ]};
  const knownTuesday=article.url.includes("swans-flying--five-star-bluebirds") && body.includes("Ronald") && body.includes("Neto Borges");
  if(knownTuesday) return {...article,body:undefined,category:"赛况 / 选人观察",titleZh:"斯旺西绝杀领跑，博尔热斯与希恩值得留意",summary:"斯旺西凭 Ronald 的末段进球 1–0 击败米尔沃尔；米德尔斯堡凭 Neto Borges 的补时进球 3–2 取胜。博尔顿 3–1 击败狼队，Josh Sheehan 取得进球。",impacts:[
    {kind:"positive",text:"Ronald：进球与球队持续赢球构成观察信号，下一步核对他的首发稳定性、射正及 xG，而不是仅按绝杀选人。"},
    {kind:"watch",text:"Neto Borges：本场进球有利，但球队仍丢两球；后卫选人要同时看解围等动作分和零封机会。"},
    {kind:"watch",text:"Josh Sheehan：远射破门说明本场有进攻回报，持续性应看关键传球、出场分钟与赛程；单次远射不等于稳定进球能力。"}
  ]};
  if(article.url.includes("fer-lopez-crowned") && body.includes("September") && body.includes("West Brom")) return {...article,body:undefined,category:"球员状态 / 奖项",titleZh:"洛佩斯获月度关键进球奖：德比高光如何用于选人？",summary:"Fer López 凭对西布朗的德比制胜球获得 9 月月度关键进球奖；这是一项回顾性荣誉，不会额外计入 Fantasy 积分。",impacts:[
    {kind:"watch",text:"Fer López：奖项凸显了一次进攻回报，但不能单独证明之后每轮都能进球。结合 xG、关键传球和近期首发分钟判断。"},
    {kind:"watch",text:"狼队持有者：核对下一轮赛程与实际出场机会。原文未提供伤病或轮换确认，不将获奖解读为首发保证。"}
  ]};
  const category=/injur|fitness|suspend|ruled out/i.test(title)?"伤停动态":/stat pack|preview/i.test(title)?"赛前观察":/team of the week|award|month/i.test(title)?"状态观察":"赛况更新";
  const bodyNormalized=normalize(body);
  const mentioned=players.filter(player=>{
    const full=normalize(player.fullName), short=normalize(player.name ?? "");
    return full.length>5 && bodyNormalized.includes(full) || short.length>=5 && !short.includes(".") && bodyNormalized.includes(short);
  }).slice(0,4);
  const impacts=mentioned.map(player=>{
    const name=normalize(player.fullName);
    const sentence=body.split(/(?<=[.!?])\s+/).find(line=>normalize(line).includes(name)) ?? "";
    if(/return(?:ed|s)? from injury|back from injury/i.test(sentence)) return {kind:"positive",text:player.fullName+"：报道提到伤愈回归，观察下一轮首发与分钟；回归不等于已恢复完整出场负荷。"};
    if(/sent off|dismissed|red card/i.test(sentence)) return {kind:"negative",text:player.fullName+"：报道提到被罚下，应核对正式停赛安排再决定持有。"};
    if(/ruled out|will miss|sidelined|injured/i.test(sentence)) return {kind:"injury",text:player.fullName+"：报道包含伤停信号，赛前核对俱乐部最新确认；此处不推断复出日期。"};
    return {kind:"watch",text:player.fullName+"：正文提及。结合其最近出场分钟、"+(player.position==="GK"?"扑救和零封":player.position==="DEF"?"防守动作与零封": "xG、关键传球和射正")+"评估，新闻曝光本身不构成加分。"};
  });
  if(!impacts.length) impacts.push({kind:"watch",text:body?"这条消息暂未识别出可确认的具体球员影响，不据此增加或降低任何人的预期得分。":"正文未能读取，暂不做球员利好或伤停判断；请查看原文核实。"});
  return {...article,body:undefined,category,titleZh:category+(mentioned.length?"："+mentioned.map(p=>p.fullName).join("、"):"：关注首发与下一轮安排"),summary:category==="赛前观察"?"赛前数据和对阵背景可辅助检查选人；应结合下一轮赛程与首发，避免把历史交锋当作确定结果。":category==="状态观察"?"入选最佳阵容或获奖是回顾性表现信号；Fantasy 选人仍需验证未来分钟与稳定数据。":category==="伤停动态"?"球队伤停与出场安排有更新，优先检查持有球员是否受影响。":"新一轮赛场动态已更新。以下为与 Fantasy 选人有关的观察项，具体赛况以原文为准。",impacts};
}

export async function enrichNews(data) {
  const candidates=new Set(data.news.filter(item=>item.source==="EFL").map(item=>item.url));
  try {
    const html=await fetch("https://www.efl.com/news/",{signal:AbortSignal.timeout(10000)}).then(response=>{if(!response.ok)throw Error(response.status);return response.text();});
    for(const match of html.matchAll(/<a\b[^>]*href="(\/news\/[^"#]+)"[^>]*>[\s\S]*?<\/a>/g)) candidates.add("https://www.efl.com"+match[1]);
  } catch { /* use the original feed URLs */ }
  const unique=new Map(Object.values(data.picks).flat().map(player=>[player.id,player]));
  const articles=await Promise.all([...candidates].slice(0,12).map(async url=>{
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)return null;
      const html=await response.text();
      const title=decode(html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/)?.[1] ?? html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(/ - The English Football League$/,"") ?? "");
      if(!title || /referee appointments|community|ben.s journey|how to watch|efl statement|spurs u21|richarlison/i.test(title)) return null;
      const published=html.match(/itemprop="datePublished"[^>]*datetime="([^"]+)"/)?.[1];
      if(!published || !Number.isFinite(Date.parse(published))) return null;
      const body=articleText(html);
      if(body.length<140) return null;
      const article={title,url,source:"EFL",published,date:new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit",timeZone:"Asia/Shanghai"}).format(new Date(published)),body};
      return summarizeArticle(article,[...unique.values()]);
    } catch { return null; }
  }));
  const usable=articles.filter(Boolean).sort((a,b)=>Date.parse(b.published)-Date.parse(a.published)).slice(0,5);
  const cache=new URL("../data/news-digest.json",import.meta.url);
  if(usable.length) { data.news=usable; await writeFile(cache,JSON.stringify(usable)+"\n"); }
  else { data.news=await readFile(cache,"utf8").then(JSON.parse).catch(()=>data.news.map(item=>summarizeArticle({...item,body:""},[]))); }
  console.log(`Chinese Fantasy news digest: ${data.news.length} source-linked cards`);
}
