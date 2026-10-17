// 参考竖版图片：1080 × 1620 PNG，导出当周完整榜单。
async function exportPoster(kind,week,rows,mode='weekly'){
 await document.fonts.load('700 32px Formula1');await document.fonts.load('400 22px Formula1');await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1620;const ctx=canvas.getContext('2d');
 const palette={background:'#08090f',panel:'#10121a',row:'#1b1e27',rowAlt:'#141720',white:'#ffffff',muted:'#91949e',border:'#343741',red:'#e10600',purple:'#bd91ee'};
 const colors=['#00cbb6','#ff1801','#ff8700','#3281ff','#f4d03f','#8060ff','#c4c6ca','#20a5a5','#ed338e','#c4c6ca','#cf2450','#788593','#f78b1d','#44c6e8'];
 const text=(value,x,y,size,color=palette.white,maxWidth=1000,weight=700)=>{let n=size;ctx.textAlign='left';ctx.font=`${weight} ${n}px Formula1`;while(ctx.measureText(String(value)).width>maxWidth&&n>10){n-=.5;ctx.font=`${weight} ${n}px Formula1`;}ctx.fillStyle=color;ctx.fillText(String(value),x,y);};
 const rounded=(x,y,w,h,r,color)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();};
 ctx.fillStyle=palette.background;ctx.fillRect(0,0,1080,1620);ctx.fillStyle=palette.red;ctx.fillRect(0,0,13,1620);
 text('EFL',48,85,41,palette.red,100);text(kind==='drivers'?'DRIVERS STANDINGS':'CONSTRUCTORS STANDINGS',162,91,45,palette.white,866);
 text(mode==='weekly'?`GAMEWEEK ${String(week).padStart(2,'0')}`:`ALL GW · GW 01—${String(week).padStart(2,'0')}`,164,127,20,palette.muted,800,400);
 rounded(70,190,940,1320,17,palette.panel);ctx.strokeStyle=palette.border;ctx.lineWidth=2;ctx.stroke();
 text(kind==='drivers'?'DRIVERS':'CONSTRUCTORS',100,253,32,palette.white,620);text('PTS',888,250,22,palette.muted,90,400);
 const driver=kind==='drivers',rowH=driver?35:68,gap=driver?5:10,start=294;
 rows.forEach((r,i)=>{const y=start+i*(rowH+gap),team=driver?r.team:r.name,index=teamIndex(team),color=colors[index];rounded(92,y,896,rowH,driver?0:8,i%2?palette.rowAlt:palette.row);ctx.fillStyle=color;ctx.fillRect(92,y,driver?7:10,rowH);
 const baseline=driver?y+27:y+41;text(r.dq?'DSQ':String(r.rank).padStart(2,'0'),110,baseline,driver?31:44,palette.muted,driver?72:82);
 if(driver){text('#'+r.number,201,baseline,24,color,87);text(r.name.toUpperCase(),309,baseline,25,palette.white,335);text(team.toUpperCase(),652,baseline,15,palette.muted,218,400);}
 else{text(r.name.toUpperCase(),216,y+30,29,palette.white,625);const drivers=r.ids.map(id=>`${people[id-1][0].toUpperCase()} #${people[id-1][1]}`).join('  /  ');text(drivers,216,y+54,18,palette.muted,650,400);}
 ctx.textAlign='right';ctx.font=`700 ${driver?28:33}px Formula1`;ctx.fillStyle=driver?palette.white:color;ctx.fillText(String(r.points),966,baseline);
 if(mode==='weekly'&&r.fastest){ctx.font='700 9px Formula1';ctx.fillStyle=palette.purple;ctx.fillText('FL +'+r.fastest,driver?910:968,driver?y+27:y+60);}
 });
 text('EFL GRAND PRIX',48,1583,16,palette.muted,620,400);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('海报生成失败')),'image/png'));const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`EFL_${mode==='weekly'?'GW'+String(week).padStart(2,'0'):'ALL_GW'}_${kind}_1080x1620.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 return {width:canvas.width,height:canvas.height};
}
