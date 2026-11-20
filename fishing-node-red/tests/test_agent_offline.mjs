// Exercise the actual offline tool planner and local key-free OpenAI-compatible gateway mode without external API calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule,SyntheticModule,createContext} from 'node:vm';
const at=new Date().toISOString(),calls=[];
const observation={station:'North Point',at,speedKmh:12};
const selection={station:'中环码头',at,value:14,sourceUrl:'https://example.test/wind'};
const data={
  region:'Hong Kong Island',generatedAt:at,
  latest:{wind:observation,tide:{at,heightM:1.2},rain:{at,rainMm:0},temperature:{at,temperatureC:24}},
  predicted:[],events:[{at:new Date(Date.now()+3600000).toISOString(),eventType:'high',heightM:1.8}],
  wind:[observation],rain:[],
  forecast:{at,generalSituation:'东北季候风影响广东沿岸',seaTemp:{place:'北角',temperatureC:24,recordTime:at},days:[{date:'20261121',week:'星期六',wind:'东风4级',weather:'大致天晴',tempMinC:21,tempMaxC:26,psr:'低'}]},
  warnings:{at,count:0,active:[]},
};
let llmTurn=0;
const context=createContext({console,process:{env:{AGENT_MODEL:'ollama:qwen2.5:7b',OPENAI_BASE_URL:'http://127.0.0.1:11434/v1'},argv:[]},setTimeout,clearTimeout,AbortController,AbortSignal,
  fetch:async(url,options)=>{
    calls.push({url:String(url),method:options?.method||'GET'});
    if(String(url).endsWith('/chat/completions')){
      llmTurn++;
      if(llmTurn===1){
        return {ok:true,json:async()=>({choices:[{message:{role:'assistant',content:'',tool_calls:[{id:'call_1',type:'function',function:{name:'get_weather_outlook',arguments:JSON.stringify({days:2})}}]}}]})};
      }
      return {ok:true,json:async()=>({choices:[{message:{role:'assistant',content:'### 天气展望\n已通过本地免密钥模型核对北角参考海温 24 °C 与未来预报。'}}]})};
    }
    return {ok:true,json:async()=>String(url).endsWith('/location-analysis')?{label:'满足示范风雨条件',data:{wind:{selected:selection},rain:{selected:{...selection,value:0}}}}:data};
  }
});
const mod=new SourceTextModule(readFileSync(new URL('../agent/server.mjs',import.meta.url),'utf8'),{context});
await mod.link(async specifier=>{
  if(specifier==='node:http')return new SyntheticModule(['default'],function(){this.setExport('default',{createServer:()=>({})})},{context});
  if(specifier.includes('pi-agent-core'))return new SyntheticModule(['Agent'],function(){this.setExport('Agent',class{})},{context});
  return new SyntheticModule(['builtinModels'],function(){this.setExport('builtinModels',()=>({getModel:()=>null}))},{context});
});
await mod.evaluate();
assert.equal(mod.namespace.tools.length,9);
const result=await mod.namespace.answerOffline('坚尼地城钓鲷鱼，有什么试钓建议？');
assert.equal(result.mode,'offline-preview');
assert.deepEqual(Array.from(result.trace.filter(x=>x.status==='finished'),x=>x.tool),['analyse_named_location','get_tide_window','get_species_context']);
for(const heading of ['当前环境','可参考时段','试钓思路','资料缺口','数据来源'])assert.ok(result.answer.includes('### '+heading));
assert.match(result.answer,/\[渔护署鱼类调查\]\(https:/);
assert.ok(calls.some(call=>call.method==='POST'));

// Follow-up question using conversation history (without repeating "坚尼地城")
const followUp=await mod.namespace.answerOffline('那如果改钓鲻鱼呢？',[{role:'user',content:'坚尼地城钓鲷鱼'},{role:'assistant',content:result.answer}]);
assert.ok(followUp.answer.includes('坚尼地城'));
assert.ok(followUp.answer.includes('鲻鱼'));

const outlookOffline=await mod.namespace.answerOffline('未来几天香港天气预报和海温如何？');
assert.ok(outlookOffline.answer.includes('北角参考海温 24 °C'));
assert.deepEqual(Array.from(outlookOffline.trace.filter(x=>x.status==='finished'),x=>x.tool),['get_weather_outlook']);

const localResult=await mod.namespace.answerLocalOpenAI('未来两天天气展望如何？',[]);
assert.equal(localResult.mode,'local-llm');
assert.deepEqual(Array.from(localResult.trace.filter(x=>x.status==='finished'),x=>x.tool),['get_weather_outlook']);
assert.ok(localResult.answer.includes('本地免密钥模型'));
console.log('Agent: offline location/species/outlook tool chain and local key-free LLM tool loop passed without external calls.');
