import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Studio } from '../src/core.mjs';
import { WorkflowStudio } from '../src/workflows.mjs';
import {checkStepCapabilities,inspectFlowAccount,inspectFlowStep,submitFlowStep,reconcileFlowStep,downloadFlowStep} from '../src/providers/google-flow/miyakejima.mjs';

const JOB='123e4567-e89b-42d3-a456-426614174000';
const newImage=()=>({id:JOB,accountId:'personal',status:'submitted',mediaType:'image'});
const baseCaps={signedIn:true,workspaceAvailable:true,pageKind:'workspace',models:{image:[{id:'nano-2',selected:true}],video:[{id:'omni',selected:true}]},aspectRatiosByMedia:{image:['9:16','16:9'],video:['9:16']},outputCountsByMedia:{image:[1,2],video:[1]},visibleDurations:[8]};
const schemas=Object.fromEntries(['flow_list_accounts','flow_inspect_account','flow_generate_image','flow_generate_video','flow_job_status','flow_download_job'].map(name=>[name,{name,inputSchema:{type:'object',properties:{accountId:{type:'string'},prompt:{type:'string'},flowProject:{type:'string'},model:{type:'string'},aspectRatio:{type:'string'},durationSeconds:{type:'integer'},outputs:{type:'integer'},referenceFiles:{type:'array'},outputDirectory:{type:'string'},download:{type:'boolean'},confirmCreditSpend:{type:'boolean'},timeoutSeconds:{type:'integer'},upscale:{type:'string'},jobId:{type:'string'},waitSeconds:{type:'integer'}},additionalProperties:false}}]));
const reply=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
function fake({connected=['personal'],caps=baseCaps,generated=newImage(),polled=newImage(),download=newImage(),tools=Object.values(schemas)}={}){
  const calls=[];
  const client={listTools:async()=>({tools}),callTool:async({name,arguments:args})=>{
    calls.push({name,args});
    if(name==='flow_list_accounts')return reply({connectedAccountIds:connected});
    if(name==='flow_inspect_account')return reply(caps);
    if(name==='flow_generate_image'||name==='flow_generate_video')return reply(generated);
    if(name==='flow_job_status')return reply(polled);
    if(name==='flow_download_job')return reply(download);
    throw Error('Unknown fake tool '+name);
  }};
  return {calls,connection:async(home,id,fn)=>fn(client)};
}
async function make(t,{op='image.generate',inputs={prompt:'A quiet forest',aspectRatio:'9:16'}}={}){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'flow-live-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const home=path.join(dir,'.studio');const studio=new Studio(home);
  const f=path.join(dir,'production.json');await fs.writeFile(f,JSON.stringify({schemaVersion:1,id:'story',title:'Story',assets:[],characters:[],shots:[]}));await studio.importProject(f);
  await studio.registerAccount({id:'acc',label:'Authorized account',provider:'google-flow',upstreamId:'flow-1',authorized:true,creditEstimate:100});
  await studio.bindAccountProject({projectId:'story',accountId:'acc',remoteProjectId:'Film EP01'});
  await fs.writeFile(path.join(home,'flow-profiles.json'),JSON.stringify({acc:{upstreamAccountId:'personal',flowProject:'Film EP01'}}));
  const workflows=new WorkflowStudio(studio),wf=path.join(dir,'wf.json');
  await fs.writeFile(wf,JSON.stringify({schemaVersion:1,id:'wf',projectId:'story',steps:[{id:'shot',accountId:'acc',operation:op,inputs,estimatedCredits:20,dependsOn:[]}]}));
  await workflows.importFile(wf);
  return {studio,workflows,home};
}

test('live account inspection confirms exact local profile and never claims credit or native project verification',async t=>{
  const {studio}=await make(t);const m=fake();const result=await inspectFlowAccount(studio,'acc',{connection:m.connection});
  assert.equal(result.liveCreditQuoteVerified,undefined);assert.equal(result.creditQuoteVerified,false);
  assert.equal(result.nativeProjectVerified,false);assert.equal(result.profileId,'personal');
  assert.deepEqual(m.calls.map(c=>c.name),['flow_list_accounts','flow_inspect_account']);
});
test('a disconnected account never falls back to another connected default',async t=>{
  const {studio}=await make(t);const m=fake({connected:['someone-else']});
  await assert.rejects(inspectFlowAccount(studio,'acc',{connection:m.connection}),/not connected/);
  assert(!m.calls.some(c=>c.name==='flow_inspect_account'));
});
test('landing page must be classified as unavailable, not authenticated Flow',async t=>{
  const {studio}=await make(t);const m=fake({caps:{...baseCaps,workspaceAvailable:false}});
  await assert.rejects(inspectFlowAccount(studio,'acc',{connection:m.connection}),/workspace unavailable/);
});
test('capabilities are validated exactly; no implicit silent substitute for ratio, duration, model, or references',()=>{
  const live={imageModels:['nano-2'],videoModels:['omni'],selectedImageModel:'nano-2',selectedVideoModel:'omni',imageRatios:['9:16'],videoRatios:['9:16'],imageOutputs:[1],videoOutputs:[1],visibleDurations:[]};
  const step=(operation,inputs)=>({operation,inputs});
  assert.throws(()=>checkStepCapabilities(step('video.frames',{prompt:'Animation',startFrame:'step:frame',aspectRatio:'9:16'}),live),/does not provide/);
  assert.throws(()=>checkStepCapabilities(step('image.generate',{prompt:'Draw',aspectRatio:'9:16',referenceImages:['asset:x']}),live),/cannot safely transport/);
  assert.throws(()=>checkStepCapabilities(step('video.text',{prompt:'Animate',aspectRatio:'9:16',durationSeconds:8}),live),/does not expose/);
  assert.throws(()=>checkStepCapabilities(step('image.generate',{prompt:'Draw',aspectRatio:'1:1'}),live),/unavailable/);
  assert.throws(()=>checkStepCapabilities(step('image.generate',{prompt:'Draw',aspectRatio:'9:16',model:'missing'}),live),/unavailable/);
  assert.throws(()=>checkStepCapabilities(step('image.generate',{prompt:'Draw',aspectRatio:'9:16',outputs:2}),live),/unavailable/);
});
test('step preflight verifies upstream contract without claiming or spending',async t=>{
  const {workflows}=await make(t);const m=fake();const x=await inspectFlowStep(workflows,'wf','shot',{connection:m.connection});
  assert.equal(x.liveAccountVerified,true);assert.equal(x.liveProjectVerified,false);assert.equal(x.approved,false);
  assert.equal((await workflows.get('wf')).steps.shot.status,'planned');
  assert(m.calls.every(x=>x.name!=='flow_generate_image'));
});
test('no paid call without operator approval even if session is connected',async t=>{
  const {workflows}=await make(t);const m=fake();
  await assert.rejects(submitFlowStep(workflows,'wf','shot',{connection:m.connection}),/must be approved/);
  assert.equal(m.calls.length,0);
});
test('one approved step submits exactly once and uses selected upstream identity/project and explicit confirmation',async t=>{
  const {workflows}=await make(t);await workflows.approve('wf','shot',true);
  const m=fake();const x=await submitFlowStep(workflows,'wf','shot',{connection:m.connection});
  assert.equal(x.status,'submitted');assert.equal(x.externalJobId,JOB);
  const generated=m.calls.filter(x=>x.name==='flow_generate_image');assert.equal(generated.length,1);
  assert.equal(generated[0].args.accountId,'personal');assert.equal(generated[0].args.flowProject,'Film EP01');
  assert.equal(generated[0].args.model,'nano-2');assert.equal(generated[0].args.confirmCreditSpend,true);
  await assert.rejects(submitFlowStep(workflows,'wf','shot',{connection:m.connection}),/must be approved/);
});
test('ambiguous acknowledgement is locked, never blindly resent',async t=>{
  const {workflows}=await make(t);await workflows.approve('wf','shot',true);const m=fake({generated:{status:'ready_for_confirmation',id:JOB,accountId:'personal'}});
  const x=await submitFlowStep(workflows,'wf','shot',{connection:m.connection});assert.equal(x.status,'submission_unknown');
  assert.equal((await workflows.get('wf')).steps.shot.status,'submission_unknown');
  await assert.rejects(submitFlowStep(workflows,'wf','shot',{connection:m.connection}),/must be approved/);
});
test('read-only reconciliation polls existing job without generating again',async t=>{
  const {workflows}=await make(t);await workflows.approve('wf','shot',true);
  const m=fake({polled:{id:JOB,accountId:'personal',status:'processing'}});
  await submitFlowStep(workflows,'wf','shot',{connection:m.connection});m.calls.length=0;
  const x=await reconcileFlowStep(workflows,'wf','shot',{connection:m.connection});
  assert.equal(x.requiresPolling,true);assert.deepEqual(m.calls.map(x=>x.name),['flow_job_status']);
});
test('a completed upstream image requires an actual safe local file with independent hash validation',async t=>{
  const {workflows,home}=await make(t);await workflows.approve('wf','shot',true);
  const output=path.join(home,'provider-media','google-flow','acc','wf','shot');await fs.mkdir(output,{recursive:true});
  const file=path.join(output,'image.png');
  await fs.writeFile(file,Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex'));
  const m=fake({polled:{id:JOB,accountId:'personal',status:'completed',downloadedFiles:[file]}});
  await submitFlowStep(workflows,'wf','shot',{connection:m.connection});const x=await reconcileFlowStep(workflows,'wf','shot',{connection:m.connection});
  assert.equal(x.status,'completed');assert.equal(x.receipt.sha256.length,64);
  assert.equal(x.receipt.technicalValidation,'signature-checked');
  assert.match(x.receipt.storedPath,/^outputs[\\/]flow[\\/]123e4567/);
  assert.equal((await workflows.get('wf')).steps.shot.output.providerAssetId,null);
});
test('a provider download outside the assigned workspace is refused',async t=>{
  const {workflows,home}=await make(t);await workflows.approve('wf','shot',true);
  const file=path.join(home,'unsafe.png');await fs.writeFile(file,Buffer.alloc(40,0));
  const m=fake({polled:{id:JOB,accountId:'personal',status:'completed',downloadedFiles:[file]}});
  await submitFlowStep(workflows,'wf','shot',{connection:m.connection});
  await assert.rejects(reconcileFlowStep(workflows,'wf','shot',{connection:m.connection}),/provider directory|ENOENT/);
  assert.equal((await workflows.get('wf')).steps.shot.status,'submitted');
});
test('download only accesses the same existing job and never calls generation',async t=>{
  const {workflows}=await make(t);await workflows.approve('wf','shot',true);const m=fake();
  await submitFlowStep(workflows,'wf','shot',{connection:m.connection});m.calls.length=0;
  const x=await downloadFlowStep(workflows,'wf','shot',{connection:m.connection});
  assert.equal(x.status,'download_requested');assert.deepEqual(m.calls.map(x=>x.name),['flow_download_job']);
  assert.equal(m.calls[0].args.jobId,JOB);
});
test('wrong provider identity on reconciliation cannot complete the job',async t=>{
  const {workflows}=await make(t);await workflows.approve('wf','shot',true);
  const m=fake({polled:{id:JOB,accountId:'other',status:'completed',downloadedFiles:[]}});
  await submitFlowStep(workflows,'wf','shot',{connection:m.connection});
  await assert.rejects(reconcileFlowStep(workflows,'wf','shot',{connection:m.connection}),/different account\/job/);
});
test('missing or mismatched project binding blocks live preflight',async t=>{
  const {workflows,home}=await make(t);await fs.writeFile(path.join(home,'flow-profiles.json'),JSON.stringify({acc:{upstreamAccountId:'personal',flowProject:'different'}}));
  const m=fake();await assert.rejects(inspectFlowStep(workflows,'wf','shot',{connection:m.connection}),/Project mismatch/);
  assert.equal(m.calls.length,0);
});
