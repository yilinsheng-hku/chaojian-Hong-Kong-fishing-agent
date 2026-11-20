if (msg.statusCode !== 200) {node.error('HTTP '+msg.statusCode,msg);return null;}
const fetchedAt=new Date().toISOString();
const clean=s=>String(s||'').replace(/^\uFEFF/,'').trim();
const num=s=>{const v=Number(clean(s));return clean(s)!==''&&Number.isFinite(v)?v:null;};
const rows=String(msg.payload).replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(s=>s.split(',').map(clean));
const year=Number(msg.tideYear),out=[];
if(!Number.isInteger(year)||year<2000||year>2200){node.error('Missing tide request year',msg);return null;}
for(const row of rows.slice(1)){
 const m=Number(row[0]),d=Number(row[1]);if(!m||!d)continue;
 for(let i=0;i<4;i++){
  const t=row[2+i*2],v=num(row[3+i*2]);if(!/^\d{3,4}$/.test(t||'')||v===null)continue;
  const hh=Number(t.slice(0,-2)),mm=Number(t.slice(-2));
  if(hh>23||mm>59)continue;
  const at=new Date(Date.UTC(year,m-1,d,hh-8,mm)).toISOString();
  out.push({_id:'QUB:'+at,station:'Quarry Bay',at,heightM:v,unit:'m above Chart Datum',sourceUrl:msg.url,fetchedAt});
 }
}
out.sort((a,b)=>a.at.localeCompare(b.at));
for(let i=0;i<out.length;i++){
 const prev=out[i-1],next=out[i+1],v=out[i].heightM;
 out[i].eventType=prev&&next?(v>prev.heightM&&v>next.heightM?'high':'low'):(next?(v>next.heightM?'high':'low'):(prev?(v>prev.heightM?'high':'low'):'unknown'));
}
msg.collection='tide_events';msg.payload=out;return msg;
