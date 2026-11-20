if (msg.statusCode !== 200) { node.error('HTTP ' + msg.statusCode, msg); return null; }
let data;
try { data = JSON.parse(msg.payload); } catch (e) { node.error(e, msg); return null; }
// HKO reports obsTime with a +08:00 offset. Store UTC ISO strings like every other
// collection, because MongoDB compares `at` as text in range queries.
const observed = new Date(data.obsTime);
if (!data.obsTime || Number.isNaN(observed.getTime())) return null;
const at = observed.toISOString(), fetchedAt = new Date().toISOString();
const stations = ['Shau Kei Wan', 'Happy Valley', 'Stanley', 'Wong Chuk Hang'];
msg.collection = 'observations';
msg.payload = (data.hourlyRainfall || [])
  .filter(x => stations.includes(x.automaticWeatherStation))
  .map(x => {
    const raw = String(x.value ?? '').trim(), v = Number(raw), ok = raw !== '' && Number.isFinite(v);
    return {
      _id: 'rain:' + x.automaticWeatherStation + ':' + at, kind: 'rain', station: x.automaticWeatherStation, at,
      rainMm: ok ? v : null, missing: !ok, period: 'past 1 hour', sourceUrl: msg.url, fetchedAt,
    };
  });
return msg;
