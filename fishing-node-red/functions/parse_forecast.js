if (msg.statusCode !== 200) { node.error('HTTP ' + msg.statusCode, msg); return null; }
let data;
try { data = JSON.parse(msg.payload); } catch (e) { node.error(e, msg); return null; }
const updated = new Date(data.updateTime || Date.now());
if (Number.isNaN(updated.getTime())) return null;
const at = updated.toISOString(), fetchedAt = new Date().toISOString();
const days = (data.weatherForecast || []).slice(0, 9).map(d => ({
  date: String(d.forecastDate || ''),
  week: String(d.week || ''),
  wind: String(d.forecastWind || ''),
  weather: String(d.forecastWeather || ''),
  tempMinC: d.forecastMintemp?.value != null ? Number(d.forecastMintemp.value) : null,
  tempMaxC: d.forecastMaxtemp?.value != null ? Number(d.forecastMaxtemp.value) : null,
  rhMinPct: d.forecastMinrh?.value != null ? Number(d.forecastMinrh.value) : null,
  rhMaxPct: d.forecastMaxrh?.value != null ? Number(d.forecastMaxrh.value) : null,
  psr: String(d.PSR || ''),
}));
const seaTemp = data.seaTemp?.place ? {
  place: String(data.seaTemp.place),
  temperatureC: Number(data.seaTemp.value),
  recordTime: data.seaTemp.recordTime ? new Date(data.seaTemp.recordTime).toISOString() : at,
} : null;
msg.collection = 'observations';
msg.payload = [{
  _id: 'forecast:HKO',
  kind: 'forecast',
  station: 'Hong Kong Observatory',
  at,
  generalSituation: String(data.generalSituation || ''),
  days,
  seaTemp,
  missing: days.length === 0,
  sourceUrl: msg.url,
  fetchedAt,
}];
return msg;
