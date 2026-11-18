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
const client=new Client({name:'visual-production-mcp-smoke',version:'0.7.0'});
try {
  const transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'src/server.mjs')],cwd:root,env:{...process.env,STUDIO_HOME:home}});
  await client.connect(transport);
  const {tools}=await client.listTools();
  const expected=['studio_story_start','studio_story_status','studio_story_draft','studio_story_source','studio_story_submit_cast','studio_story_submit_storyboard','studio_story_prepare','studio_workflow_plan','production_get_status','production_get_next_action','production_events','studio_visual_list','studio_visual_propose','studio_visual_get','studio_visual_impact','studio_visual_shot_submit','studio_flow_live_account','studio_flow_live_step','studio_flow_submit_step','studio_flow_reconcile_step','studio_flow_download_step'];
  for(const name of expected)assert(tools.some(x=>x.name===name),`Missing ${name} in MCP handshake`);
  assert(!tools.some(x=>/visual_(approve|reject)|visual_shot_review/.test(x.name)),'Human visual approval must never be exposed as an MCP tool');
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
  const png=path.join(home,'reference.png');
  await fs.writeFile(png,Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex'));
  const proposal=await client.callTool({name:'studio_visual_propose',arguments:{libraryId:'shared/smoke',kind:'character',name:'Smoke',description:'Simple cartoon person',referencePaths:[png]}});
  assert(!proposal.isError,'studio_visual_propose returned MCP error');
  const proposed=JSON.parse(proposal.content.find(x=>x.type==='text').text);
  assert.equal(proposed.status,'proposed');
  const visual=await client.callTool({name:'studio_visual_get',arguments:{libraryId:'shared/smoke',version:1}});
  assert(!visual.isError,'studio_visual_get returned MCP error');
  assert.equal(JSON.parse(visual.content.find(x=>x.type==='text').text).references.length,1);
  const noAccount=await client.callTool({name:'studio_flow_live_account',arguments:{accountId:'not-configured'}});
  assert(noAccount.isError,'Flow live bridge must fail closed without configured account');
  console.log(`MCP stdio handshake OK (${tools.length} tools; guided intake, status and visual proposal verified)`);
} finally {
  try{await client.close();}catch{}
  await fs.rm(home,{recursive:true,force:true});
}
