import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=name=>readFileSync(new URL('../functions/'+name+'.js',import.meta.url),'utf8');
const request=load('tide_request').replace('__DATA_TYPE__','HHOT');
function requestAt(iso){
  const sent=[];
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:[iso]))}}
  new Function('msg','node','Date',request)({}, {send:msg=>sent.push(msg)},FixedDate);
  return sent;
}
assert.deepEqual(requestAt('2026-11-18T04:00:00Z').map(x=>x.tideYear),[2026]);
assert.deepEqual(requestAt('2026-12-31T17:00:00Z').map(x=>x.tideYear),[2027,2026]);
assert.deepEqual(requestAt('2027-12-31T02:00:00Z').map(x=>x.tideYear),[2027,2028]);
for(const msg of requestAt('2026-12-31T17:00:00Z'))assert.ok(msg.url.includes('year='+msg.tideYear));

const parsePred=new Function('msg','node',load('parse_pred'));
const errors=[];
const node={error:error=>errors.push(error)};
const values=Array.from({length:24},()=>1.2);values[2]='----';
const parsed=parsePred({statusCode:200,tideYear:2027,url:'https://example.test/?year=2027',payload:'month,day,...\n'+[1,1,...values].join(',')},node);
assert.equal(parsed.payload[0].at,'2026-12-31T17:00:00.000Z');
assert.equal(parsed.payload.at(-1).at,'2027-01-01T16:00:00.000Z');
assert.equal(parsed.payload.length,23);
assert.equal(parsePred({statusCode:200,payload:''},node),null);
assert.equal(errors.length,1);
const parseEvents=new Function('msg','node',load('parse_events'));
const events=parseEvents({statusCode:200,tideYear:2027,url:'https://example.test',payload:'month,day,time,height\n1,1,0100,1.8,0700,0.6,1300,1.7,1900,0.5'},node).payload;
assert.equal(events[0].at,'2026-12-31T17:00:00.000Z');
assert.deepEqual(events.map(e=>e.eventType),['high','low','high','low']);
// HKO rain obsTime carries +08:00; it must be stored as UTC ISO text so Mongo string ranges work.
const parseRain=new Function('msg','node',load('parse_rain'));
const rain=parseRain({statusCode:200,url:'https://example.test/rain',payload:JSON.stringify({obsTime:'2026-11-19T14:45:00+08:00',hourlyRainfall:[
  {automaticWeatherStation:'Stanley',value:'0'},{automaticWeatherStation:'Happy Valley',value:'M'},{automaticWeatherStation:'Lau Fau Shan',value:'3'}]})},node).payload;
assert.deepEqual(rain.map(x=>x.station),['Stanley','Happy Valley']);
assert.equal(rain[0].at,'2026-11-19T06:45:00.000Z');
assert.ok(rain[0].at<'2026-11-19T07:00:00.000Z','rain time must sort correctly against UTC query bounds');
assert.equal(rain[0].rainMm,0);
assert.equal(rain[1].rainMm,null);assert.equal(rain[1].missing,true);

const parseForecast=new Function('msg','node',load('parse_forecast'));
const fnd=parseForecast({statusCode:200,url:'https://example.test/fnd',payload:JSON.stringify({
  updateTime:'2026-11-20T16:30:00+08:00',
  generalSituation:'东北季候风正影响广东沿岸。',
  seaTemp:{place:'北角',value:24,unit:'C',recordTime:'2026-11-20T14:00:00+08:00'},
  weatherForecast:[{forecastDate:'20261121',week:'星期六',forecastWind:'东风4级',forecastWeather:'大致天晴',forecastMintemp:{value:21},forecastMaxtemp:{value:26},forecastMinrh:{value:60},forecastMaxrh:{value:80},PSR:'低'}]
})},node).payload[0];
assert.equal(fnd._id,'forecast:HKO');
assert.equal(fnd.at,'2026-11-20T08:30:00.000Z');
assert.equal(fnd.seaTemp.temperatureC,24);
assert.equal(fnd.days[0].tempMaxC,26);

const parseWarnings=new Function('msg','node',load('parse_warnings'));
const warn=parseWarnings({statusCode:200,url:'https://example.test/warnsum',payload:JSON.stringify({
  WTCSGNL:{name:'一号戒备信号',code:'TC1',actionCode:'ISSUE',issueTime:'2026-11-20T12:00:00+08:00',updateTime:'2026-11-20T15:00:00+08:00'}
})},node).payload[0];
assert.equal(warn._id,'warnings:HKO');
assert.equal(warn.count,1);
assert.equal(warn.active[0].code,'TC1');
assert.equal(warn.at,'2026-11-20T07:00:00.000Z');
console.log('Ingestion: Hong Kong year rollover, requested-year parsing, missing values, high/low events, UTC rain time, 9-day forecast and warnings passed.');
