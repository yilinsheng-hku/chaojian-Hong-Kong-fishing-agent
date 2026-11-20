// Main 48-hour tide timeline. All times are hourly Hong Kong local moments stored as UTC ISO.
function closestAt(rows, target, maxMinutes, field, beforeOnly=false) {
  let best=null, gap=Infinity;
  for (const row of rows||[]) {
    if (row.missing || row[field]==null || !Number.isFinite(+row[field])) continue;
    const delta=+new Date(row.at)-target;
    if (beforeOnly && delta>0) continue;
    const distance=Math.abs(delta);
    if (distance<gap && distance<=maxMinutes*60000) {best=row;gap=distance}
  }
  return best;
}
function makeTimelineRows(data, now=Date.now()) {
  const hour=Math.floor(now/3600000)*3600000;
  const tides=(data.predicted||[]), actual=(data.tide||[]);
  const rows=[];
  for(let offset=-24;offset<=24;offset++){
    const t=hour+offset*3600000, past=t<=now;
    const measured=past?closestAt(actual,t,25,'heightM'):null;
    const forecast=closestAt(tides,t,35,'heightM');
    const tide=measured||forecast;
    const observed=past?{
      wind:closestAt((data.wind||[]).filter(x=>x.station==='North Point'),t,75,'speedKmh',true),
      rain:closestAt((data.rain||[]).filter(x=>x.station==='Shau Kei Wan'),t,75,'rainMm',true),
      temperature:closestAt((data.temperature||[]).filter(x=>x.station==='Shau Kei Wan'),t,75,'temperatureC',true),
      visibility:closestAt((data.visibility||[]).filter(x=>x.station==='Central'),t,75,'visibilityKm',true)
    }:{wind:null,rain:null,temperature:null,visibility:null};
    rows.push({at:new Date(t).toISOString(),offset,past,tide,source:measured?'实测':forecast?'预测':'无',...observed});
  }
  for(let i=0;i<rows.length;i++){
    const row=rows[i], previous=rows[i-1];
    const hours=row.tide&&previous?.tide ? (+new Date(row.tide.at)-+new Date(previous.tide.at))/3600000 : 0;
    // Do not calculate a jump between observed and predicted series, or across a gap.
    row.changeMPerHour=row.tide&&previous?.tide&&row.source===previous.source&&hours>=.5&&hours<=1.5
      ? (row.tide.heightM-previous.tide.heightM)/hours : null;
    row.evidence=row.wind&&row.rain?'同时段风雨观测可用':'风雨缺测或未来未知';
  }
  return rows;
}
function getTideWindows(rows, now=Date.now()) {
  const candidates=rows.map((row,index)=>({...row,index}))
    .filter(row=>!row.past&&row.source==='预测'&&row.changeMPerHour!=null&&Math.abs(row.changeMPerHour)>.0001&&+new Date(row.at)-3600000>=now)
    .sort((a,b)=>Math.abs(b.changeMPerHour)-Math.abs(a.changeMPerHour)||a.index-b.index);
  const selected=[];
  for(const row of candidates){if(selected.every(other=>Math.abs(other.index-row.index)>=3))selected.push(row);if(selected.length===3)break}
  return selected.sort((a,b)=>a.index-b.index);
}
function renderTideWindows() {
  const windows=getTideWindows(S.hours);
  $('tide-windows').innerHTML=windows.length?windows.map(row=>`<button type="button" class="tide-window" data-hour="${row.index}"><span>${fmt(+new Date(row.at)-3600000)}–${time(row.at)}</span><strong>${row.changeMPerHour>0?'↑ 涨潮':'↓ 落潮'} ${num(Math.abs(row.changeMPerHour),2)} m/h</strong><small>查看该小时 →</small></button>`).join(''):'<p class="tiny">暂无完整的未来潮位变化区间；等待预测数据。</p>';
  $('tide-windows').querySelectorAll('[data-hour]').forEach(button=>button.onclick=()=>{pick(+button.dataset.hour);$('timeline-section').scrollIntoView({behavior:'smooth',block:'start'})});
}
function pick(index){S.selected=Math.max(0,Math.min(48,index));timeline()}
function timeline(){
  const rows=S.hours,svg=$('timeline');
  if(!rows.length || !rows.some(r=>r.tide)){svg.innerHTML='<text class="empty-label" x="50" y="205">当前没有足够的潮位资料</text>';moment();return}
  const heights=rows.filter(r=>r.tide).map(r=>r.tide.heightM),min=Math.floor((Math.min(...heights)-.1)*2)/2,max=Math.ceil((Math.max(...heights)+.1)*2)/2;
  const left=72,right=1140,top=36,bottom=348,X=i=>left+(right-left)*i/48,Y=v=>bottom-(v-min)/(max-min||1)*(bottom-top);
  let out=`<rect class="past-shade" x="${left}" y="${top}" width="${X(24)-left}" height="${bottom-top}"/><rect class="future-shade" x="${X(24)}" y="${top}" width="${right-X(24)}" height="${bottom-top}"/>`;
  for(let i=0;i<=4;i++){const val=min+(max-min)*i/4,y=Y(val);out+=`<line class="axis" x1="${left}" x2="${right}" y1="${y}" y2="${y}"/><text class="tick" x="8" y="${y+5}">${val.toFixed(1)} m</text>`}
  for(let i=0;i<=48;i+=6){const x=X(i),at=rows[i].at;out+=`<line class="axis" x1="${x}" x2="${x}" y1="${top}" y2="${bottom}"/><text class="tick" text-anchor="middle" x="${x}" y="392">${fmt(at)}</text>`}
  function paths(start,end,kind){let path='',segment=false,segments=[];for(let i=start;i<=end;i++){const r=rows[i],ok=r.tide&&(kind==='past'?r.past&&r.source==='实测':kind==='fallback'?r.past&&r.source==='预测':!r.past&&r.source==='预测');if(ok){path+=(segment?'L':'M')+X(i)+','+Y(r.tide.heightM);segment=true}else if(segment){segments.push(path);path='';segment=false}}if(segment)segments.push(path);return segments.map(p=>`<path class="${kind==='past'?'past-line':kind==='fallback'?'fallback-line':'forecast-line'}" d="${p}"/>`).join('')}
  out+=paths(0,24,'past')+paths(0,24,'fallback')+paths(24,48,'future');
  for(let i=0;i<rows.length;i++){if(rows[i].tide)out+=`<circle cx="${X(i)}" cy="${Y(rows[i].tide.heightM)}" r="${rows[i].source==='实测'?3.5:2.5}" fill="${rows[i].source==='实测'?'#168d91':'#e28a66'}"/>`}
  out+=`<line class="now-line" x1="${X(24)}" x2="${X(24)}" y1="${top}" y2="${bottom}"/><text class="tick" text-anchor="middle" x="${X(24)}" y="22">现在</text>`;
  const selected=Math.max(0,Math.min(48,S.selected));out+=`<line class="selected-line" x1="${X(selected)}" x2="${X(selected)}" y1="${top}" y2="${bottom}"/>`;
  if(rows[selected].tide)out+=`<circle class="selected-mark" cx="${X(selected)}" cy="${Y(rows[selected].tide.heightM)}" r="7"/>`;
  svg.innerHTML=out;
  if(!S.timelineCentered){const sc=svg.parentElement;sc.scrollLeft=Math.max(0,(sc.scrollWidth-sc.clientWidth)/2);S.timelineCentered=true}
  const sc=svg.parentElement,selectedPixel=X(selected)*svg.clientWidth/1200;
  if(selectedPixel<sc.scrollLeft+25||selectedPixel>sc.scrollLeft+sc.clientWidth-25)sc.scrollLeft=Math.max(0,selectedPixel-sc.clientWidth/2);
  const choose=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const x=p.matrixTransform(svg.getScreenCTM().inverse()).x;pick(Math.max(0,Math.min(48,Math.round((x-left)/(right-left)*48))))};
  svg.onpointermove=e=>{if(e.pointerType==='mouse')choose(e)};svg.onclick=choose;svg.tabIndex=0;svg.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();pick(Math.max(0,Math.min(48,S.selected+(e.key==='ArrowRight'?1:-1))))}};
  $('tide-events').innerHTML=(S.data.events||[]).filter(x=>+new Date(x.at)>=Date.now()&&+new Date(x.at)<=Date.now()+24*3600000).slice(0,4).map(x=>`<span>${x.eventType==='high'?'↑ 高潮':'↓ 低潮'} ${fmt(x.at)} · ${num(x.heightM,2)} m</span>`).join('');
  moment();
}
function moment(){
  const r=S.hours[S.selected];if(!r)return;
  const card=(name,row,field,unit)=>`<div class="moment-card"><span>${name}</span><strong>${row?num(row[field],1)+' '+unit:'无'}</strong><small>${row?esc(row.station)+' · '+fmt(row.at):r.past?'该时段无有效观测':'无逐时预报'}</small></div>`;
  const partial=!r.wind||!r.rain;
  const verdict=partial?'风雨资料不完整，先看潮位依据':r.wind.speedKmh>25||r.rain.rainMm>5?'该时段测站超过示范风雨条件':'该时段测站满足示范风雨条件';
  const change=r.changeMPerHour;
  $('hour-slider').value=S.selected;$('hour-slider').setAttribute('aria-valuetext',fmt(r.at));$('hour-label').textContent=fmt(r.at);
  $('moment').innerHTML=`<div class="moment-heading"><div><div class="kicker">${r.past?'PAST / OBSERVATIONS':'FUTURE / TIDE FORECAST'}</div><div class="at">${fmt(r.at)}</div><strong class="moment-verdict">${verdict}</strong><div class="tiny">鰂鱼涌潮位：${r.tide?num(r.tide.heightM,2)+' m · '+r.source:'无'}${r.tide?.at?' · '+fmt(r.tide.at):''}</div></div><div class="change-readout"><span>较前一小时 · ${r.source}</span><strong>${change==null?'—':(change>0?'↑ ':change<0?'↓ ':'')+num(Math.abs(change),2)} <small>m/h</small></strong><small>${change==null?'相邻同类潮位资料不足':change>0?'潮位上升':change<0?'潮位下降':'潮位持平'}</small></div></div><div class="moment-data">${card('平均风速',r.wind,'speedKmh','km/h')}${card('过去一小时雨量',r.rain,'rainMm','mm')}${card('气温',r.temperature,'temperatureC','°C')}${card('能见度',r.visibility,'visibilityKm','km')}</div><p class="moment-explain">${esc(r.evidence)}。潮位变化按相邻同类读数与实际时间间隔计算，实测与预测交界处不计算跳变。m/h 表示潮位升降速度；地点化的水流速度与中鱼概率仍需其他证据。未来风雨不会用当前观测代替。</p>`;
}
function renderWestReferences(){
  const specs=[
    {name:'Central Pier',cn:'中环码头',kind:'wind',field:'speedKmh',unit:'km/h',place:'港岛本岛 · 西北岸'},
    {name:'HK Park',cn:'香港公园',kind:'temperature',field:'temperatureC',unit:'°C',place:'港岛本岛 · 西部内陆'},
    {name:'Wong Chuk Hang',cn:'黄竹坑',kind:'wind',field:'speedKmh',unit:'km/h',place:'港岛本岛 · 南部内陆'},
    {name:'Green Island',cn:'青洲',kind:'wind',field:'speedKmh',unit:'km/h',place:'港岛西侧离岛 · 仅区域参考'},
    {name:'Lamma Island',cn:'南丫岛',kind:'wind',field:'speedKmh',unit:'km/h',place:'港岛西南侧离岛 · 仅区域参考'}
  ];
  $('west-reference-data').innerHTML=specs.map(s=>{const row=(S.data[s.kind]||[]).find(x=>x.station===s.name&&validObservation(x,s.field));return `<div class="west-reference-row"><div><strong>${s.cn}</strong><small>${s.place}</small></div><div><b>${row?num(row[s.field],1)+' '+s.unit:'无当前有效数据'}</b><small>${row?fmt(row.at)+' · '+(s.kind==='wind'?'平均风速':'气温'):'站点已列入，等待观测'}</small></div>${row?.sourceUrl?`<a href="${esc(row.sourceUrl)}" target="_blank" rel="noopener">原始数据</a>`:''}</div>`}).join('');
}
let loadingData=false;
async function load(){
  if(loadingData)return;loadingData=true;
  try{
    const response=await fetch('/fishing/api',{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('API '+response.status);
    S.data=await response.json();S.hours=makeTimelineRows(S.data);
    if(!Number.isInteger(S.selected))S.selected=24;
    drawMetrics();timeline();renderTideWindows();renderWestReferences();
    if(chosenLocation)selectLocation(chosenLocation.lat,chosenLocation.lon,true);
  }catch(e){$('status').className='status-line alert';$('status').textContent='读取失败：'+e.message+' · 请稍后刷新';$('conditions-summary').textContent='测站数据暂不可用。可以先浏览地图，恢复连接后再核对读数。'}
  finally{loadingData=false}
}
$('hour-slider').addEventListener('input',e=>pick(+e.target.value));
