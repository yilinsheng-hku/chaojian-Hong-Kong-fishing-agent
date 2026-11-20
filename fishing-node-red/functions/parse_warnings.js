if (msg.statusCode !== 200) { node.error('HTTP ' + msg.statusCode, msg); return null; }
let data;
try { data = JSON.parse(msg.payload); } catch (e) { node.error(e, msg); return null; }
const fetchedAt = new Date().toISOString();
const entries = Object.values(data || {}).filter(x => x && typeof x === 'object' && (x.name || x.code));
const active = entries.map(w => ({
  code: String(w.code || ''),
  name: String(w.name || w.code || ''),
  type: String(w.type || ''),
  actionCode: String(w.actionCode || ''),
  issueTime: w.issueTime ? new Date(w.issueTime).toISOString() : null,
  updateTime: w.updateTime ? new Date(w.updateTime).toISOString() : null,
}));
const times = active.map(w => w.updateTime || w.issueTime).filter(Boolean).sort();
const at = times.at(-1) || fetchedAt;
msg.collection = 'observations';
msg.payload = [{
  _id: 'warnings:HKO',
  kind: 'warnings',
  station: 'Hong Kong Observatory',
  at,
  active,
  count: active.length,
  missing: false,
  sourceUrl: msg.url,
  fetchedAt,
}];
return msg;
