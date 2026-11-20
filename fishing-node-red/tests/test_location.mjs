import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../location_analysis.js',import.meta.url),'utf8');
const runFunction = new Function('msg','global','env','node',source);
const at = new Date().toISOString();
const make = (kind,station,field,value) => ({kind,station,at,[field]:value,sourceUrl:'https://example.test/data',missing:value==null});

async function analyse(rows,point={lat:22.291,lon:114.213}) {
  const db={collection(name){
    if(name==='preferences')return {findOne:async()=>({_id:'local',maxWindKmh:25,maxRainMm:5})};
    return {find:()=>({sort:()=>({limit:()=>({toArray:async()=>rows})})})};
  }};
  const mockGlobal={get:key=>key==='mongodb'?{MongoClient:class{async connect(){return this}db(){return db}}}:null,set(){}};
  return new Promise((resolve,reject)=>{
    const msg={payload:point};
    try{const immediate=runFunction(msg,mockGlobal,{get:()=>''},{send:m=>resolve(m),done(){},error:reject});if(immediate)resolve(immediate)}catch(error){reject(error)}
  });
}

const base=[
  make('tide','Quarry Bay','heightM',1.4),
  make('wind','North Point','speedKmh',12),
  make('wind','Central Pier','speedKmh',18),
  make('rain','Shau Kei Wan','rainMm',0),
  make('temperature','Shau Kei Wan','temperatureC',24),
];
let result=(await analyse(base)).payload;
assert.equal(result.status,'within-threshold');
assert.equal(result.data.wind.selected.stationId,'North Point');
assert.equal(result.data.rain.selected.stationId,'Shau Kei Wan');
assert.equal(result.data.rain.fallback,true); // Nearest Quarry Bay rain gauge has no live record.
assert.equal(result.data.rain.rejected[0].station,'鰂鱼涌');
assert.deepEqual(result.criteria,{maxWindKmh:25,maxRainMm:5});
assert.equal(result.regional.wind.stationCount,2);
assert.equal(result.regional.wind.median,15);
assert.equal('preferences' in result,false);

result=(await analyse([make('wind','North Point','speedKmh',null),...base.filter(x=>x.station!=='North Point')])).payload;
assert.equal(result.data.wind.selected.stationId,'Central Pier');
assert.equal(result.data.wind.fallback,true);
assert.equal(result.data.wind.rejected[0].reason,'缺测');

result=(await analyse([])).payload;
assert.equal(result.status,'insufficient');
assert.equal(result.data.wind.selected,null);

result=(await analyse([make('wind','Stanley','speedKmh',14),make('rain','Stanley','rainMm',0)],{lat:22.1975,lon:114.211944})).payload;
assert.equal(result.data.wind.selected.stationId,'Bluff Head');
assert.equal(result.data.wind.selected.rawStation,'Stanley');

result=(await analyse([make('temperature','HK Park','temperatureC',25),make('wind','Central Pier','speedKmh',12),make('rain','Happy Valley','rainMm',0)],{lat:22.2818,lon:114.1286})).payload;
assert.equal(result.data.temperature.selected.stationId,'HK Park');

const bad=await analyse(base,{lat:0,lon:0});
assert.equal(bad.statusCode,400);
const stale={...make('wind','North Point','speedKmh',10),at:new Date(Date.now()-91*60000).toISOString()};
result=(await analyse([stale,...base.filter(x=>x.station!=='North Point')])).payload;
assert.equal(result.data.wind.selected.stationId,'Central Pier');
assert.equal(result.data.wind.rejected[0].reason,'观测已过期');
const future={...make('wind','North Point','speedKmh',10),at:new Date(Date.now()+10*60000).toISOString()};
result=(await analyse([future,...base.filter(x=>x.station!=='North Point')])).payload;
assert.equal(result.data.wind.selected.stationId,'Central Pier');
const unflaggedNull={...make('temperature','HK Park','temperatureC',null),missing:false};
result=(await analyse([unflaggedNull])).payload;
assert.equal(result.regional.temperature,null,'Null temperature must not become zero in regional statistics');
console.log('选点分析：最近站、缺测替代、资料不足、坐标校验均通过');
