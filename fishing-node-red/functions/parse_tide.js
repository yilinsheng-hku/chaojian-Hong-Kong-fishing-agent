if (msg.statusCode !== 200) {node.error('HTTP '+msg.statusCode,msg);return null;}
const fetchedAt=new Date().toISOString();
const clean=s=>String(s||'').replace(/^\uFEFF/,'').trim();
const num=s=>{const v=Number(clean(s));return clean(s)!==''&&Number.isFinite(v)?v:null;};
const hk=(d,t)=>{if(!d||!t)return null;const z=new Date(d+'T'+t+':00+08:00');return Number.isNaN(z.getTime())?null:z.toISOString();};
const rows=String(msg.payload).replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(s=>s.split(',').map(clean));
const out=[];
for(const row of rows.slice(1)){
 if(row[0]!=='Quarry Bay')continue;
 const at=hk(row[1],row[2]),v=num(row[3]);if(!at)continue;
 out.push({_id:'tide:QUB:'+at,kind:'tide',station:'Quarry Bay',at,heightM:v,missing:v===null,unit:'m above Chart Datum',sourceUrl:msg.url,fetchedAt});
}
msg.collection='observations';msg.payload=out;return msg;
