/**
 * F3 bridge for the publicly documented miyakejima/google-flow-mcp v0.2.x.
 * This module does not automate a browser or handle credentials.
 * It only calls an operator-configured, separately authenticated MCP process.
 * No claim that a remote project/name or account credit quote has been verified.
 */
import { promises as fs, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
async function withUpstream(...args) {const {withUpstream}=await import('../../upstream.mjs'); return withUpstream(...args);}
import { validateToolSignature } from '../../workflow-adapter.mjs';
import { metadata as inspectMedia } from '../../media.mjs';

const APPROVED_OPERATIONS=Object.freeze({
  'image.generate': {tool:'flow_generate_image',media:'image'},
  'video.text': {tool:'flow_generate_video',media:'video'}
});
const IN_FLIGHT=new Set(['created','configuring','submitted','processing','ready','upscaling','downloading','completed']);
const NAME=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const call = async (connection,home,upstreamId,fn)=>connection(home,upstreamId,fn);

function payload(response,label) {
  assert(!response?.isError,`${label} returned error; account/session may need manual connection (no retry of paid calls)`);
  if(response?.structuredContent && typeof response.structuredContent==='object') return response.structuredContent;
  const parts=response?.content?.filter(x=>x.type==='text')||[];
  for(const p of parts){try{const value=JSON.parse(p.text);if(value && typeof value==='object')return value;}catch{}}
  throw new Error(`${label}: expected a structured JSON response`);
}

async function profile(home,accountId) {
  assert(NAME.test(accountId),'Invalid internal account ID');
  const file=process.env.STUDIO_FLOW_PROFILES || path.join(home,'flow-profiles.json');
  const profiles=JSON.parse(await fs.readFile(file,'utf8'));
  const current=profiles[accountId];
  assert(current && typeof current==='object' && !Array.isArray(current),`Missing operator-configured Flow profile for ${accountId}`);
  assert(typeof current.upstreamAccountId==='string'&&/^[A-Za-z0-9_-]{1,48}$/.test(current.upstreamAccountId),'Invalid upstream account profile ID');
  assert(typeof current.flowProject==='string'&&current.flowProject.trim()&&current.flowProject.length<=200,'Flow project name must be explicitly configured');
  assert(Object.keys(current).every(k=>['upstreamAccountId','flowProject'].includes(k)),'Flow profile may only declare upstreamAccountId and flowProject');
  return current;
}

function exactTool(tools,name) {
  const tool=tools.find(x=>x.name===name);
  assert(tool && tool.inputSchema?.type==='object',`Upstream does not expose compatible ${name}`);
  return tool;
}

function normalizeCaps(account,caps) {
  const isAvailable=caps.workspaceAvailable === true && caps.signedIn === true;
  assert(isAvailable,'Flow workspace unavailable or sign-in not verified; connect manually through the upstream MCP');
  const selected=type=>caps.models?.[type]?.find(x=>x.selected===true)?.id ?? null;
  return {
    upstreamAccountId: account.upstreamAccountId,
    workspaceAvailable:true,
    imageModels:(caps.models?.image||[]).map(x=>x.id),
    videoModels:(caps.models?.video||[]).map(x=>x.id),
    selectedImageModel:selected('image'),selectedVideoModel:selected('video'),
    imageRatios:[...(caps.aspectRatiosByMedia?.image||[])],videoRatios:[...(caps.aspectRatiosByMedia?.video||[])],
    imageOutputs:[...(caps.outputCountsByMedia?.image||[])],videoOutputs:[...(caps.outputCountsByMedia?.video||[])],
    visibleDurations:[...(caps.visibleDurations||[])],
    creditQuoteVerified:false,
    nativeProjectVerified:false
  };
}

export function checkStepCapabilities(step,live) {
  const operation=APPROVED_OPERATIONS[step.operation];
  assert(operation,`F3 upstream does not provide independently verified ${step.operation}; use a compatible adapter instead`);
  const fields=Object.keys(step.inputs||{});
  const accepted=['prompt','aspectRatio','model','outputs','durationSeconds'];
  assert(fields.every(x=>accepted.includes(x)),`F3 ${step.operation} cannot safely transport ${fields.filter(x=>!accepted.includes(x)).join(', ')}; never drop story references or frames`);
  assert(typeof step.inputs.prompt==='string'&&step.inputs.prompt.length>=3,'Flow prompt is required');
  assert(typeof step.inputs.aspectRatio==='string','Specify an explicit aspectRatio before paid generation');
  const media=operation.media;
  const models=media==='image'?live.imageModels:live.videoModels;
  const ratios=media==='image'?live.imageRatios:live.videoRatios;
  const outputs=media==='image'?live.imageOutputs:live.videoOutputs;
  const model=step.inputs.model|| (media==='image'?live.selectedImageModel:live.selectedVideoModel);
  assert(model && models.includes(model),`Flow ${media} model is unavailable: ${model||'(not selected)'}`);
  assert(ratios.includes(step.inputs.aspectRatio),`Flow ${media} aspectRatio unavailable: ${step.inputs.aspectRatio}`);
  const count=step.inputs.outputs??1;
  assert(Number.isInteger(count)&&outputs.includes(count),`Flow ${media} outputs count unavailable: ${count}`);
  // The production engine's manual budget estimate is per step, not multiplied automatically.
  assert(count===1,'F3 pilot only supports one output per approved step; update the budget for batch generation first');
  if(step.inputs.durationSeconds!==undefined) {
    assert(media==='video','durationSeconds only valid for video');
    assert(live.visibleDurations.includes(step.inputs.durationSeconds),`Flow does not expose ${step.inputs.durationSeconds}s as selectable duration; do not silently omit it`);
  }
  return {media,tool:operation.tool,model,aspectRatio:step.inputs.aspectRatio,outputs:count,
    ...(step.inputs.durationSeconds!==undefined?{durationSeconds:step.inputs.durationSeconds}:{})};
}

async function context(studio,accountId) {
  assert(NAME.test(accountId),'Invalid account ID');
  const state=await studio.store.read();
  const account=state.accounts[accountId];
  assert(account?.provider==='google-flow'&&account.authorized&&account.enabled&&account.upstreamId,'Account must be authorized, enabled and linked to a configured Flow upstream');
  return {account,profile:await profile(studio.store.home,accountId),home:studio.store.home};
}

async function inspectClient(client,p) {
  const {tools}=await client.listTools();
  exactTool(tools,'flow_list_accounts'); exactTool(tools,'flow_inspect_account');
  const accounts=payload(await client.callTool({name:'flow_list_accounts',arguments:{}}),'flow_list_accounts');
  const connected=accounts.connectedAccountIds || (accounts.accounts||[]).filter(x=>x.connectionStatus==='connected').map(x=>x.id);
  assert(Array.isArray(connected)&&connected.includes(p.upstreamAccountId),`Upstream account ${p.upstreamAccountId} is not connected; do not switch to a default account`);
  const inspectTool=exactTool(tools,'flow_inspect_account');
  validateToolSignature(inspectTool,{accountId:p.upstreamAccountId});
  const inspected=payload(await client.callTool({name:'flow_inspect_account',arguments:{accountId:p.upstreamAccountId}}),'flow_inspect_account');
  const live=normalizeCaps(p,inspected);
  return {tools,live};
}

/** Explicit read-only preflight. This never authorizes a charged generation. */
export async function inspectFlowAccount(studio,accountId,{connection=withUpstream}={}) {
  const {account,profile:p,home}=await context(studio,accountId);
  const scanned=await call(connection,home,account.upstreamId,client=>inspectClient(client,p));
  return {accountId,upstreamId:account.upstreamId,profileId:p.upstreamAccountId,flowProject:p.flowProject,
    ...scanned.live,availableBridgeOperations:Object.keys(APPROVED_OPERATIONS),
    note:'Read-only verified Flow workspace. Project name and credits are operator supplied; authentication is isolated in the upstream.'};
}

async function prepareInClient(studio,workflowId,stepId,client){
  const w=await studio.get(workflowId);const step=w.spec.steps.find(x=>x.id===stepId);
  assert(step,`Unknown workflow step ${stepId}`);
  const {account,profile:p,home}=await context(studio.studio,step.accountId);
  const state=await studio.studio.store.read();
  const binding=state.bindings[`${w.spec.projectId}::${step.accountId}`];
  assert(binding?.remoteProjectId===p.flowProject,`Project mismatch: bind ${w.spec.projectId} to exactly the configured Flow project name for ${step.accountId}; native project ID is not verified by this bridge`);
  const scan=await inspectClient(client,p);
  const selection=checkStepCapabilities(step,scan.live);
  const generatedTool=exactTool(scan.tools,selection.tool);
  const outputDirectory=path.join(home,'provider-media','google-flow',step.accountId,workflowId,stepId);
  const args={accountId:p.upstreamAccountId,prompt:step.inputs.prompt,flowProject:p.flowProject,
    model:selection.model,aspectRatio:selection.aspectRatio,outputs:1,referenceFiles:[],
    outputDirectory,download:true,confirmCreditSpend:true,timeoutSeconds:60,
    ...(selection.media==='video'?{upscale:'none'}:{}),
    ...(selection.durationSeconds!==undefined?{durationSeconds:selection.durationSeconds}:{})};
  validateToolSignature(generatedTool,args);
  return {step,account,selection,args,outputDirectory,tool:selection.tool,
    upstreamId:account.upstreamId,workflowId,stepId};
}

export async function inspectFlowStep(workflows,workflowId,stepId,{connection=withUpstream}={}){
  const w=await workflows.get(workflowId);const step=w.spec.steps.find(x=>x.id===stepId);
  assert(step,`Unknown workflow step ${stepId}`);
  const {account,home}=await context(workflows.studio,step.accountId);
  const result=await call(connection,home,account.upstreamId,c=>prepareInClient(workflows,workflowId,stepId,c));
  return {workflowId,stepId,accountId:step.accountId,operation:step.operation,tool:result.tool,
    model:result.selection.model,aspectRatio:result.selection.aspectRatio,
    durationSeconds:result.selection.durationSeconds||null,estimatedCredits:step.estimatedCredits,
    approved:(w.steps[stepId]?.status==='approved'),schemaVerified:true,liveAccountVerified:true,
    liveProjectVerified:false,liveCreditQuoteVerified:false,
    warning:'Flow workspace and tool schema verified; operator project-name binding, estimated credits and upstream UI cost are not independently verified.'};
}

/** One charged attempt, after offline approval and live session inspection. */
export async function submitFlowStep(workflows,workflowId,stepId,{connection=withUpstream}={}){
  const w=await workflows.get(workflowId);const step=w.spec.steps.find(x=>x.id===stepId);
  assert(step,`Unknown workflow step ${stepId}`);
  assert(w.steps[stepId]?.status==='approved','Step must be approved by the local operator before paid submission');
  const {account,home}=await context(workflows.studio,step.accountId);
  // Preflight occurs before any local mutation. A second preflight on the sending connection prevents session drift.
  await inspectFlowStep(workflows,workflowId,stepId,{connection});
  const ready=(await workflows.plan(workflowId)).steps.find(x=>x.id===stepId);
  assert(ready?.readyForDispatch,`Workflow step not ready: ${JSON.stringify(ready?.missingReferences||ready?.blockedBy)}`);
  await workflows.claim(workflowId,stepId);
  try {
    const reply=await call(connection,home,account.upstreamId,async client=>{
      const prepared=await prepareInClient(workflows,workflowId,stepId,client);
      return client.callTool({name:prepared.tool,arguments:prepared.args});
    });
    const job=payload(reply,'Flow generation');
    // A persistent UUID and status from the upstream are essential; an ID alone isn't submission proof.
    const id=job.id||job.jobId;
    const verified=typeof id==='string'&&UUID.test(id)&&IN_FLIGHT.has(job.status)&&job.accountId===(await profile(home,step.accountId)).upstreamAccountId;
    const state=verified?'submitted':'submission_unknown';
    await workflows.mark(workflowId,stepId,state,{externalJobId:verified?id:undefined,
      evidence:verified?'Upstream durable job acknowledged. No local media has been verified yet.':'Ambiguous Flow job receipt; operator must inspect before retrying'});
    return {workflowId,stepId,status:state,externalJobId:verified?id:null,
      upstreamStatus:typeof job.status==='string'?job.status:null,
      warning:state==='submission_unknown'?'Unknown paid submission. DO NOT retry automatically.':null};
  } catch(error){
    await workflows.mark(workflowId,stepId,'submission_unknown',{evidence:'Flow submission may have occurred; do not retry without reconciliation'});
    throw new Error(`Flow submission uncertain for ${stepId}: ${error.message}. Do not retry automatically.`);
  }
}

async function hashFile(file){const h=createHash('sha256');for await(const data of createReadStream(file))h.update(data);return h.digest('hex');}
async function inspectedFile(file,root,home,jobId,media) {
  const realHome=await fs.realpath(home),realRoot=await fs.realpath(root),realFile=await fs.realpath(file);
  assert(realRoot.startsWith(realHome+path.sep),'Provider download root escapes the studio workspace');
  assert(realFile.startsWith(realRoot+path.sep),'Output file escapes the assigned provider directory');
  const s=await fs.stat(realFile);assert(s.isFile()&&s.size>16&&s.size<4*1024**3,'Invalid output file size');
  const ext=path.extname(realFile).toLowerCase();
  assert(media==='image'?['.png','.jpeg','.jpg','.webp'].includes(ext):['.mp4','.mov','.webm'].includes(ext),'Unexpected media file type');
  const technical=await inspectMedia(realFile,ext),sha256=await hashFile(realFile);
  // Freeze the original under a content-addressed path rather than retaining a mutable
  // provider work-directory file that might disappear after cleaning temporary jobs.
  const archiveDir=path.join(home,'outputs','flow',jobId);
  await fs.mkdir(archiveDir,{recursive:true,mode:0o700});
  const dest=path.join(archiveDir,sha256+ext);
  try { await fs.copyFile(realFile,dest,fs.constants.COPYFILE_EXCL); }
  catch(error){ if(error.code!=='EEXIST')throw error; }
  assert(await hashFile(dest)===sha256,'Archived original failed SHA-256 verification');
  return {sha256,bytes:s.size,storedPath:path.relative(home,dest),...technical};
}

/** Polls the SAME provider job; no new generation. Completes only after a local file is re-hashed. */
export async function reconcileFlowStep(workflows,workflowId,stepId,{connection=withUpstream}={}) {
  const w=await workflows.get(workflowId);const step=w.spec.steps.find(x=>x.id===stepId);
  assert(step,`Unknown workflow step ${stepId}`);
  const cur=w.steps[stepId];
  assert(['submitted','completed'].includes(cur?.status),`Step ${stepId} is ${cur?.status}; unknown submissions require manual reconciliation`);
  assert(typeof cur.externalJobId==='string'&&UUID.test(cur.externalJobId),'Missing verified provider job ID');
  const {account,profile:p,home}=await context(workflows.studio,step.accountId);
  const reply=await call(connection,home,account.upstreamId,async client=>{
    const tools=(await client.listTools()).tools;
    const t=exactTool(tools,'flow_job_status');validateToolSignature(t,{jobId:cur.externalJobId,waitSeconds:0});
    return client.callTool({name:'flow_job_status',arguments:{jobId:cur.externalJobId,waitSeconds:0}});
  });
  const job=payload(reply,'flow_job_status');
  assert(job.id===cur.externalJobId&&job.accountId===p.upstreamAccountId,'Provider returned a different account/job; reconciliation blocked');
  if(cur.status==='completed')return {workflowId,stepId,status:cur.status,alreadyCompleted:true,providerStatus:job.status};
  if(job.status==='failed'||job.status==='needs_attention')return {workflowId,stepId,status:'submitted',providerStatus:job.status,requiresOperator:true,reason:'Inspect provider issue; no automatic retry or failure overwrite'};
  if(job.status!=='completed')return {workflowId,stepId,status:'submitted',providerStatus:job.status,requiresPolling:true};
  const fileList=job.downloadedFiles;
  if(!Array.isArray(fileList)||fileList.length!==1)return {workflowId,stepId,status:'submitted',providerStatus:'completed',downloadPending:true,reason:'Expected exactly one downloaded file; use upstream flow_download_job or operator review'};
  const operation=APPROVED_OPERATIONS[step.operation];assert(operation,'Unsupported operation');
  const root=path.join(home,'provider-media','google-flow',step.accountId,workflowId,stepId);
  const proof=await inspectedFile(fileList[0],root,home,job.id,operation.media);
  await workflows.mark(workflowId,stepId,'completed',{
    output:{providerJobId:job.id,mediaType:operation.media,receipt:proof,providerAssetId:null},
    evidence:`Read-only flow_job_status confirmed job ${job.id} and local SHA-256 ${proof.sha256}. Editorial review remains pending.`
  });
  return {workflowId,stepId,status:'completed',providerStatus:'completed',receipt:proof,
    note:'Technical completion only. Character continuity and editorial approval are still required.'};
}

/** Download is a distinct read-existing-job operation, never a second generation. */
export async function downloadFlowStep(workflows,workflowId,stepId,{connection=withUpstream}={}){
  const w=await workflows.get(workflowId),step=w.spec.steps.find(x=>x.id===stepId);
  assert(step,`Unknown step ${stepId}`);
  const cur=w.steps[stepId];
  assert(cur?.status==='submitted'&&UUID.test(cur.externalJobId||''),'Only a submitted step with a known provider job ID can be downloaded');
  const {account,profile:p,home}=await context(workflows.studio,step.accountId);
  const response=await call(connection,home,account.upstreamId,async client=>{
    const t=exactTool((await client.listTools()).tools,'flow_download_job');
    validateToolSignature(t,{jobId:cur.externalJobId});
    return client.callTool({name:'flow_download_job',arguments:{jobId:cur.externalJobId}});
  });
  const job=payload(response,'flow_download_job');
  assert(job.id===cur.externalJobId&&job.accountId===p.upstreamAccountId,'Downloaded job did not match account and job ID');
  return {workflowId,stepId,status:'download_requested',providerStatus:job.status,jobId:cur.externalJobId,
    nextAction:'Call studio_flow_reconcile_step; no paid generation should be retried.'};
}
