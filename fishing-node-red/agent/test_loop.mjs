import { Agent } from '@earendil-works/pi-agent-core';
import {createModels,fauxAssistantMessage,fauxProvider,fauxText,fauxToolCall} from '@earendil-works/pi-ai';
import {tools} from './server.mjs';

const faux=fauxProvider();
const models=createModels();
models.setProvider(faux.provider);
const agent=new Agent({initialState:{systemPrompt:'Test data retrieval',model:faux.getModel()},streamFn:models.streamSimple.bind(models)});
agent.state.tools=tools.filter(t=>['get_current_conditions','get_tide_window'].includes(t.name));
faux.setResponses([
  fauxAssistantMessage([fauxToolCall('get_current_conditions',{})],{stopReason:'toolUse'}),
  fauxAssistantMessage([fauxToolCall('get_tide_window',{hours:12})],{stopReason:'toolUse'}),
  fauxAssistantMessage([fauxText('已结合当前测站与未来潮汐回答。')]),
]);
const called=[];
agent.subscribe(e=>{if(e.type==='tool_execution_end')called.push(e.toolName)});
await agent.prompt('未来 12 小时潮汐如何？');
const last=[...agent.state.messages].reverse().find(x=>x.role==='assistant');
if(called.join(',')!=='get_current_conditions,get_tide_window'||!last.content.some(x=>x.type==='text'&&x.text.includes('已结合')))throw new Error('pi agent 多轮工具链验证失败: '+called.join(','));
console.log('pi agent 多轮工具链通过:',called.join(' -> '));
