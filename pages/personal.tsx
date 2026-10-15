import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { PersonalData } from '../app/personal-data';
import type { DashboardData } from '../lib/dashboard-data';
import dataJson from './dashboard.json';
import '../app/globals.css';
const data=dataJson as DashboardData;
function PersonalPage() {
  const [id,setId]=useState<number|null>(()=>{
    const value=Number(new URLSearchParams(location.search).get('player'));
    return data.playerStats.some(p=>p.id===value)?value:null;
  });
  const select=(value:number)=>{setId(value);const url=new URL(location.href);url.searchParams.set('player',String(value));history.replaceState(null,'',url);};
  return <main><header className="topbar"><a className="brand" href="./index.html" aria-label="Fantasy EFL 看板首页"><img className="brand-logo" src="./official-fantasy-efl.png" alt="Fantasy EFL"/><span>FANTASY EFL</span></a><nav><a href="./index.html#recommendations">推荐</a><a href="./index.html#stats">场均数据</a><a href="./personal.html" aria-current="page">个人数据</a><a href="./index.html#clubs">球队</a><a href="./index.html#news">新闻</a></nav></header><div className="dashboard-shell personal-page-shell"><PersonalData players={data.playerStats} selectedId={id} onSelect={select} officialUpdatedAt={data.meta.updatedAt} xgUpdatedAt={data.meta.xgUpdatedAt}/></div></main>;
}
createRoot(document.getElementById('root')!).render(<PersonalPage/>);
