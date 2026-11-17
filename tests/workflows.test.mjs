import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Studio } from '../src/core.mjs';
import { WorkflowStudio,validateWorkflow } from '../src/workflows.mjs';
import { listFlowOperations } from '../src/flow-operations.mjs';
import { compileArguments,validateToolSignature,executeWorkflowStep,inspectWorkflowStep,resolveWorkflowInputs } from '../src/workflow-adapter.mjs';

async function setup(t,{credits=100}={}) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'studio-workflow-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const studio=new Studio(path.join(dir,'.studio'));
  const manifest={schemaVersion:1,id:'demo',title:'Demo',assets:[],characters:[{id:'hero',version:1,description:'Consistent hero',referenceAssetIds:[]}],shots:[{id:'shot-1',prompt:'Arrival',aspectRatio:'9:16',durationSeconds:8,characterIds:['hero'],referenceAssetIds:[],estimatedCredits:30}]};
  const mf=path.join(dir,'production.json');await fs.writeFile(mf,JSON.stringify(manifest));await studio.importProject(mf);
  await studio.registerAccount({id:'g1',provider:'google-flow',label:'Operator session',authorized:true,upstreamId:'flow-mock',creditEstimate:credits});
  const workflows=new WorkflowStudio(studio);
  async function importFlow(flow) {const file=path.join(dir,`${flow.id}.json`);await fs.writeFile(file,JSON.stringify(flow));return workflows.importFile(file);}
  return {dir,studio,workflows,importFlow,flow:(steps,id='wf')=>({schemaVersion:1,id,projectId:'demo',steps})};
}
const step=(id,operation,inputs,more={})=>({id,accountId:'g1',operation,inputs,estimatedCredits:operation.startsWith('video.')?20:0,dependsOn:[],...more});

const fakeSchema={type:'object',properties:{prompt:{type:'string'},projectId:{type:'string'},confirmCreditSpend:{type:'boolean'}},required:['prompt'],additionalProperties:false};
const conn=(result={structuredContent:{jobId:'native-job-23',status:'queued'}})=>async(home,id,cb)=>cb({listTools:async()=>({tools:[{name:'flow_generate_video',inputSchema:fakeSchema}]}),callTool:async()=>result});
async function mapping(studio){await fs.mkdir(studio.store.home,{recursive:true});await fs.writeFile(path.join(studio.store.home,'adapters.json'),JSON.stringify({'google-flow':{'video.text':{tool:'flow_generate_video',arguments:{prompt:{from:'input.prompt'},projectId:{from:'binding.remoteProjectId'},confirmCreditSpend:{literal:true}}}}}));}

test('documents full Flow product surface without falsely claiming live support',()=>{
  const x=listFlowOperations();assert.equal(x.verifiedLive,false);
  for(const key of ['video.text','video.frames','video.ingredients','video.edit','video.extend','scene.compose','image.edit','character.create','agent.prompt','tool.create','voice.create','avatar.create','scene.export','tool.run'])
    assert(x.operations.some(op=>op.id===key));
});
test('dependency DAG orders out-of-order steps and blocks premature execution',async t=>{
  const {flow,studio,workflows,importFlow}=await setup(t);
  await importFlow(flow([step('video','video.frames',{prompt:'A',startFrame:'step:image'},{dependsOn:['image']}),step('image','image.generate',{prompt:'Create frame'})]));
  const p=await workflows.plan('wf');assert.deepEqual(p.steps.map(x=>x.id),['image','video']);
  assert.deepEqual(p.steps.find(x=>x.id==='video').blockedBy,['image']);
  await workflows.approve('wf','video',true);
  await assert.rejects(workflows.claim('wf','video'),/Dependencies not completed/);
  assert.equal((await studio.store.read()).workflows.wf.steps.video.status,'approved');
});
test('rejects cycles, undeclared step references, invalid assets and invalid values',async t=>{
  const {flow,studio}=await setup(t);const state=await studio.store.read();
  assert.throws(()=>validateWorkflow(flow([step('a','video.text',{prompt:'a'},{dependsOn:['b']}),step('b','video.text',{prompt:'b'},{dependsOn:['a']})]),state),/Cycle/);
  assert.throws(()=>validateWorkflow(flow([step('a','video.frames',{prompt:'x',startFrame:'step:b'}),step('b','image.generate',{prompt:'ref'})]),state),/add b to dependsOn/);
  assert.throws(()=>validateWorkflow(flow([step('a','asset.upload',{assetId:'unknown'})]),state),/unknown canonical asset/);
  assert.throws(()=>validateWorkflow(flow([step('a','video.text',{prompt:'x',aspectRatio:'4:3'})]),state),/ratio invalid/);
  assert.throws(()=>validateWorkflow(flow([step('a','video.text',{prompt:'x',cookie:'secret'})]),state),/Secrets are forbidden/);
  assert.throws(()=>validateWorkflow(flow([step('a','video.text',{prompt:'x'},{estimatedCredits:0})]),state),/positive/);
});
test('workflow is immutable and importing a second time is idempotent',async t=>{
  const {flow,workflows,importFlow}=await setup(t);
  const f=flow([step('a','image.generate',{prompt:'Generate'})]);
  assert.equal((await importFlow(f)).steps,1);
  assert.equal((await importFlow(f)).alreadyImported,true);
  f.steps[0].inputs.prompt='Silently changed';
  await assert.rejects(importFlow(f),/immutable/);
  assert.equal((await workflows.get('wf')).spec.steps[0].inputs.prompt,'Generate');
});
test('spend reserves only individual accounts and rejects budget overflow',async t=>{
  const {flow,workflows,importFlow}=await setup(t,{credits:30});
  await importFlow(flow([step('a','video.text',{prompt:'clip1'}),step('b','video.text',{prompt:'clip2'})]));
  await workflows.approve('wf','a',true);
  await assert.rejects(workflows.approve('wf','b',true),/Insufficient/);
  assert.equal((await workflows.get('wf')).steps.b.status,'planned');
});
test('missing project binding blocks generation but not project.create',async t=>{
  const {flow,workflows,importFlow}=await setup(t);
  await importFlow(flow([step('create','project.create',{title:'Demo'}),step('generate','video.text',{prompt:'A clip'},{dependsOn:['create']})]));
  await workflows.approve('wf','create',true);await workflows.approve('wf','generate',true);
  const x=await workflows.plan('wf');assert.equal(x.steps[0].readyForDispatch,true);
  assert.equal(x.steps[1].readyForDispatch,false);assert(x.steps[1].missingReferences.includes('remote project binding'));
  await assert.rejects(workflows.claim('wf','generate'),/Dependencies not completed/);
});
test('argument mapping is strict: no arbitrary code, no unexpected upstream keys',()=>{
  const args=compileArguments({prompt:{from:'input.prompt'},confirmCreditSpend:{literal:true}}, {input:{prompt:'hello'}});
  assert.equal(args.prompt,'hello');assert.equal(args.confirmCreditSpend,true);
  assert.throws(()=>compileArguments({prompt:{from:'session.cookie'}},{session:{cookie:'x'}}),/Untrusted/);
  assert.throws(()=>compileArguments({prompt:{from:'input.__proto__'}},{input:{}}),/Invalid adapter path/);
  assert.throws(()=>validateToolSignature({name:'a',inputSchema:fakeSchema},{prompt:'x',random:'y'}),/does not support/);
  assert.throws(()=>validateToolSignature({name:'a',inputSchema:fakeSchema},{projectId:'p'}),/Missing required/);
});
test('live schema preflight checks mapping before consuming or claiming',async t=>{
  const {flow,studio,workflows,importFlow}=await setup(t);
  await importFlow(flow([step('make','video.text',{prompt:'Rain'})]));await studio.bindAccountProject({projectId:'demo',accountId:'g1',remoteProjectId:'flow-p'});
  await mapping(studio);await workflows.approve('wf','make',true);
  const x=await inspectWorkflowStep(workflows,'wf','make',{connection:conn()});
  assert.equal(x.schemaVerified,true);assert.equal(x.liveAccountVerified,false);
  assert.equal((await workflows.get('wf')).steps.make.status,'approved');
});
test('single dispatch records provider ID and never reports completion before verification',async t=>{
  const {flow,studio,workflows,importFlow}=await setup(t);
  await importFlow(flow([step('make','video.text',{prompt:'Rain'})]));await studio.bindAccountProject({projectId:'demo',accountId:'g1',remoteProjectId:'flow-p'});
  await mapping(studio);await workflows.approve('wf','make',true);
  const x=await executeWorkflowStep(workflows,'wf','make',{connection:conn()});
  assert.equal(x.status,'submitted');assert.equal(x.externalJobId,'native-job-23');
  await assert.rejects(executeWorkflowStep(workflows,'wf','make',{connection:conn()}),/must be approved/);
  await assert.rejects(workflows.mark('wf','make','completed',{output:{providerAssetId:'asset1'}}),/evidence/);
  const y=await workflows.mark('wf','make','completed',{output:{providerAssetId:'asset1'},evidence:'Operator verified in Flow'});
  assert.equal(y.status,'completed');
});
test('ambiguous upstream response locks step until manually reconciled',async t=>{
  const {flow,studio,workflows,importFlow}=await setup(t);
  await importFlow(flow([step('make','video.text',{prompt:'Rain'})]));await studio.bindAccountProject({projectId:'demo',accountId:'g1',remoteProjectId:'flow-p'});
  await mapping(studio);await workflows.approve('wf','make',true);
  const x=await executeWorkflowStep(workflows,'wf','make',{connection:conn({content:[{type:'text',text:'prepared, status unknown'}]})});
  assert.equal(x.status,'submission_unknown');
  await assert.rejects(executeWorkflowStep(workflows,'wf','make',{connection:conn()}),/must be approved/);
  await workflows.mark('wf','make','submitted',{externalJobId:'operator-confirmed',evidence:'Operator checked Flow'});
  assert.equal((await workflows.get('wf')).steps.make.status,'submitted');
});
test('a prepared response with job ID does NOT count as a submitted generation',async t=>{
  const {flow,studio,workflows,importFlow}=await setup(t);
  await importFlow(flow([step('make','video.text',{prompt:'Rain'})]));await studio.bindAccountProject({projectId:'demo',accountId:'g1',remoteProjectId:'flow-p'});
  await mapping(studio);await workflows.approve('wf','make',true);
  const x=await executeWorkflowStep(workflows,'wf','make',{connection:conn({structuredContent:{jobId:'prepared-form-1',status:'ready_for_confirmation'}})});
  assert.equal(x.status,'submission_unknown');assert.equal(x.providerStatus,'ready_for_confirmation');
});
test('missing adapter config fails before any state mutation or spending',async t=>{
  const {flow,studio,workflows,importFlow}=await setup(t);
  await importFlow(flow([step('make','video.text',{prompt:'Rain'})]));await studio.bindAccountProject({projectId:'demo',accountId:'g1',remoteProjectId:'flow-p'});
  await workflows.approve('wf','make',true);
  await assert.rejects(executeWorkflowStep(workflows,'wf','make',{connection:conn()}),/ENOENT/);
  assert.equal((await workflows.get('wf')).steps.make.status,'approved');
});

test('canonical asset references resolve only to the destination account binding',async t=>{
  const {flow,studio,workflows,importFlow,dir}=await setup(t);
  const assetFile=path.join(dir,'anchor.png');await fs.writeFile(assetFile,Buffer.from('89504e470d0a1a0a','hex'));
  const manifestFile=path.join(dir,'assets-production.json');
  const original=(await studio.store.read()).projects.demo.manifest;
  const manifest={schemaVersion:1,id:'project-asset',title:'Asset project',assets:[{id:'anchor',path:'anchor.png'}],characters:[],shots:[]};
  await fs.writeFile(manifestFile,JSON.stringify(manifest));await studio.importProject(manifestFile);
  const wf={schemaVersion:1,id:'asset-workflow',projectId:'project-asset',steps:[step('animate','video.frames',{prompt:'Animate',startFrame:'asset:anchor'})]};
  await importFlow(wf);
  let state=await studio.store.read();const w=state.workflows['asset-workflow'];
  assert.throws(()=>resolveWorkflowInputs(state,w,w.spec.steps[0],studio.store.home),/not synchronized/);
  await studio.bindAccountProject({projectId:'project-asset',accountId:'g1',remoteProjectId:'p2',assets:{anchor:'native-asset-42'}});
  state=await studio.store.read();
  assert.equal(resolveWorkflowInputs(state,state.workflows['asset-workflow'],w.spec.steps[0],studio.store.home).startFrame,'native-asset-42');
});
test('never sends provider-local output identifiers from one account to a different account',async t=>{
  const {studio,flow,workflows,importFlow}=await setup(t);
  await studio.registerAccount({id:'g2',provider:'google-flow',label:'Second operator session',authorized:true,upstreamId:'flow-other',creditEstimate:100});
  await importFlow(flow([step('image','image.generate',{prompt:'Still'}),step('video','video.frames',{prompt:'Move',startFrame:'step:image'},{accountId:'g2',dependsOn:['image']})]));
  const state=await studio.store.read();
  const w=state.workflows.wf;
  assert.throws(()=>resolveWorkflowInputs(state,w,w.spec.steps[1],studio.store.home),/across accounts/);
  assert((await workflows.plan('wf')).steps[1].missingReferences.some(s=>s.startsWith('cross-account-step')));
});
test('an approved canonical project cannot silently change after importing a workflow',async t=>{
  const {studio,flow,importFlow,dir}=await setup(t);
  await importFlow(flow([step('a','video.text',{prompt:'Original'})]));
  const project=(await studio.store.read()).projects.demo.manifest;
  const manifest=structuredClone(project);
  manifest.shots[0].prompt='Changed after workflow import';
  const file=path.join(dir,'revised-project.json');
  await fs.writeFile(file,JSON.stringify(manifest));
  await assert.rejects(studio.importProject(file),/jobs\/workflows/);
});