import { createRoot } from 'react-dom/client';
import { useEffect,useState } from 'react';
import {loadRound} from '../lib/round-view';
import { PersonalData } from '../app/personal-data';
import { GameSwitcher } from '../app/game-switcher';
import type { DashboardData,RoundView } from '../lib/dashboard-data';
import dataJson from './dashboard.json';
import '../app/globals.css';
const data=dataJson as DashboardData;
function PersonalPage() {
  const requested=Number(new URLSearchParams(location.search).get('gw'));
  const round=data.roundIndex?.find(r=>r.id===requested);
  const [historical,setHistorical]=useState<RoundView|null>(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    if(round?.state==='completed')loadRound(round).then(value=>{if(!cancelled){setHistorical(value);setError('');}}).catch(error=>{if(!cancelled)setError(error.message);});
    return ()=>{cancelled=true;};
  },[round,retry]);
  const pending=round?.state==='completed'&&!historical;
  const players=historical?.playerStats ?? data.playerStats;
  const home='./index.html'+(round?'?gw='+round.id:'');
  const [id,setId]=useState<number|null>(()=>{
    const value=Number(new URLSearchParams(location.search).get('player'));
    return data.playerStats.some(p=>p.id===value)?value:null;
  });
  const select=(value:number)=>{setId(value);const url=new URL(location.href);url.searchParams.set('player',String(value));history.replaceState(null,'',url);};
  return <main><header className="topbar"><div className="fantasy-brand-group"><GameSwitcher game="efl" personal /><a className="brand" href={home} aria-label="Fantasy EFL 看板首页"><img className="brand-logo" src="./official-fantasy-efl.png" alt="Fantasy EFL"/><span>FANTASY EFL</span></a></div><nav className="efl-nav"><a href={home+'#recommendations'}>推荐</a><a href={home+'#stats'}>场均数据</a><a href={'./personal.html'+(round?'?gw='+round.id:'')} aria-current="page">个人数据</a><a href={home+'#clubs'}>球队</a><a href={home+'#fixtures'}>赛程</a><a className="grand-prix-link" href="./grand-prix-standing/">大奖赛积分榜</a></nav></header><div className="dashboard-shell personal-page-shell"><p className="gw-stats-note" role="status">{error?<>{error} <button onClick={()=>setRetry(n=>n+1)}>重试</button></>:pending?'正在加载历史球员样本…':historical?.statsLabel ?? (round?round.name+' · 最新已结算累计样本':data.statsLabel)}</p>{!pending&&<PersonalData players={players} selectedId={id} onSelect={select} officialUpdatedAt={data.meta.updatedAt} xgUpdatedAt={historical?'':data.meta.xgUpdatedAt}/>}</div></main>;
}
createRoot(document.getElementById('root')!).render(<PersonalPage/>);
