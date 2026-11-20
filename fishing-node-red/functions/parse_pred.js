if (msg.statusCode !== 200) {node.error('HTTP '+msg.statusCode,msg);return null;}
const fetchedAt=new Date().toISOString();
const clean=s=>String(s||'').replace(/^\uFEFF/,'').trim();
const num=s=>{const v=Number(clean(s));return clean(s)!==''&&Number.isFinite(v)?v:null;};
const rows=String(msg.payload).replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(s=>s.split(',').map(clean));
const year=Number(msg.tideYear), out=[];
if(!Number.isInteger(year)||year<2000||year>2200){node.error('Missing tide request year',msg);return null;}
for(const row of rows.slice(1)){
 const m=Number(row[0]),d=Number(row[1]);if(!m||!d)continue;
 for(let h=1;h<=24;h++){
  const v=num(row[h+1]);if(v===null)continue;
  const at=new Date(Date.UTC(year,m-1,d,h-8)).toISOString();
  out.push({_id:'QUB:'+at,kind:'predicted_tide',station:'Quarry Bay',at,heightM:v,unit:'m above Chart Datum',sourceUrl:msg.url,fetchedAt});
 }
}
msg.collection='predicted_tide';msg.payload=out;return msg;
