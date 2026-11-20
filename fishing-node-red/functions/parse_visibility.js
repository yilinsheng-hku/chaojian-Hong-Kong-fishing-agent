if (msg.statusCode !== 200) { node.error('HTTP ' + msg.statusCode, msg); return null; }
let d;
try { d = JSON.parse(msg.payload); } catch (e) { node.error(e, msg); return null; }
const fetchedAt = new Date().toISOString();
const stations = ['Central', 'Sai Wan Ho'];
// HKO time is YYYYMMDDHHmm in Hong Kong time; store UTC ISO text.
const hkStamp = t => new Date(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:00+08:00`).toISOString();
const out = [];
for (const [time, station, raw] of d.data || []) {
  const t = String(time);
  if (!stations.includes(station) || !/^\d{12}$/.test(t)) continue;
  const at = hkStamp(t), v = parseFloat(String(raw).replace(/km/i, ''));
  out.push({_id: 'visibility:' + station + ':' + at, kind: 'visibility', station, at,
    visibilityKm: Number.isFinite(v) ? v : null, missing: !Number.isFinite(v), unit: 'km', sourceUrl: msg.url, fetchedAt});
}
msg.collection = 'observations';
msg.payload = out;
return msg;
