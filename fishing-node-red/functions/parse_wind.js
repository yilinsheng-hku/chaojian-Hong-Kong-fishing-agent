if (msg.statusCode !== 200) {node.error('HTTP '+msg.statusCode,msg);return null;}
const fetchedAt=new Date().toISOString();
const clean=s=>String(s||'').replace(/^\uFEFF/,'').trim();
const num=s=>{const v=Number(clean(s));return clean(s)!==''&&Number.isFinite(v)?v:null;};
const hk=(d,t)=>{if(!d||!t)return null;const z=new Date(d+'T'+t+':00+08:00');return Number.isNaN(z.getTime())?null:z.toISOString();};
const rows=String(msg.payload).replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(s=>s.split(',').map(clean));
const out=[];
for(const row of rows.slice(1)){
 if(!['North Point','Central Pier','Stanley','Wong Chuk Hang','Green Island','Lamma Island'].includes(row[1]))continue;
 const t=row[0];if(!/^\d{12}$/.test(t))continue;
 const at=hk(t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8),t.slice(8,10)+':'+t.slice(10,12));
 if(!at)continue;
 const speed=num(row[3]),gust=num(row[4]);
 out.push({_id:'wind:'+row[1]+':'+at,kind:'wind',station:row[1],at,direction:row[2]==='N/A'?null:(row[2]||null),speedKmh:speed,gustKmh:gust,missing:speed===null,sourceUrl:msg.url,fetchedAt});
}
msg.collection='observations';msg.payload=out;return msg;
