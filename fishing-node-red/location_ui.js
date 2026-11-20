// Injected into dashboard.html by sync_dashboard.py.
const coastalStations = [
  {name:'Central Pier',cn:'中环码头',lat:22.288889,lon:114.155833,kinds:'风、能见度',note:'能见度原始站名为 Central'},
  {name:'North Point',cn:'北角',lat:22.294444,lon:114.199722,kinds:'风'},
  {name:'Quarry Bay',cn:'鰂鱼涌',lat:22.291111,lon:114.213333,kinds:'潮位；另有雨量站',note:'雨量站暂未出现在所接的逐小时开放数据中'},
  {name:'Sai Wan Ho',cn:'西湾河',lat:22.2835,lon:114.2245,kinds:'能见度',note:'地图坐标为区域示意'},
  {name:'Shau Kei Wan',cn:'筲箕湾',lat:22.281667,lon:114.236111,kinds:'雨量、气温'},
  {name:'Happy Valley',cn:'跑马地',lat:22.270556,lon:114.183611,kinds:'雨量、气温',note:'现有内陆参考站'},
  {name:'Stanley',cn:'赤柱',lat:22.214167,lon:114.218611,kinds:'雨量、气温'},
  {name:'Bluff Head',cn:'黄麻角',lat:22.1975,lon:114.211944,kinds:'风、气温',note:'风文件原始站名为 Stanley；气温暂缺实时数据'},
  {name:"Cape D'Aguilar",cn:'鹤咀',lat:22.209444,lon:114.254722,kinds:'雨量',note:'目前所接逐小时雨量文件未列该站；不参与选站'},
  {name:'Wong Chuk Hang',cn:'黄竹坑',lat:22.247778,lon:114.173611,kinds:'风、雨量、气温',note:'近海区域参考站，不在岸线'},
  {name:'HK Park',cn:'香港公园',lat:22.278333,lon:114.162222,kinds:'气温',note:'港岛本岛内陆站，已参与选点气温候选'},
  {name:'Green Island',cn:'青洲',lat:22.285,lon:114.112778,kinds:'风',note:'港岛西侧离岛；仅作区域背景，不参与港岛选点的最近风站替代',offshore:true},
  {name:'Lamma Island',cn:'南丫岛',lat:22.226111,lon:114.108611,kinds:'风',note:'港岛西南侧离岛；仅作区域背景，不参与港岛选点的最近风站替代',offshore:true},
  {name:'WM1',cn:'WM1 西面海域',lat:22.250733,lon:114.122717,kinds:'海水水质 · 每月采样',note:'环保署海上定期采样点；未接入逐小时实时读数，不参与钓位分析',sampling:true},
  {name:'WT1',cn:'WT1 香港仔',lat:22.241567,lon:114.162283,kinds:'海水水质 · 双月采样',note:'环保署香港仔避风塘定期采样点；未接入逐小时实时读数',sampling:true},
  {name:'WT3',cn:'WT3 香港仔',lat:22.24685,lon:114.148633,kinds:'海水水质 · 双月采样',note:'环保署香港仔避风塘定期采样点；未接入逐小时实时读数',sampling:true},
];
const mapBounds={minLat:22.18,maxLat:22.33,minLon:114.10,maxLon:114.28};
const MX=lon=>40+(lon-mapBounds.minLon)/(mapBounds.maxLon-mapBounds.minLon)*680;
const MY=lat=>350-(lat-mapBounds.minLat)/(mapBounds.maxLat-mapBounds.minLat)*310;
const mapPanel=$('station-map').closest('section');
mapPanel.classList.add('location-map-panel');
mapPanel.insertAdjacentHTML('beforeend',`<div id="station-hover" class="station-hover" role="status" hidden></div><div id="location-summary" class="location-summary" aria-live="polite">点击地图中的任意位置，读取附近测站并查看当前风雨条件。</div><details id="location-details" class="location-details"><summary>展开测站与数据来源详情</summary><div id="location-detail-body"></div></details>`);
const mapHint=mapPanel.querySelector('.scene-note');
mapHint.textContent='自绘港岛海岸示意图：11 个港岛参考点、2 个邻近离岛风站、3 个环保署定期采样点。海岸轮廓仅为示意；离岛风站和水质采样点不参与港岛实时选点。';
let chosenLocation=null;
function drawSchematicMap(){
  const svg=$('station-map');
  svg.setAttribute('viewBox','0 0 760 380');
  svg.setAttribute('aria-label','港岛海岸示意图。点击任意位置分析，悬浮测站查看数据类别。');
  let s='<rect width="760" height="380" fill="#dceeea"/>';
  s+='<path d="M76 150 C115 126 156 143 200 131 C254 119 292 130 343 117 C403 106 459 120 514 125 C566 128 603 140 645 145 C678 150 703 177 696 211 C700 251 681 288 641 304 C610 316 580 291 550 307 C520 320 480 337 452 331 C426 326 404 308 376 290 C346 275 304 262 275 260 C248 263 238 284 209 275 C180 266 174 245 150 242 C111 238 91 213 83 186 Z" fill="#e9e5d2" stroke="#7daea8" stroke-width="3"/>';
  s+='<path d="M96 158 C190 138 265 137 355 128 C455 118 575 139 676 170" fill="none" stroke="#fffefa" stroke-opacity=".65" stroke-width="3"/>';
  s+='<text x="55" y="35" class="map-water-label">维多利亚港</text><text x="375" y="230" class="map-land-label">香港岛</text><text x="578" y="345" class="map-water-label">南海</text>';
  if(chosenLocation)s+=`<circle class="chosen-ring" cx="${MX(chosenLocation.lon)}" cy="${MY(chosenLocation.lat)}" r="15"/><circle class="chosen-dot" cx="${MX(chosenLocation.lon)}" cy="${MY(chosenLocation.lat)}" r="6"/>`;
  for(const p of coastalStations){const x=MX(p.lon),y=MY(p.lat),kind=p.offshore?' offshore':p.sampling?' sampling':'',labelY=p.name==='Green Island'||p.name==='HK Park'?y+21:p.sampling?y+18:y-10;s+=`<g class="map-station${kind}" data-station="${esc(p.name)}" tabindex="0" role="button" aria-label="${p.cn}，${p.kinds}${p.offshore?'，邻近离岛，仅区域参考':p.sampling?'，非实时采样点':''}"><circle cx="${x}" cy="${y}" r="${p.offshore||p.sampling?8:7}"/><text x="${x+11}" y="${labelY}">${p.cn}</text></g>`}
  svg.innerHTML=s;
  svg.onclick=e=>{if(e.target.closest?.('[data-station]'))return;const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const local=pt.matrixTransform(svg.getScreenCTM().inverse());selectLocation(mapBounds.maxLat-(local.y-40)/310*(mapBounds.maxLat-mapBounds.minLat),mapBounds.minLon+(local.x-40)/680*(mapBounds.maxLon-mapBounds.minLon))};
  svg.querySelectorAll('[data-station]').forEach(g=>{const p=coastalStations.find(x=>x.name===g.dataset.station);g.onmouseenter=()=>showStation(p);g.onmouseleave=hideStation;g.onfocus=()=>showStation(p);g.onblur=hideStation;g.onclick=e=>{e.stopPropagation();activateStation(p)};g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activateStation(p)}}});
  $('station-list').innerHTML=coastalStations.map(p=>`<div class="station-row"><button type="button" data-station-pick="${esc(p.name)}">${p.cn}${p.offshore?' · 邻近离岛':p.sampling?' · 非实时':''}</button><span>${p.kinds}</span></div>`).join('');
  $('station-list').querySelectorAll('[data-station-pick]').forEach(button=>button.onclick=()=>activateStation(coastalStations.find(p=>p.name===button.dataset.stationPick)));
}
function activateStation(p){if(p.offshore||p.sampling){if(locationRequest)locationRequest.abort();chosenLocation=null;lastLocationResult=null;$('location-detail-body').replaceChildren();$('location-details').open=false;updateMapSelection();$('location-summary').textContent=p.offshore?`${p.cn}是邻近离岛风站，仅作区域背景，不对其坐标运行港岛钓位分析。请点击港岛地图上的位置。`:`${p.cn}是环保署定期水质采样点，尚无逐小时实时读数，不参与当前钓位判断。请点击港岛地图上的位置。`;return}selectLocation(p.lat,p.lon)}
function showStation(p){const box=$('station-hover');box.hidden=false;box.innerHTML=`<strong>${p.cn}</strong><span>${p.kinds}</span><small>${esc(p.note||'悬浮查看；点击可分析该坐标')}</small>`}
function hideStation(){$('station-hover').hidden=true}
let locationRequest=null,lastLocationResult=null;
async function selectLocation(lat,lon,refresh=false){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<mapBounds.minLat||lat>mapBounds.maxLat||lon<mapBounds.minLon||lon>mapBounds.maxLon)return;
  if(locationRequest)locationRequest.abort();
  const controller=new AbortController();locationRequest=controller;
  chosenLocation={lat:+lat.toFixed(6),lon:+lon.toFixed(6)};
  if(!refresh){lastLocationResult=null;updateMapSelection();$('location-summary').textContent='正在寻找最近的有效测站…';$('location-details').open=false;$('location-detail-body').replaceChildren()}
  try{
    const response=await fetch('/fishing/location-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(chosenLocation),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
    const result=await response.json();if(!response.ok)throw Error(result.error||'分析失败');
    if(controller.signal.aborted)return;
    lastLocationResult=result;renderLocation(result);updateMapSelection();
    if(!refresh&&realMap&&mapMode==='real'){
      const points=[[lat,lon],...Object.values(result.data).filter(item=>item.selected).map(item=>[item.selected.lat,item.selected.lon])];
      realMap.fitBounds(points,{padding:[32,32],maxZoom:14,animate:false});
    }
  }catch(error){if(!controller.signal.aborted){lastLocationResult=null;updateMapSelection();$('location-detail-body').replaceChildren();$('location-summary').textContent='分析失败：'+error.message}}
  finally{if(locationRequest===controller)locationRequest=null}
}
function renderLocation(result){
  const names={tide:'实测潮位',wind:'平均风速',rain:'过去一小时雨量',temperature:'气温',visibility:'能见度'};
  const css={insufficient:'unknown',caution:'caution','within-threshold':'good'}[result.status];
  $('location-summary').innerHTML=`<div class="location-result-head"><span class="location-pill ${css}">${esc(result.label)}</span><small>${result.point.lat.toFixed(4)}° N，${result.point.lon.toFixed(4)}° E · ${fmt(result.generatedAt)}</small></div><p>${result.reasons.map(esc).join('；')}</p><small>示范条件：平均风速 ≤ ${result.criteria.maxWindKmh} km/h、过去一小时雨量 ≤ ${result.criteria.maxRainMm} mm。按最近有效站逐项选取；详情可核对来源和区域差异。</small>`;
  const regional=Object.entries(result.regional||{}).filter(([,r])=>r).map(([kind,r])=>`${names[kind]}：${r.stationCount} 站，${num(r.min,1)}–${num(r.max,1)}，中位数 ${num(r.median,1)} ${kind==='wind'?'km/h':kind==='rain'?'mm':kind==='temperature'?'°C':'km'}`).join('；');
  $('location-detail-body').innerHTML=`<p class="scene-note"><strong>港岛区域背景：</strong>${regional||'暂无有效站点'}。范围是不同测站的读数，不是所选点的预测值。</p>`+Object.entries(result.data).map(([kind,item])=>{const v=item.selected;return `<div class="location-data-row"><strong>${names[kind]}</strong>${v?`<b>${num(v.value,kind==='tide'?2:1)} ${esc(v.unit)}</b><span>采用 ${esc(v.station)} · 距点 ${num(v.distanceKm,2)} km · ${fmt(v.at)}${v.rawStation!==v.stationId?' · 原始标签 '+esc(v.rawStation):''}${item.fallback?' · 已替代最近站':''}</span><a href="${esc(v.sourceUrl||'#')}" target="_blank" rel="noopener">查看原始数据来源</a>`:`<span>暂无范围内的有效观测；最近候选：${esc(item.nearestStation||'无')}</span>`}<small>${esc(item.scope)}</small>${item.rejected.length?`<small>未采用：${item.rejected.map(x=>`${esc(x.station)}（${num(x.distanceKm,2)} km，${esc(x.reason)}）`).join('；')}</small>`:''}</div>`}).join('')+`<p class="scene-note">${result.limitations.map(esc).join(' ')}</p><p class="scene-note">${esc(result.note)}</p>`;
}
