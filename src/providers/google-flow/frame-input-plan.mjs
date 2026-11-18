/**
 * Zero-credit, reference-aware preflight for the explicitly typed gflow-cli MCP.
 *
 * The miyakejima bridge intentionally supports text-only videos. This module
 * prepares a different provider's i2v/r2v contract without pretending that
 * merely attaching an image to an agent prompt selects Frames mode.
 *
 * It does not submit a generation, approve a step, or contact a browser itself.
 */
import { promises as fs, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { metadata } from '../../media.mjs';
import { validateToolSignature } from '../../workflow-adapter.mjs';

const NAME=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const PROFILE=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const PROJECT=/^[a-zA-Z0-9_-]{6,120}$/;
const SHA=/^[a-f0-9]{64}$/;
const IMAGE_EXT=new Set(['.jpg','.jpeg','.png','.webp']);
const MODELS=Object.freeze({
  veo_lite:new Set([4,6,8]),veo_fast:new Set([4,6,8]),veo_quality:new Set([4,6,8]),
  omni_flash:new Set([4,6,8,10]),
  omni_1_2_flash:new Set(Array.from({length:13},(_,i)=>i+3))
});
const assert=(v,msg)=>{if(!v)throw new Error(msg);};
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
async function digest(file){const hash=createHash('sha256');for await(const buffer of createReadStream(file))hash.update(buffer);return hash.digest('hex');}
async function safeImage(home,storedPath,expectedSha,expectedBytes){
  assert(typeof storedPath==='string'&&!path.isAbsolute(storedPath),'Reference must have a relative canonical storedPath');
  assert(SHA.test(expectedSha),'Reference must have a verified SHA-256');
  const absolute=path.resolve(home,storedPath);
  const relative=path.relative(home,absolute);
  assert(relative && !relative.startsWith('..'+path.sep) && relative!=='..' && !path.isAbsolute(relative),'Reference escapes studio home');
  assert(IMAGE_EXT.has(path.extname(absolute).toLowerCase()),'Reference must be an image file');
  const st=await fs.lstat(absolute);
  assert(st.isFile()&&!st.isSymbolicLink(),'Reference is not a regular file');
  assert(st.size>16&&st.size<=25*1024*1024,'Reference size exceeds 25 MiB or is empty');
  assert(expectedBytes===undefined||expectedBytes===st.size,'Reference byte count changed');
  assert(await fs.realpath(absolute)===absolute,'Reference path contains a symlink');
  assert(await digest(absolute)===expectedSha,'Reference SHA-256 mismatch; do not upload altered media');
  const tech=await metadata(absolute,path.extname(absolute).toLowerCase());
  assert(tech.kind==='image','Reference did not decode as a supported image');
  return {path:absolute,sha256:expectedSha,bytes:st.size};
}
async function configured(home,accountId){
  assert(NAME.test(accountId),'Invalid account ID');
  const file=process.env.STUDIO_GFLOW_CLI_PROFILES || path.join(home,'gflow-cli-profiles.json');
  const configs=JSON.parse(await fs.readFile(file,'utf8'));
  const cfg=configs[accountId];
  assert(isObject(cfg),'Missing operator-configured gflow-cli profile');
  assert(Object.keys(cfg).every(k=>['profile','projectId','model','expectedGoogleEmail'].includes(k)), 'Unexpected gflow-cli profile fields');
  assert(typeof cfg.profile==='string'&&PROFILE.test(cfg.profile),'Invalid gflow-cli profile name');
  assert(typeof cfg.projectId==='string'&&PROJECT.test(cfg.projectId),'Configure a native Flow project ID, not a guessed project title');
  assert(typeof cfg.model==='string'&&Object.hasOwn(MODELS,cfg.model),'gflow-cli model must be explicitly configured');
  if(cfg.expectedGoogleEmail!==undefined)assert(typeof cfg.expectedGoogleEmail==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.expectedGoogleEmail),'Invalid expectedGoogleEmail in operator profile');
  return cfg;
}
async function resolveReference({home,manifest,workflow,step,state,token}){
  assert(typeof token==='string'&&/^(step|asset):[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(token),`Invalid reference token ${String(token)}`);
  const [kind,id]=token.split(':');
  if(kind==='asset'){
    const asset=manifest.assets.find(x=>x.id===id);
    assert(asset,`Unknown canonical asset ${id}`);
    assert(typeof asset.storedPath==='string'&&asset.storedPath.replaceAll('\\','/').startsWith('assets/'),'Canonical asset must reside in the content-addressed asset store');
    assert(path.basename(asset.storedPath).startsWith(asset.sha256+'.'),'Canonical asset filename must match its SHA');
    return {token,origin:'canonical_asset',...(await safeImage(home,asset.storedPath,asset.sha256))};
  }
  assert(step.dependsOn.includes(id),`Reference ${token} is not an explicit workflow dependency`);
  const source=workflow.spec.steps.find(x=>x.id===id);
  assert(source?.operation==='image.generate' && source.accountId===step.accountId,`Reference ${token} must be a completed image in the same account`);
  const current=workflow.steps[id];
  assert(current?.status==='completed'&&current.output?.mediaType==='image',`Reference ${token} has no completed verified local image`);
  const receipt=current.output.receipt;
  assert(isObject(receipt)&&SHA.test(receipt.sha256),'Reference has no verified media receipt');
  const jobId=current.output.providerJobId;
  assert(typeof jobId==='string'&&NAME.test(jobId),'Reference provider job ID missing');
  const normalized=receipt.storedPath?.replaceAll('\\','/');
  assert(typeof normalized==='string'&&normalized.startsWith(`outputs/flow/${jobId}/`),'Reference must come from the exact verified Flow job archive');
  assert(path.basename(normalized).startsWith(receipt.sha256+'.'),'Archived reference filename must match its SHA');
  return {token,origin:'verified_flow_job',providerJobId:jobId,...(await safeImage(home,receipt.storedPath,receipt.sha256,receipt.bytes))};
}
function compileMode(step,cfg){
  const fields=Object.keys(step.inputs||{});
  const allowed=new Set(['prompt','aspectRatio','durationSeconds','model','outputs','startFrame','endFrame','referenceImages','ingredients']);
  assert(fields.every(k=>allowed.has(k)),`Unmapped creative inputs: ${fields.filter(k=>!allowed.has(k)).join(', ')}`);
  assert(['video.frames','video.ingredients'].includes(step.operation),'Only video.frames or video.ingredients is supported by this planner');
  assert(typeof step.inputs.prompt==='string'&&step.inputs.prompt.trim().length>=3 && step.inputs.prompt.length<=20000,'Video prompt must have 3..20000 characters');
  assert(['9:16','16:9'].includes(step.inputs.aspectRatio),'Explicit supported aspectRatio required');
  assert(step.inputs.outputs===undefined||step.inputs.outputs===1,'Only one output per approved step');
  assert(step.inputs.model===undefined||step.inputs.model===cfg.model,'Story model and operator configuration differ; review the editorial plan');
  assert(MODELS[cfg.model].has(step.inputs.durationSeconds),`Duration ${step.inputs.durationSeconds} is not supported by configured ${cfg.model}`);
  if(step.operation==='video.frames'){
    assert(typeof step.inputs.startFrame==='string','video.frames needs an explicit startFrame');
    assert(step.inputs.referenceImages===undefined,'Cannot combine start/end frames with ingredients in one gflow-cli call');
    return {mode:'i2v',tokens:[step.inputs.startFrame,...(step.inputs.endFrame?[step.inputs.endFrame]:[])]};
  }
  assert(step.inputs.startFrame===undefined && step.inputs.endFrame===undefined && step.inputs.referenceImages===undefined,'Ingredients mode cannot silently become frames mode or drop referenceImages');
  assert(Array.isArray(step.inputs.ingredients)&&step.inputs.ingredients.length>=1&&step.inputs.ingredients.length<=3,'video.ingredients requires 1..3 explicit image references');
  assert(new Set(step.inputs.ingredients).size===step.inputs.ingredients.length,'Duplicate ingredient references');
  return {mode:'r2v',tokens:step.inputs.ingredients};
}
function toolSchema(tools,name){
  const tool=tools.find(t=>t.name===name);
  assert(tool?.inputSchema?.type==='object',`Upstream missing explicit ${name} tool contract`);
  return tool;
}
function structured(reply,label){
  assert(!reply?.isError,`${label} returned an authentication/availability error; stop without spending`);
  if(isObject(reply?.structuredContent))return reply.structuredContent;
  for(const c of reply?.content||[])if(c.type==='text')try{const v=JSON.parse(c.text);if(isObject(v))return v;}catch{}
  throw new Error(`${label} did not return a structured response`);
}
/**
 * Describe exact local bytes and gflow-cli arguments for a single approved
 * canonical step. The returned invocation is a PROPOSAL, never a paid dispatch.
 */
export async function planGflowFrameStep(workflows,workflowId,stepId,{probeUpstream=false,connection}={}){
  assert(NAME.test(workflowId)&&NAME.test(stepId),'Invalid workflow or step ID');
  const workflow=await workflows.get(workflowId);
  const step=workflow.spec.steps.find(s=>s.id===stepId);
  assert(step,`Unknown workflow step ${stepId}`);
  const home=workflows.studio.store.home;
  const state=await workflows.studio.store.read();
  const account=state.accounts[step.accountId];
  assert(account?.provider==='google-flow'&&account.authorized&&account.enabled&&account.upstreamId,'Account requires an authorized enabled Flow upstream');
  const cfg=await configured(home,step.accountId);
  const bound=state.bindings[`${workflow.spec.projectId}::${step.accountId}`];
  assert(bound?.remoteProjectId===cfg.projectId,'Native project ID must match explicit canonical binding; names are insufficient');
  const project=state.projects[workflow.spec.projectId]?.manifest;
  assert(project,'Missing canonical project manifest');
  const spec=compileMode(step,cfg);
  const sources=[];
  for(const token of spec.tokens)sources.push(await resolveReference({home,manifest:project,workflow,step,state,token}));
  const args={profile:cfg.profile,project:cfg.projectId,model:cfg.model,mode:spec.mode,
    prompt:step.inputs.prompt,aspect:step.inputs.aspectRatio,duration:step.inputs.durationSeconds,count:1,
    wait:true,
    ...(spec.mode==='i2v'?{initial_frame:sources[0].path,...(sources[1]?{end_frame:sources[1].path}:{})}:{reference_images:sources.map(s=>s.path)})};
  let liveSchemaVerified=false,liveAuthenticationVerified=false;
  if(probeUpstream){
    assert(cfg.expectedGoogleEmail,'Configure expectedGoogleEmail before probing a Google account; a browser profile name is not an identity');
    const upstream=connection||(await import('../../upstream.mjs')).withUpstream;
    const checked=await upstream(home,account.upstreamId,async client=>{
      const {tools}=await client.listTools();
      const authTool=toolSchema(tools,'gflow_auth_status');
      validateToolSignature(authTool,{profile:cfg.profile});
      const auth=structured(await client.callTool({name:'gflow_auth_status',arguments:{profile:cfg.profile}}),'gflow_auth_status');
      assert(auth.status==='authenticated'&&auth.profile===cfg.profile,'gflow-cli authenticated profile differs from operator-selected identity');
      assert(typeof auth.user_email==='string'&&auth.user_email.toLowerCase()===cfg.expectedGoogleEmail.toLowerCase(),'gflow-cli authenticated Google identity differs from operator-selected email');
      const video=toolSchema(tools,'gflow_generate_video');
      const keys=Object.keys(args);
      assert(keys.every(k=>Object.hasOwn(video.inputSchema.properties||{},k)),`Upstream tool drops ${keys.filter(k=>!Object.hasOwn(video.inputSchema.properties||{},k)).join(', ')}`);
      validateToolSignature(video,args);
      return true;
    });
    liveSchemaVerified=checked;liveAuthenticationVerified=checked;
  }
  return {workflowId,stepId,accountId:step.accountId,operation:step.operation,mode:spec.mode,
    upstreamId:account.upstreamId,tool:'gflow_generate_video',projectId:cfg.projectId,model:cfg.model,
    references:sources,argumentsPreview:args,estimatedCredits:step.estimatedCredits,
    operatorApproved:workflow.steps[stepId]?.status==='approved',liveSchemaVerified,liveAuthenticationVerified,
    nativeProjectVerified:false,googleIdentityVerified:liveAuthenticationVerified,liveCreditQuoteVerified:false,paidExecutionImplemented:false,
    nextAction:'Verify project identity and live credit quote manually; an operator-approved paid i2v/r2v dispatch and durable provider receipt still need to be implemented.',
    warning:'READ-ONLY: this planner never calls gflow_generate_video and must not be treated as production output.'};
}
