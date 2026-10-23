import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';

// Reconstruct the supplied chart from its official data, keeping every coordinate exact.
const root=new URL('../',import.meta.url);
const data=JSON.parse(await readFile(new URL('data/fpl/snapshot.json',root),'utf8'));
const code=await readFile(new URL('lib/fpl-data.ts',root),'utf8');
const lib=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const gw=Number(process.argv[2]??data.events.find(e=>e.next)?.id??data.currentEvent);
const through=Math.max(...data.events.filter(e=>e.finished&&e.checked&&e.id<gw).map(e=>e.id));
const rows=lib.fplTeamRows(data,through).filter(r=>r.xg!=null&&r.xga!=null);
if(rows.length!==20)throw Error('Expected all 20 clubs with complete xG/xGA');
const fixtures=data.fixtures.filter(f=>f.event===gw);
if(!fixtures.length)throw Error('No fixtures for selected GW');
const n=3200,left=230,right=3050,top=350,bottom=2850;
const range=values=>{const a=Math.min(...values),b=Math.max(...values),pad=Math.max(.8,(b-a)*.1);return [Math.floor((a-pad)*2)/2,Math.ceil((b+pad)*2)/2];};
const dx=range(rows.map(r=>r.xg)),dy=range(rows.map(r=>r.xga));
const x=v=>left+(v-dx[0])/(dx[1]-dx[0])*(right-left),y=v=>top+(v-dy[0])/(dy[1]-dy[0])*(bottom-top);
const meanX=rows.reduce((s,r)=>s+r.xg,0)/rows.length,meanY=rows.reduce((s,r)=>s+r.xga,0)/rows.length;
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text=(s,xx,yy,size=44,anchor='start',color='#003153',extra='')=>`<text x="${xx}" y="${yy}" font-size="${size}" text-anchor="${anchor}" fill="${color}" ${extra}>${esc(s)}</text>`;
const image=(buffer,xx,yy,w,h)=>`<image href="data:image/png;base64,${buffer.toString('base64')}" x="${xx}" y="${yy}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${n} ${n}"><rect width="3200" height="3200" fill="white"/><g font-family="Times New Roman" font-style="italic">`;
const league=await sharp(await readFile(new URL('public/official-fpl-favicon.png',root))).png().toBuffer();
svg+=image(league,left,88,115,115)+text(`Premier League | GW${gw} Matchups`,left+150,175,69,'start','#001f3f','font-weight="bold"');
svg+=text(`${data.season.replace('-','/')} · Season totals through GW${through}`,left,270,43,'start','#59768a');
svg+=`<rect x="${x(meanX)}" y="${top}" width="${right-x(meanX)}" height="${y(meanY)-top}" fill="#eaf4ed" opacity=".6"/><rect x="${left}" y="${y(meanY)}" width="${x(meanX)-left}" height="${bottom-y(meanY)}" fill="#fbefea" opacity=".6"/>`;
for(let v=Math.ceil(dx[0]/2)*2;v<=dx[1];v+=2){svg+=`<line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${bottom}" stroke="#dce6ec" stroke-width="2"/>`+text(v.toFixed(1),x(v),bottom+63,37,'middle','#59768a');}
for(let v=Math.ceil(dy[0]/2)*2;v<=dy[1];v+=2){svg+=`<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#dce6ec" stroke-width="2"/>`+text(v.toFixed(1),left-35,y(v)+13,37,'end','#59768a');}
svg+=`<path d="M ${x(meanX)} ${top} V ${bottom} M ${left} ${y(meanY)} H ${right}" fill="none" stroke="#6e8da1" stroke-width="3" stroke-dasharray="13 13" opacity=".8"/>`;
for(const [xx,yy,anchor,lines,color] of [[left+38,top+74,'start',['Weak Attack','Strong Defence'],'#6a879a'],[right-38,top+74,'end',['Strong Attack','Strong Defence'],'#48846c'],[left+38,bottom-110,'start',['Weak Attack','Weak Defence'],'#b9826b'],[right-38,bottom-110,'end',['Strong Attack','Weak Defence'],'#6a879a']]){
 svg+=text(lines[0],xx,yy,42,anchor,color,'opacity=".85"')+text(lines[1],xx,yy+49,42,anchor,color,'opacity=".85"');
}
const points=new Map(rows.map(r=>[r.team.id,{x:x(r.xg),y:y(r.xga),name:r.team.name}]));
svg+='<defs><marker id="away" viewBox="0 0 12 12" markerWidth="6" markerHeight="6" refX="10" refY="6" orient="auto-start-reverse"><path d="M 1 1 L 11 6 L 1 11 Z" fill="#315f79"/></marker></defs><g id="fixture-arrows" fill="none" stroke="#315f79" stroke-width="5.5" opacity=".78" marker-end="url(#away)">';
const audit=[];
for(const f of fixtures){
 const a=points.get(f.home),b=points.get(f.away);if(!a||!b)throw Error('Missing fixture endpoint');
 const vx=b.x-a.x,vy=b.y-a.y,len=Math.hypot(vx,vy),bend=Math.max(22,Math.min(72,len*.055));
 const cx=(a.x+b.x)/2-vy/len*bend,cy=(a.y+b.y)/2+vx/len*bend;
 const startLen=Math.hypot(cx-a.x,cy-a.y),endLen=Math.hypot(b.x-cx,b.y-cy),gap=Math.min(61,len*.2);
 const ax=a.x+(cx-a.x)/startLen*gap,ay=a.y+(cy-a.y)/startLen*gap,bx=b.x-(b.x-cx)/endLen*gap,by=b.y-(b.y-cy)/endLen*gap;
 svg+=`<path d="M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}"><title>${esc(a.name)} → ${esc(b.name)}</title></path>`;
 audit.push({fixture:f.id,home:a.name,away:b.name,date:f.date});
}
svg+='</g><g id="club-logos">';
for(const r of rows){
 const asset=new URL('public/'+r.team.logo.replace(/^\.\//,''),root);
 const logo=await sharp(await readFile(asset)).png().toBuffer();
 const size=96;
 svg+=`<g><title>${esc(r.team.name)}: xG ${r.xg.toFixed(2)}, xGA ${r.xga.toFixed(2)}</title>${image(logo,x(r.xg)-size/2,y(r.xga)-size/2,size,size)}</g>`;
}
svg+='</g>';
svg+=text('Expected Goals (xG)',(left+right)/2,3010,57,'middle');
svg+=text('Expected Goals Conceded (xGA)',76,(top+bottom)/2,57,'middle','#003153',`transform="rotate(-90 76 ${(top+bottom)/2})"`);
svg+=text(`GW${gw}: Home → Away · FPL official data · Mean lines`,left,3125,34,'start','#59768a')+'</g></svg>';
const dir=new URL('exports/fpl-gw'+gw+'-clean/',root);await mkdir(dir,{recursive:true});
await writeFile(new URL('matchups-en.svg',dir),svg);
await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL('matchups-en.png',dir)));
await writeFile(new URL('data.json',dir),JSON.stringify({season:data.season,capturedAt:data.capturedAt,through,gw,rows:rows.map(r=>({team:r.team.name,xg:r.xg,xga:r.xga})),fixtures:audit},null,2));
console.log(JSON.stringify({output:dir.pathname,through,gw,clubs:rows.length,arrows:audit.length,fixtures:audit}));
