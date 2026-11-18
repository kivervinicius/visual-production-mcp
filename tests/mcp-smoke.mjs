/** Real SDK stdio smoke test; run after npm install (CI), not in dependency-free unit tests. */
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const home=await fs.mkdtemp(path.join(os.tmpdir(),'vpm-mcp-smoke-'));
const client=new Client({name:'visual-production-mcp-smoke',version:'0.5.0'});
try {
  const transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'src/server.mjs')],cwd:root,env:{...process.env,STUDIO_HOME:home}});
  await client.connect(transport);
  const {tools}=await client.listTools();
  const expected=['studio_story_start','studio_story_status','studio_story_draft','studio_story_source','studio_story_submit_cast','studio_story_submit_storyboard','studio_story_prepare','studio_workflow_plan','production_get_status','production_get_next_action','production_events'];
  for(const name of expected)assert(tools.some(x=>x.name===name),`Missing ${name} in MCP handshake`);
  const create=await client.callTool({name:'studio_story_start',arguments:{id:'smoke',title:'MCP handshake',storyText:'A mulher entra na oficina. A porta se fecha.'}});
  assert(!create.isError,'story_start returned MCP error');
  const status=await client.callTool({name:'studio_story_status',arguments:{storyId:'smoke'}});
  assert(!status.isError,'story_status returned MCP error');
  const parsed=JSON.parse(status.content.find(x=>x.type==='text').text);
  assert.equal(parsed.next.stage,'cast');
  const guide=await client.callTool({name:'production_get_status',arguments:{storyId:'smoke'}});
  assert(!guide.isError,'production_get_status returned MCP error');
  const state=JSON.parse(guide.content.find(x=>x.type==='text').text);
  assert.equal(state.stages.length,10);assert.equal(state.nextAction.type,'SUBMIT_CAST');
  const evt=await client.callTool({name:'production_events',arguments:{storyId:'smoke',cursor:0}});
  assert(!evt.isError,'production_events returned MCP error');
  assert(JSON.parse(evt.content.find(x=>x.type==='text').text).events.length>0);
  console.log(`MCP stdio handshake OK (${tools.length} tools; guided intake and status verified)`);
} finally {
  try{await client.close();}catch{}
  await fs.rm(home,{recursive:true,force:true});
}
