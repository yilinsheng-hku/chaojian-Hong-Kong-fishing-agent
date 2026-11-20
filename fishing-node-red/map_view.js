// Leaflet is optional: the coordinate diagram and place picker also work offline.
const namedPlaces=[
  {cn:'坚尼地城',en:'Kennedy Town',lat:22.2818,lon:114.1286},
  {cn:'中环',en:'Central',lat:22.2874,lon:114.1568},
  {cn:'北角',en:'North Point',lat:22.2939,lon:114.2002},
  {cn:'筲箕湾',en:'Shau Kei Wan',lat:22.2822,lon:114.2359},
  {cn:'赤柱',en:'Stanley',lat:22.2152,lon:114.2192},
  {cn:'香港仔',en:'Aberdeen',lat:22.2452,lon:114.1547}
];
const kindColors={tide:'#397bba',wind:'#168d91',rain:'#cc704f',temperature:'#ac7a35',visibility:'#8063aa'};
let realMap=null,selectionLayer=null,mapMode='diagram',tilesReady=false,preferredMapMode='real';
function setMapMode(mode,message) {
  mapMode=mode;
  $('real-map').hidden=mode!=='real';$('station-map').toggleAttribute('hidden',mode==='real');
  $('map-real').setAttribute('aria-pressed',String(mode==='real'));
  $('map-diagram').setAttribute('aria-pressed',String(mode==='diagram'));
  if(message)$('map-status').textContent=message;
  if(mode==='real'&&realMap)realMap.invalidateSize();
}
function updateMapSelection() {
  drawSchematicMap();
  const selected=lastLocationResult?Object.entries(lastLocationResult.data).filter(([,item])=>item.selected):[];
  $('station-map').insertAdjacentHTML('beforeend',selected.map(([kind,item])=>{
    const point=item.selected;
    return `<line x1="${MX(chosenLocation.lon)}" y1="${MY(chosenLocation.lat)}" x2="${MX(point.lon)}" y2="${MY(point.lat)}" stroke="${kindColors[kind]}" stroke-width="2" stroke-dasharray="5 4" pointer-events="none"/>`;
  }).join(''));
  if(!selectionLayer)return;
  selectionLayer.clearLayers();
  if(!chosenLocation)return;
  L.circleMarker([chosenLocation.lat,chosenLocation.lon],{radius:9,color:'#fff',weight:3,fillColor:'#e77e67',fillOpacity:1}).bindTooltip('所选参考坐标').addTo(selectionLayer);
  for(const [kind,item] of selected){const p=item.selected;L.polyline([[chosenLocation.lat,chosenLocation.lon],[p.lat,p.lon]],{color:kindColors[kind],weight:3,dashArray:'6 5'}).bindTooltip(`${p.station} · ${p.distanceKm} km`).addTo(selectionLayer)}
}
function createRealMap() {
  if(realMap)return;
  setMapMode('real','正在加载 OpenStreetMap 底图…');
  realMap=L.map('real-map',{scrollWheelZoom:false,minZoom:10,maxZoom:18,maxBounds:[[22.10,113.98],[22.42,114.40]]}).fitBounds([[22.18,114.10],[22.33,114.28]]);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(realMap);
  let failedTiles=0;
  const readyTimer=setTimeout(()=>{if(!tilesReady)setMapMode('diagram','底图暂未加载，已显示坐标示意图；可点击“真实地图”重试查看。')},12000);
  tiles.on('tileload',()=>{tilesReady=true;clearTimeout(readyTimer);if(mapMode==='real')$('map-status').textContent='真实地理底图 · 点击位置，查看采用测站的连线'});
  tiles.on('tileerror',()=>{failedTiles++;if(!tilesReady&&failedTiles>=3)setMapMode('diagram','底图连接失败，已显示坐标示意图。')});
  for(const p of coastalStations){
    L.marker([p.lat,p.lon],{title:p.cn,icon:L.divIcon({className:'station-marker '+(p.offshore?'offshore':p.sampling?'sampling':''),html:'<span></span>',iconSize:[18,18],iconAnchor:[9,9]})})
      .bindTooltip(esc(p.cn)+' · '+esc(p.kinds),{direction:'top'}).on('click',()=>activateStation(p)).addTo(realMap);
  }
  selectionLayer=L.layerGroup().addTo(realMap);
  realMap.on('click',e=>{
    if(e.latlng.lat<mapBounds.minLat||e.latlng.lat>mapBounds.maxLat||e.latlng.lng<mapBounds.minLon||e.latlng.lng>mapBounds.maxLon){$('map-status').textContent='请选择香港岛参考范围内的位置。';return}
    selectLocation(e.latlng.lat,e.latlng.lng);
  });
  updateMapSelection();
}
let leafletLoading=false,leafletStylesReady=false,loadAttempt=0;
function loadRealMap() {
  preferredMapMode='real';
  if(realMap){
    setMapMode('real',tilesReady?'真实地理底图 · 点击位置查看测站连线':'正在重试加载底图…');
    if(chosenLocation&&lastLocationResult){const points=[[chosenLocation.lat,chosenLocation.lon],...Object.values(lastLocationResult.data).filter(item=>item.selected).map(item=>[item.selected.lat,item.selected.lon])];realMap.fitBounds(points,{padding:[32,32],maxZoom:14,animate:false})}
    return;
  }
  if(window.L&&leafletStylesReady){createRealMap();return}
  if(leafletLoading)return;
  const attempt=++loadAttempt;
  leafletLoading=true;$('map-status').textContent='正在连接真实地图，期间可使用坐标示意图。';
  const link=document.createElement('link');link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';link.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';link.crossOrigin='anonymous';document.head.appendChild(link);
  const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';script.crossOrigin='anonymous';
  let settled=false,scriptReady=false;
  const finish=()=>{if(attempt!==loadAttempt||settled||!scriptReady||!leafletStylesReady)return;settled=true;clearTimeout(timer);leafletLoading=false;if(preferredMapMode==='real')createRealMap()};
  const fail=message=>{if(attempt!==loadAttempt||settled)return;settled=true;clearTimeout(timer);leafletLoading=false;setMapMode('diagram',message)};
  const timer=setTimeout(()=>fail('地图连接较慢，继续使用坐标示意图；稍后可重试。'),10000);
  link.onload=()=>{leafletStylesReady=true;finish()};
  link.onerror=()=>fail('地图样式暂不可用，继续使用坐标示意图。');
  script.onload=()=>{scriptReady=true;finish()};
  script.onerror=()=>fail('真实地图暂不可用，街区定位与测站分析仍可使用。');
  document.head.appendChild(script);
}
function initLocationMap() {
  mapHint.textContent='11 个港岛参考点、2 个邻近离岛风站、3 个定期水质采样点。街区坐标用于环境参考，岸边通达与许可需现场核对。';
  $('place-options').innerHTML=namedPlaces.map(p=>`<option value="${p.cn}">${p.en}</option>`).join('');
  $('place-form').addEventListener('submit',e=>{
    e.preventDefault();const value=$('place-input').value.trim().toLowerCase();
    const place=namedPlaces.find(p=>p.cn===value||p.en.toLowerCase()===value);
    if(!place){$('place-feedback').textContent='请选择列表中的街区：坚尼地城、中环、北角、筲箕湾、赤柱或香港仔。';return}
    $('place-feedback').textContent=place.cn+' · 街区参考坐标';
    selectLocation(place.lat,place.lon);
  });
  $('map-real').onclick=loadRealMap;
  $('map-diagram').onclick=()=>{preferredMapMode='diagram';setMapMode('diagram','经纬度坐标示意图 · 海岸轮廓为示意')};
  updateMapSelection();loadRealMap();
}
