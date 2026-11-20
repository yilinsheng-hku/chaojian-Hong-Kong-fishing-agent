if (msg.statusCode !== 200) { node.error('HTTP ' + msg.statusCode, msg); return null; }
const fetchedAt = new Date().toISOString();
const stations = ['Shau Kei Wan', 'Stanley', 'Happy Valley', 'Wong Chuk Hang', 'HK Park'];
// HKO time is YYYYMMDDHHmm in Hong Kong time; store UTC ISO text.
const hkStamp = t => new Date(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:00+08:00`).toISOString();
const rows = String(msg.payload).replace(/^﻿/, '').trim().split(/\r?\n/).map(s => s.split(','));
const out = [];
for (const [t, station, value] of rows.slice(1)) {
  if (!stations.includes(station) || !/^\d{12}$/.test(t)) continue;
  const raw = (value || '').trim(), v = Number(raw), ok = raw !== '' && Number.isFinite(v);
  const at = hkStamp(t);
  out.push({_id: 'temperature:' + station + ':' + at, kind: 'temperature', station, at,
    temperatureC: ok ? v : null, missing: !ok, sourceUrl: msg.url, fetchedAt});
}
msg.collection = 'observations';
msg.payload = out;
return msg;
