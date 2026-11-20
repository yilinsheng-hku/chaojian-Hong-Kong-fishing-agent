const MongoClient=global.get('mongodb').MongoClient;
let promise=global.get('mongoPromise');
if(!promise){
  const client=new MongoClient(env.get('MONGO_URL'),{serverSelectionTimeoutMS:5000});
  promise=client.connect().then(()=>client);global.set('mongoPromise',promise);
}
promise.then(async client=>{
  const db=client.db('fishing'),now=Date.now();
  const from=new Date(now-48*3600000).toISOString(),to=new Date(now+48*3600000).toISOString();
  const rainStations=['Shau Kei Wan','Happy Valley','Stanley','Wong Chuk Hang'];
  const windStations=['North Point','Central Pier','Stanley','Wong Chuk Hang','Green Island','Lamma Island'];
  const [predicted,events,observations,forecast,warnings]=await Promise.all([
    db.collection('predicted_tide').find({station:'Quarry Bay',at:{$gte:from,$lte:to}}).sort({at:1}).toArray(),
    db.collection('tide_events').find({station:'Quarry Bay',at:{$gte:from,$lte:to}}).sort({at:1}).toArray(),
    db.collection('observations').find({at:{$gte:from,$lte:new Date(now+5*60000).toISOString()},$or:[
      {kind:'tide',station:'Quarry Bay'},
      {kind:'wind',station:{$in:windStations}},
      {kind:'rain',station:{$in:rainStations}},
      {kind:'temperature',station:{$in:['Shau Kei Wan','Stanley','Happy Valley','Wong Chuk Hang','HK Park']}},
      {kind:'visibility',station:{$in:['Central','Sai Wan Ho']}}
    ]}).sort({at:-1}).limit(6000).toArray(),
    db.collection('observations').findOne({_id:'forecast:HKO'}),
    db.collection('observations').findOne({_id:'warnings:HKO'})
  ]);
  const main={tide:'Quarry Bay',wind:'North Point',rain:'Shau Kei Wan',temperature:'Shau Kei Wan',visibility:'Central'};
  const latest=Object.fromEntries(Object.entries(main).map(([kind,station])=>[kind,observations.find(x=>x.kind===kind&&x.station===station)||null]));
  const past=predicted.filter(x=>+new Date(x.at)<=now);
  const tides=observations.filter(x=>x.kind==='tide'&&!x.missing&&x.heightM!=null&&Number.isFinite(+x.heightM));
  const matches=[];
  for(const p of past){
    const closest=tides.map(o=>({o,delta:Math.abs(+new Date(o.at)-+new Date(p.at))})).sort((a,b)=>a.delta-b.delta)[0];
    if(closest&&closest.delta<=10*60000)matches.push({at:p.at,predictedM:p.heightM,observedM:closest.o.heightM,errorM:+(closest.o.heightM-p.heightM).toFixed(3)});
  }
  const mae=matches.length?matches.reduce((sum,x)=>sum+Math.abs(x.errorM),0)/matches.length:null;
  msg.payload={generatedAt:new Date(now).toISOString(),region:'Hong Kong Island',adjacentIslandReferences:['Green Island','Lamma Island'],station:'Quarry Bay',latest,predicted,events,
    ...Object.fromEntries(Object.keys(main).map(kind=>[kind,observations.filter(x=>x.kind===kind)])),
    forecast:forecast||null,warnings:warnings||null,
    comparison:{sampleCount:matches.length,maeM:mae,matches}};
  msg.headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  node.send(msg);node.done();
}).catch(error=>{
  global.set('mongoPromise',null);msg.statusCode=503;msg.payload={error:error.message};node.send(msg);node.done();
});
return;
