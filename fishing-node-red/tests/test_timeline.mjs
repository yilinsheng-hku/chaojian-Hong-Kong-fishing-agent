import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../dashboard_v2.js',import.meta.url),'utf8');
const {makeTimelineRows,getTideWindows}=new Function('$',source+'\nreturn {makeTimelineRows,getTideWindows};')(()=>({addEventListener(){}}));
const hour=Date.UTC(2026,10,18,4),now=hour+20*60000;
const row=(at,field,value,station)=>({at:new Date(at).toISOString(),[field]:value,station});
const predicted=Array.from({length:49},(_,i)=>row(hour+(i-24)*3600000,'heightM',1+Math.sin(i/4)*.6,'Quarry Bay'));
const tide=[row(hour-3600000,'heightM',1.55,'Quarry Bay'),row(hour,'heightM',1.57,'Quarry Bay')];
const wind=[row(hour,'speedKmh',10,'North Point')],rain=[row(hour,'rainMm',0,'Shau Kei Wan')];
const data={predicted,tide,wind,rain,temperature:[],visibility:[]};
const rows=makeTimelineRows(data,now);
assert.equal(rows.length,49);
assert.equal(rows[24].source,'实测');
assert.equal(rows[24].wind.station,'North Point');
assert.ok(Math.abs(rows[24].changeMPerHour-.02)<1e-9);
assert.equal(rows[25].source,'预测');
assert.equal(rows[25].wind,null);
assert.equal(rows[25].rain,null);
assert.equal(rows[25].changeMPerHour,null,'Do not mix observed and predicted heights');
assert.equal('score' in rows[24],false,'Do not imply a calibrated catch score');

const changed=structuredClone(data);
changed.predicted[0].heightM=20;
assert.equal(makeTimelineRows(changed,now)[35].changeMPerHour,rows[35].changeMPerHour,'An unrelated extreme must not rescale other intervals');
const gap=structuredClone(data);
gap.predicted=gap.predicted.filter(x=>x.at!==rows[35].at);
assert.equal(makeTimelineRows(gap,now)[36].changeMPerHour,null,'Do not bridge an empty hour');
const missing=makeTimelineRows({predicted:[],tide:[],wind:[],rain:[]},now);
assert.ok(missing.every(r=>r.changeMPerHour==null));
assert.deepEqual(getTideWindows(missing,now),[]);
const windows=getTideWindows(rows,now);
assert.equal(windows.length,3);
for(const window of windows){
  assert.ok(+new Date(window.at)-3600000>=now);
  assert.equal(window.source,'预测');
  assert.equal(window.wind,null);
}
assert.ok(windows.every((row,i)=>!i||row.index-windows[i-1].index>=3));
const staleWind=[row(hour-2*3600000,'speedKmh',12,'North Point')];
assert.equal(makeTimelineRows({...data,wind:staleWind},now)[24].wind,null);
console.log('Timeline: stable physical change, source boundaries, gaps, future weather and reference windows passed.');
