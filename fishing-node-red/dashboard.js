const $ = id => document.getElementById(id);
const fmt = value => value ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Hong_Kong',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)) : '—';
const time = value => fmt(value).slice(-5);
const num = (value, digits=1) => value == null || !Number.isFinite(+value) ? '—' : (+value).toFixed(digits);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S = {data:null,hours:[],selected:null,timelineCentered:false};
const toolLabels = {get_current_conditions:'当前测站',get_tide_window:'潮汐时段',get_island_rain:'港岛雨量',get_island_wind:'区域风况',compare_quarry_bay_tide:'潮位验证',get_data_sources:'数据来源',analyse_named_location:'地点环境',get_species_context:'目标鱼资料',get_weather_outlook:'天气展望与警告'};

function validObservation(row, field, maxAgeMinutes=90, now=Date.now()) {
  if (!row || row.missing || row[field] == null || !Number.isFinite(+row[field])) return false;
  const age = now - new Date(row.at).getTime();
  return Number.isFinite(age) && age >= -5*60000 && age <= maxAgeMinutes*60000;
}
function drawMetrics() {
  const d=S.data, l=d.latest, high=d.events.find(x=>x.eventType==='high' && +new Date(x.at)>Date.now());
  $('hero-time').textContent='数据检查于 '+fmt(d.generatedAt);
  $('hero-high').textContent=high ? time(high.at) : '--:--';
  $('hero-tide').textContent=(validObservation(l.tide,'heightM') ? num(l.tide.heightM,2) : '—')+' m';
  const specs=[['实测潮位','tide','heightM','m','鰂鱼涌',90],['平均风速','wind','speedKmh','km/h','北角',90],['过去一小时雨量','rain','rainMm','mm','筲箕湾',120],['气温','temperature','temperatureC','°C','筲箕湾',90],['能见度','visibility','visibilityKm','km','中环',90]];
  $('metrics').innerHTML=specs.map(([label,kind,field,unit,station,age])=>{
    const row=l[kind], valid=validObservation(row,field,age);
    return `<div class="metric surface ${valid?'':'metric-missing'}"><span>${label}</span><b>${valid?num(row[field],kind==='tide'?2:1):'—'}<small> ${unit}</small></b><small>${station} · ${valid?fmt(row.at):'暂无有效观测'}</small>${!valid&&row?.at?`<small>最近记录 ${fmt(row.at)}</small>`:''}</div>`;
  }).join('');
  const wind=validObservation(l.wind,'speedKmh'),rain=validObservation(l.rain,'rainMm',120);
  const message=!wind||!rain?'风或雨资料缺失 / 过期，示范条件暂无法判断':l.wind.speedKmh>25||l.rain.rainMm>5?'附近测站超过示范风雨条件':'附近测站满足示范风雨条件';
  $('status').textContent=message+' · 平均风速 ≤ 25 km/h，过去一小时雨量 ≤ 5 mm';
  $('status').classList.toggle('alert',!wind||!rain||l.wind.speedKmh>25||l.rain.rainMm>5);
  $('conditions-summary').textContent=`${wind?`北角平均风 ${num(l.wind.speedKmh)} km/h`:'北角风速暂缺'}，${rain?`筲箕湾过去一小时${l.rain.rainMm===0?'未录得雨量':`雨量 ${num(l.rain.rainMm)} mm`}`:'筲箕湾雨量暂缺'}。不同测站提供区域参考；未来 24 小时先看潮位变化，出发前再核对风雨。`;
  const ob=$('outlook-bar');
  if(ob){
    const f=d.forecast,w=d.warnings,parts=[];
    if(w?.active?.length)parts.push(`<strong>生效警告：</strong>${w.active.map(x=>esc(x.name)).join('、')}`);
    else if(w)parts.push(`<strong>天气警告：</strong>当前无生效警告`);
    if(f?.seaTemp?.temperatureC!=null)parts.push(`<strong>${esc(f.seaTemp.place||'北角')}参考海温：</strong>${num(f.seaTemp.temperatureC,1)} °C`);
    if(f?.days?.length){
      const next=f.days[0];
      parts.push(`<strong>明日展望（${esc(next.week||next.date)}）：</strong>${esc(next.wind)} · ${esc(next.weather)}`);
    }
    if(parts.length){ob.hidden=false;ob.innerHTML=parts.map(p=>`<span>${p}</span>`).join('');}else{ob.hidden=true;}
  }
}

// Render a small Markdown subset. Every text segment is escaped; only HTTP(S) links survive.
function answerInline(text) {
  const pattern=/\[([^\]]+)\]\(([^\s)]+)\)|https?:\/\/[^\s<>"，。；）]+|\*\*([^*]+)\*\*/g;
  let html='',start=0;
  for (const match of String(text).matchAll(pattern)) {
    html+=esc(text.slice(start,match.index));
    if (match[3]) html+='<strong>'+esc(match[3])+'</strong>';
    else {
      const label=match[1] || match[0], raw=match[2] || match[0];
      let url;
      try { const parsed=new URL(raw); if (['http:','https:'].includes(parsed.protocol)) url=parsed.href; } catch {}
      html+=url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:esc(label);
    }
    start=match.index+match[0].length;
  }
  return html+esc(text.slice(start));
}
function formatAnswer(text) {
  let html='',list=false;
  for (const line of String(text).split(/\r?\n/)) {
    const item=line.match(/^\s*(?:[-*]|\d+[.)、])\s+(.+)$/);
    if (item) { if(!list){html+='<ul>';list=true} html+='<li>'+answerInline(item[1])+'</li>';continue; }
    if(list){html+='</ul>';list=false}
    const heading=line.match(/^\s*#{1,4}\s+(.+)$/);
    if(heading)html+='<h4>'+answerInline(heading[1])+'</h4>';
    else if(line.trim())html+='<p>'+answerInline(line)+'</p>';
  }
  return html+(list?'</ul>':'');
}
async function expertStatus() {
  try {
    const r=await fetch('/fishing/assistant/status'),j=await r.json();
    if(!r.ok)throw Error();
    $('expert-status').textContent=j.configured&&j.modelAvailable?(j.mode==='local-llm'?'本地免密钥模型已连接 · '+j.model:'模型已连接 · '+j.model):j.configured?'模型配置需检查':'内置测站问答引擎 · 免密钥实时数据';
  } catch { $('expert-status').textContent='助手服务暂不可用'; }
}
function bubble(text,kind) {
  const el=document.createElement('div');el.className='expert-bubble '+kind;el.textContent=text;
  $('expert-messages').appendChild(el);$('expert-messages').scrollTop=$('expert-messages').scrollHeight;return el;
}
const chatHistory=[];
let chatBusy=false;
async function askExpert(question) {
  const q=String(question).trim();if(!q||chatBusy)return;
  chatBusy=true;
  const button=$('expert-form').querySelector('button'),input=$('expert-input');
  bubble(q,'expert-user');input.value='';button.disabled=true;
  document.querySelectorAll('[data-question]').forEach(b=>b.disabled=true);
  const pending=bubble('正在读取测站，核对环境与潮汐…','expert-intro');
  try {
    const r=await fetch('/fishing/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,history:chatHistory.slice(-6)}),signal:AbortSignal.timeout(95000)}),j=await r.json();
    if(!r.ok||!j.answer)throw Error(j.message||'助手服务不可用');
    pending.classList.add('formatted-answer');pending.innerHTML=formatAnswer(j.answer);
    const completed=(j.trace||[]).filter(x=>x.status==='finished').map(x=>toolLabels[x.tool]||'测站查询');
    if(completed.length){const trace=document.createElement('div');trace.className='expert-trace';trace.textContent=(j.mode==='offline-preview'?'本地分析':'已核对')+' · '+completed.join(' → ');$('expert-messages').appendChild(trace)}
    chatHistory.push({role:'user',content:q},{role:'assistant',content:j.answer});
    $('expert-messages').scrollTop=$('expert-messages').scrollHeight;
  } catch(e) {pending.textContent='暂时无法回答：'+(e.name==='TimeoutError'?'查询超时，请稍后重试':e.message)}
  finally {chatBusy=false;button.disabled=false;document.querySelectorAll('[data-question]').forEach(b=>b.disabled=false);input.focus()}
}
$('expert-form').addEventListener('submit',e=>{e.preventDefault();askExpert($('expert-input').value)});
document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>askExpert(b.dataset.question));
