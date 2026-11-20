const docs = msg.payload;
if (!Array.isArray(docs) || !docs.length) { node.done(); return; }
const MongoClient = global.get('mongodb').MongoClient;
let promise = global.get('mongoPromise');
if (!promise) {
  const client = new MongoClient(env.get('MONGO_URL'), {serverSelectionTimeoutMS: 5000});
  promise = client.connect().then(() => client);
  global.set('mongoPromise', promise);
}
// Indexes match the API / location-analysis queries; createIndex is idempotent.
const ensureIndexes = db => {
  if (global.get('fishingIndexes')) return;
  global.set('fishingIndexes', true);
  return Promise.all([
    db.collection('observations').createIndex({kind: 1, station: 1, at: -1}),
    db.collection('observations').createIndex({at: -1}),
    db.collection('predicted_tide').createIndex({station: 1, at: 1}),
    db.collection('tide_events').createIndex({station: 1, at: 1}),
  ]).catch(e => { global.set('fishingIndexes', false); node.warn('index creation failed: ' + e.message); });
};
promise.then(async client => {
  const db = client.db('fishing');
  await ensureIndexes(db);
  return db.collection(msg.collection).bulkWrite(
    docs.map(d => ({updateOne: {filter: {_id: d._id}, update: {$set: d}, upsert: true}})),
    {ordered: false}
  );
}).then(() => { node.status({fill: 'green', shape: 'dot', text: `${msg.collection}: ${docs.length}`}); node.done(); })
  .catch(e => { global.set('mongoPromise', null); node.error(e, msg); node.done(); });
return;
