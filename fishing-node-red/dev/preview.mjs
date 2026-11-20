// Local UI preview only. Synthetic observations never enter the production flow or database.
import http from 'node:http';
import {readFileSync} from 'node:fs';
const folder=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,folder),'utf8');
const analysis=new Function('msg','global','env','node',read('location_analysis.js'));
const api=new Function('msg','global','env','node',read('functions/api.js'));
function fixtures(){
  const now=Date.now(),hour=Math.floor(now/3600000)*3600000;
  const iso=t=>new Date(t).toISOString(),predicted=[],observations=[],events=[];
  for(let i=-48;i<=48;i++){
    const at=iso(hour+i*3600000),heightM=1.4+.65*Math.sin(i*Math.PI/6);
    predicted.push({station:'Quarry Bay',at,heightM,sourceUrl:'https://www.hko.gov.hk/en/tide/estation_select.htm'});
    if(i%6===3||i%6===-3)events.push({station:'Quarry Bay',at,heightM,eventType:heightM>1.4?'high':'low'});
    if(i>0)continue;
    const add=(kind,station,field,value)=>observations.push({kind,station,at,[field]:value,missing:false,sourceUrl:'https://www.hko.gov.hk/en/abouthko/opendata_intro.htm'});
    add('tide','Quarry Bay','heightM',heightM+.03);
    for(const [index,station] of ['North Point','Central Pier','Stanley','Wong Chuk Hang','Green Island','Lamma Island'].entries())add('wind',station,'speedKmh',12+index*2);
    for(const station of ['Shau Kei Wan','Happy Valley','Stanley','Wong Chuk Hang'])add('rain',station,'rainMm',station==='Happy Valley'?1:0);
    for(const station of ['Shau Kei Wan','Happy Valley','Stanley','Wong Chuk Hang','HK Park'])add('temperature',station,'temperatureC',24.5);
    for(const station of ['Central','Sai Wan Ho'])add('visibility',station,'visibilityKm',18);
  }
  observations.push({
    _id:'forecast:HKO',kind:'forecast',station:'Hong Kong Observatory',at:iso(now),
    generalSituation:'东北季候风正影响广东沿岸，未来数天天气大致天晴，日间干燥。',
    days:Array.from({length:9},(_,d)=>({
      date:new Date(now+(d+1)*86400000).toISOString().slice(0,10).replace(/-/g,''),
      week:['星期一','星期二','星期三','星期四','星期五','星期六','星期日'][d%7],
      wind:'东风 3 至 4 级，离岸间中 5 级',
      weather:d===2?'大致多云，有一两阵微雨':'大致天晴，日间部分时间有阳光',
      tempMinC:21,tempMaxC:26,rhMinPct:60,rhMaxPct:85,psr:d===2?'中低':'低'
    })),
    seaTemp:{place:'北角',temperatureC:24,recordTime:iso(now)},
    missing:false,sourceUrl:'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=sc'
  });
  observations.push({
    _id:'warnings:HKO',kind:'warnings',station:'Hong Kong Observatory',at:iso(now),
    active:[],count:0,missing:false,sourceUrl:'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=sc'
  });
  return {observations,predicted_tide:predicted,tide_events:events};
}
function matches(row,query){
  return Object.entries(query).every(([key,value])=>key==='$or'?value.some(q=>matches(row,q)):value&&typeof value==='object'?Object.entries(value).every(([op,target])=>op==='$gte'?row[key]>=target:op==='$lte'?row[key]<=target:op==='$in'?target.includes(row[key]):false):row[key]===value);
}
async function execute(fn,payload){
  const data=fixtures();
  const db={collection:name=>({
    findOne:async query=>(data[name]||[]).find(row=>matches(row,query))||null,
    find:query=>{
    let rows=(data[name]||[]).filter(row=>matches(row,query));
    const cursor={sort(order){const [field,direction]=Object.entries(order)[0];rows.sort((a,b)=>a[field]<b[field]?-direction:a[field]>b[field]?direction:0);return cursor},limit(limit){rows=rows.slice(0,limit);return cursor},async toArray(){return rows}};return cursor;
  }})};
  const client={db:()=>db},cache=new Map([['mongoPromise',Promise.resolve(client)],['mongodb',{MongoClient:class{async connect(){return client}}}]]);
  return new Promise((resolve,reject)=>{
    const msg={payload};
    const immediate=fn(msg,{get:key=>cache.get(key),set:(key,value)=>cache.set(key,value)},{get:()=>''},{send:resolve,done(){},error:reject});
    if(immediate)resolve(immediate);
  });
}
const server=http.createServer(async(req,res)=>{
  try{
    if(req.url==='/mobile'){
      res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>潮间 · 手机预览</title><body style="margin:0;background:#dce5e3;display:grid;place-items:center"><iframe title="390px 手机界面" src="/fishing" style="border:0;width:390px;height:844px;max-width:100vw"></iframe>');return;
    }
    if(req.url==='/fishing'||req.url==='/'){
      const flows=JSON.parse(read('flows.json')),func=flows.find(node=>node.id==='page').func;
      const html=JSON.parse(func.slice(func.indexOf('msg.payload=')+12,-12));
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(html.replace('<body>','<body><div style="padding:8px;text-align:center;background:#fff0d4;font:12px system-ui">界面预览 · 合成数据 · 非实时观测</div>'));return;
    }
    let output;
    if(req.url==='/fishing/api')output=await execute(api,{});
    else if(req.url==='/fishing/location-analysis'){
      let body='';for await(const chunk of req)body+=chunk;
      output=await execute(analysis,JSON.parse(body));
    }else if(req.url==='/fishing/assistant/status')output={payload:{configured:false,modelAvailable:false}};
    else if(req.url==='/fishing/assistant'){
      // Exercise the chat renderer without making a model request.
      for await(const chunk of req){}
      output={payload:{mode:'offline-preview',answer:'### 当前环境\n- **北角平均风速**：12 km/h（合成预览数据）\n- 筲箕湾过去一小时雨量：0 mm\n\n### 可参考时段\n请点击首页潮汐时段卡片核对预测变化。\n\n### 资料缺口\n此页面仅验证交互和排版，实际分析需启动 Node-RED。\n\n[天文台数据来源](https://www.hko.gov.hk/en/abouthko/opendata_intro.htm)',trace:[{tool:'get_current_conditions',status:'finished'},{tool:'get_tide_window',status:'finished'}]}};
    }else{res.writeHead(404);res.end();return}
    res.writeHead(output.statusCode||200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(output.payload));
  }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}))}
});
server.listen(1881,'127.0.0.1',()=>console.log('Synthetic UI preview: http://127.0.0.1:1881/fishing (mobile: /mobile)'));
