// Node-RED Function node: analyse the selected point using current observations.
const MongoClient = global.get('mongodb').MongoClient;
const body = msg.payload || {};
const lat = Number(body.lat), lon = Number(body.lon);
const json = value => { msg.headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}; msg.payload = value; node.send(msg); node.done(); };
if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 22.18 || lat > 22.33 || lon < 114.10 || lon > 114.28) {
  msg.statusCode = 400;
  msg.payload = {error:'请选择地图范围内的位置'};
  msg.headers = {'Content-Type':'application/json; charset=utf-8'};
  return msg;
}

const stations = [
  {name:'Quarry Bay',cn:'鰂鱼涌',lat:22.291111,lon:114.213333,kinds:['tide','rain']},
  {name:'North Point',cn:'北角',lat:22.294444,lon:114.199722,kinds:['wind']},
  {name:'Central Pier',cn:'中环码头',lat:22.288889,lon:114.155833,kinds:['wind']},
  {name:'Central',cn:'中环能见度',lat:22.288889,lon:114.155833,kinds:['visibility']},
  {name:'Sai Wan Ho',cn:'西湾河',lat:22.2835,lon:114.2245,kinds:['visibility']},
  {name:'Shau Kei Wan',cn:'筲箕湾',lat:22.281667,lon:114.236111,kinds:['rain','temperature']},
  {name:'Happy Valley',cn:'跑马地',lat:22.270556,lon:114.183611,kinds:['rain','temperature']},
  {name:'HK Park',cn:'香港公园',lat:22.278333,lon:114.162222,kinds:['temperature']},
  {name:'Stanley',cn:'赤柱',lat:22.214167,lon:114.218611,kinds:['rain','temperature']},
  {name:'Bluff Head',cn:'黄麻角',lat:22.1975,lon:114.211944,kinds:['wind','temperature'],dataStation:'Stanley'},
  {name:"Cape D'Aguilar",cn:'鹤咀',lat:22.209444,lon:114.254722,kinds:['rain']},
  {name:'Wong Chuk Hang',cn:'黄竹坑',lat:22.247778,lon:114.173611,kinds:['wind','rain','temperature']},
];
const fields = {tide:'heightM',wind:'speedKmh',rain:'rainMm',temperature:'temperatureC',visibility:'visibilityKm'};
const maxAgeMinutes = {tide:90,wind:90,rain:120,temperature:90,visibility:90};
const maxDistanceKm = {tide:25,wind:20,rain:12,temperature:20,visibility:20};
const criteria = {maxWindKmh:25,maxRainMm:5};
const scope = {
  tide:'鰂鱼涌潮位可作维港及港岛北岸参考；南岸潮时与潮高可能不同',
  wind:'各风站可反映区域风况，实际岸边风速受海岸朝向、地形与建筑影响',
  rain:'短时降雨可能很局部，邻站读数只作附近参考',
  temperature:'气温可作港岛区域背景，不是水温',
  visibility:'能见度可作附近水域背景，雾与雨可局部变化',
};
const distanceKm = (a,b) => {
  const rad = Math.PI / 180, dLat = (b.lat-a.lat)*rad, dLon = (b.lon-a.lon)*rad;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.asin(Math.min(1,Math.sqrt(h)));
};
let promise = global.get('mongoPromise');
if (!promise) {
  const client = new MongoClient(env.get('MONGO_URL'),{serverSelectionTimeoutMS:5000});
  promise = client.connect().then(() => client);
  global.set('mongoPromise',promise);
}
promise.then(async client => {
  const now = Date.now(), since = new Date(now-3*3600000).toISOString();
  const db = client.db('fishing');
  const observations = await db.collection('observations').find({at:{$gte:since},kind:{$in:Object.keys(fields)}}).sort({at:-1}).limit(3000).toArray();
  const latest = new Map();
  for (const row of observations) {
    const key = row.kind+':'+row.station;
    if (!latest.has(key)) latest.set(key,row);
  }
  const data = {};
  for (const kind of Object.keys(fields)) {
    const ranked = stations.filter(s=>s.kinds.includes(kind)).map(s=>({...s,distanceKm:distanceKm({lat,lon},s)})).sort((a,b)=>a.distanceKm-b.distanceKm);
    const rejected = [];
    let selected = null;
    for (const station of ranked) {
      const row = latest.get(kind+':'+(kind==='wind'&&station.dataStation?station.dataStation:station.name));
      const ageMinutes = row ? (now-new Date(row.at).getTime())/60000 : Infinity;
      let reason = null;
      if (station.distanceKm > maxDistanceKm[kind]) reason = '超出参考距离';
      else if (!row || row.missing || row[fields[kind]] == null || !Number.isFinite(Number(row[fields[kind]]))) reason = '缺测';
      else if (!Number.isFinite(ageMinutes) || ageMinutes < -5 || ageMinutes > maxAgeMinutes[kind]) reason = '观测已过期';
      if (reason) {
        rejected.push({station:station.cn,distanceKm:+station.distanceKm.toFixed(2),reason});
        continue;
      }
      selected = {station:station.cn,stationId:station.name,rawStation:row.station,lat:station.lat,lon:station.lon,distanceKm:+station.distanceKm.toFixed(2),at:row.at,ageMinutes:+Math.max(0,ageMinutes).toFixed(1),value:Number(row[fields[kind]]),sourceUrl:row.sourceUrl,unit:{tide:'m above Chart Datum',wind:'km/h',rain:'mm / past hour',temperature:'°C',visibility:'km'}[kind],direction:kind==='wind'?row.direction:undefined,gustKmh:kind==='wind'?row.gustKmh:undefined};
      break;
    }
    data[kind] = {nearestStation:ranked[0]?.cn||null,selected,fallback:Boolean(selected && selected.stationId!==ranked[0]?.name),rejected,scope:scope[kind]};
  }
  const regional = {};
  for (const kind of ['wind','rain','temperature','visibility']) {
    const names = [...new Set(stations.filter(s=>s.kinds.includes(kind)).map(s=>kind==='wind'&&s.dataStation?s.dataStation:s.name))];
    const values = names.map(name=>latest.get(kind+':'+name)).filter(row=>row&&!row.missing&&row[fields[kind]]!=null&&Number.isFinite(Number(row[fields[kind]]))&&now-new Date(row.at).getTime()<=maxAgeMinutes[kind]*60000&&now-new Date(row.at).getTime()>=-5*60000).map(row=>Number(row[fields[kind]]));
    const sorted = values.sort((a,b)=>a-b);
    const mid = Math.floor(sorted.length/2);
    regional[kind] = sorted.length ? {stationCount:sorted.length,min:sorted[0],median:sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2,max:sorted[sorted.length-1]} : null;
  }
  const wind = data.wind.selected, rain = data.rain.selected;
  let status = 'insufficient', label = '资料不足，暂不能判断', reasons = [];
  if (!wind) reasons.push('没有范围内且未过期的风速观测');
  if (!rain) reasons.push('没有范围内且未过期的雨量观测');
  if (wind && rain) {
    if (wind.value > criteria.maxWindKmh || rain.value > criteria.maxRainMm) {
      status = 'caution'; label = '附近观测超过示范风雨条件';
      if (wind.value > criteria.maxWindKmh) reasons.push(`风速 ${wind.value} km/h 超过示范值 ${criteria.maxWindKmh} km/h`);
      if (rain.value > criteria.maxRainMm) reasons.push(`过去一小时雨量 ${rain.value} mm 超过示范值 ${criteria.maxRainMm} mm`);
    } else {
      status = 'within-threshold'; label = '附近观测满足示范风雨条件';
      reasons.push('最近有效风站和雨站均未超过示范值');
    }
  }
  if (regional.wind?.stationCount>=2 && regional.wind.max-regional.wind.min>=12) reasons.push('港岛风站差异较大，选点风速不宜视为现场值');
  if (regional.rain?.stationCount>=2 && regional.rain.max-regional.rain.min>=5) reasons.push('港岛雨量站差异较大，短时降雨不宜跨区套用');
  const limitations = ['本项目尚未接入实时海水温度与地点化的潮流速度；不能从气温、潮位高低或示意地图直接换算。','港岛海岸方位和地形只可用于提示迎风可能性；缺少精确岸线、地形与波浪数据时不调整测站风速。'];
  json({point:{lat,lon},generatedAt:new Date(now).toISOString(),status,label,reasons,criteria,regional,data,limitations,note:'示范筛选条件仅供环境比较；不代表钓位现场、合法可钓范围、人身安全或上鱼概率。'});
}).catch(error => {
  global.set('mongoPromise',null);
  msg.statusCode = 503;
  json({error:'测站数据暂不可用',detail:error.message});
});
return;
