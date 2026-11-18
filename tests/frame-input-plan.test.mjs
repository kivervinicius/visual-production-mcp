import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { Studio } from '../src/core.mjs';
import { WorkflowStudio } from '../src/workflows.mjs';
import { planGflowFrameStep } from '../src/providers/google-flow/frame-input-plan.mjs';

const IMAGE=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex');
const hash=b=>createHash('sha256').update(b).digest('hex');
const JOB='123e4567-e89b-42d3-a456-426614174000';
const PROJECT='234e4567-e89b-42d3-a456-426614174000';
const schema={type:'object',properties:Object.fromEntries(['profile','project','model','mode','prompt','aspect','duration','count','wait','initial_frame','end_frame','reference_images'].map(k=>[k,{type:['count','duration'].includes(k)?'integer':k==='wait'?'boolean':k==='reference_images'?'array':'string'}])),additionalProperties:false};
const fake=({auth={status:'authenticated',profile:'operator'},tools=[{name:'gflow_auth_status',inputSchema:{type:'object',properties:{profile:{type:'string'}}}},{name:'gflow_generate_video',inputSchema:schema}]}={})=>{
  const calls=[];
  return {calls,connection:async(home,id,fn)=>fn({listTools:async()=>({tools}),callTool:async v=>{calls.push(v);if(v.name==='gflow_auth_status')return {content:[{type:'text',text:JSON.stringify(auth)}]};throw Error('Unexpected paid operation!')}})};
};
async function make(t,{op='video.frames',extra={},account='acc',start='step:still',references=['step:still'],projectId=PROJECT}={}){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-plan-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const home=path.join(dir,'.studio'),studio=new Studio(home);
  const prod=path.join(dir,'production.json');
  await fs.writeFile(prod,JSON.stringify({schemaVersion:1,id:'episode',title:'Episode',assets:[],characters:[],shots:[]}));
  await studio.importProject(prod);
  await studio.registerAccount({id:'acc',label:'Explicit Flow account',provider:'google-flow',upstreamId:'gflow-up',authorized:true,creditEstimate:100});
  await studio.bindAccountProject({projectId:'episode',accountId:'acc',remoteProjectId:projectId});
  await fs.writeFile(path.join(home,'gflow-cli-profiles.json'),JSON.stringify({acc:{profile:'operator',projectId,model:'veo_fast'}}));
  const w=new WorkflowStudio(studio),pathW=path.join(dir,'workflow.json');
  const input=op==='video.frames'?{prompt:'A slow cinematic dolly into the forest',aspectRatio:'9:16',durationSeconds:8,startFrame:start,...extra}:{prompt:'Follow approved character and scene references',aspectRatio:'9:16',durationSeconds:8,ingredients:references,...extra};
  const steps=[{id:'still',accountId:'acc',operation:'image.generate',inputs:{prompt:'An original still'},estimatedCredits:0,dependsOn:[]},
    {id:'motion',accountId:account,operation:op,inputs:input,estimatedCredits:20,dependsOn:['still']}];
  await fs.writeFile(pathW,JSON.stringify({schemaVersion:1,id:'movie',projectId:'episode',steps}));
  await w.importFile(pathW);
  const storedDir=path.join(home,'outputs','flow',JOB);
  await fs.mkdir(storedDir,{recursive:true});const sha=hash(IMAGE),file=path.join(storedDir,sha+'.png');await fs.writeFile(file,IMAGE);
  await studio.store.mutate(state=>{state.workflows.movie.steps.still={status:'completed',output:{mediaType:'image',providerJobId:JOB,receipt:{sha256:sha,bytes:IMAGE.length,storedPath:path.relative(home,file)}}};});
  return {studio,w,home,dir,file,sha};
}

test('creates exact i2v plan with an archived verified frame and no paid calls',async t=>{
  const {w,file,sha}=await make(t);const provider=fake();
  const plan=await planGflowFrameStep(w,'movie','motion',{probeUpstream:true,connection:provider.connection});
  assert.equal(plan.mode,'i2v');assert.equal(plan.argumentsPreview.initial_frame,file);
  assert.equal(plan.references[0].sha256,sha);assert.equal(plan.argumentsPreview.project,PROJECT);
  assert.equal(plan.argumentsPreview.profile,'operator');assert.equal(plan.argumentsPreview.model,'veo_fast');
  assert.equal(plan.liveSchemaVerified,true);assert.equal(plan.liveAuthenticationVerified,true);
  assert.equal(plan.nativeProjectVerified,false);assert.equal(plan.paidExecutionImplemented,false);
  assert.deepEqual(provider.calls.map(c=>c.name),['gflow_auth_status']);
  assert.equal((await w.get('movie')).steps.motion.status,'planned');
});
test('supports ingredients only as explicit r2v with verified local images',async t=>{
  const {w,file}=await make(t,{op:'video.ingredients'});
  const plan=await planGflowFrameStep(w,'movie','motion');
  assert.equal(plan.mode,'r2v');assert.deepEqual(plan.argumentsPreview.reference_images,[file]);
  assert.equal(plan.liveSchemaVerified,false);assert.equal(plan.liveCreditQuoteVerified,false);
  assert(!Object.hasOwn(plan.argumentsPreview,'initial_frame'));
});
test('rejects silent mixing of frame and ingredients',async t=>{
  const {w}=await make(t,{extra:{referenceImages:['step:still']}});
  await assert.rejects(planGflowFrameStep(w,'movie','motion'),/Cannot combine/);
});
test('rejects unsupported creative parameter rather than truncating it',async t=>{
  const {w}=await make(t,{extra:{cameraPath:'spiral'}});
  await assert.rejects(planGflowFrameStep(w,'movie','motion'),/Unmapped creative inputs/);
});
test('rejects changed upstream reference bytes even with a prior receipt',async t=>{
  const {w,file}=await make(t);await fs.writeFile(file,Buffer.concat([IMAGE,Buffer.from('tampered')]));
  await assert.rejects(planGflowFrameStep(w,'movie','motion'),/byte count changed|SHA-256 mismatch/);
});
test('rejects a symlinked reference and never opens a paid tool',async t=>{
  const {w,file,dir}=await make(t);const alternative=path.join(dir,'alternate.png');await fs.rename(file,alternative);await fs.symlink(alternative,file);
  await assert.rejects(planGflowFrameStep(w,'movie','motion'),/regular file|symlink/);
});
test('refuses cross-account still references',async t=>{
  const {w,studio}=await make(t);await studio.registerAccount({id:'acc2',label:'Another',provider:'google-flow',upstreamId:'gflow-up',authorized:true,creditEstimate:100});
  await studio.store.mutate(s=>{s.workflows.movie.spec.steps[0].accountId='acc2'});
  await assert.rejects(planGflowFrameStep(w,'movie','motion'),/same account/);
});
test('refuses uncertain or unfinished image outputs',async t=>{
  const {w,studio}=await make(t);await studio.store.mutate(s=>{s.workflows.movie.steps.still.status='submitted'});
  await assert.rejects(planGflowFrameStep(w,'movie','motion'),/completed verified local image/);
});
test('requires explicit native project binding and never guesses from project name',async t=>{
  const {w,studio}=await make(t);await studio.store.mutate(s=>{s.bindings['episode::acc'].remoteProjectId='My Project'});
  await assert.rejects(planGflowFrameStep(w,'movie','motion'),/Native project ID/);
});
test('duration and model are exact; no substitution or credit guess',async t=>{
  const {w}=await make(t,{extra:{durationSeconds:5,model:'veo_fast'}});
  await assert.rejects(planGflowFrameStep(w,'movie','motion'),/not supported/);
});
test('rejects profile substitution after authentication',async t=>{
  const {w}=await make(t);const provider=fake({auth:{status:'authenticated',profile:'another-account'}});
  await assert.rejects(planGflowFrameStep(w,'movie','motion',{probeUpstream:true,connection:provider.connection}),/differs/);
  assert.deepEqual(provider.calls.map(c=>c.name),['gflow_auth_status']);
});
test('rejects upstream contracts that lack first-frame input',async t=>{
  const {w}=await make(t);const provider=fake({tools:[{name:'gflow_auth_status',inputSchema:{type:'object',properties:{profile:{type:'string'}}}},{name:'gflow_generate_video',inputSchema:{type:'object',properties:{profile:{type:'string'},mode:{type:'string'}}}}]});
  await assert.rejects(planGflowFrameStep(w,'movie','motion',{probeUpstream:true,connection:provider.connection}),/Upstream tool drops/);
  assert.deepEqual(provider.calls.map(c=>c.name),['gflow_auth_status']);
});
test('missing canonical start frame rejects preflight before any network calls',async t=>{
  const {w,studio}=await make(t);await studio.store.mutate(s=>{delete s.workflows.movie.steps.still.output.receipt});
  const provider=fake();await assert.rejects(planGflowFrameStep(w,'movie','motion',{probeUpstream:true,connection:provider.connection}),/no verified media receipt/);
  assert.equal(provider.calls.length,0);
});
