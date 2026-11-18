/**
 * Flow → Media Composer hand-off. Read-only preflight may be called by an MCP agent.
 * Selecting a clip is intentionally an operator-only CLI action: completed upstream
 * jobs are not editorial approvals. Never performs a paid call or remote download.
 */
import { promises as fs, createReadStream, constants as fsConstants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { metadata } from '../../media.mjs';

const assert = (condition, reason) => { if (!condition) throw new Error(reason); };
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const SHA = /^[a-f0-9]{64}$/;
const JOB = /^[a-f0-9-]{36}$/i;
const VIDEO = new Set(['.mp4','.mov','.webm']);
const SHOT = /^video-[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const valid = (value, label) => {assert(typeof value === 'string' && ID.test(value) && !['.','..','__proto__','constructor','prototype'].includes(value),`${label}: invalid identifier`);return value;};
const json = value => JSON.stringify(value,null,2)+'\n';
const hashBytes = value => createHash('sha256').update(value).digest('hex');
async function fileHash(file) {const digest=createHash('sha256');for await(const chunk of createReadStream(file))digest.update(chunk);return digest.digest('hex');}
async function regularFile(file,label){
  const lst=await fs.lstat(file);
  assert(lst.isFile()&&!lst.isSymbolicLink(),`${label}: expected a regular file, not a symlink`);
  assert(await fs.realpath(file)===file,`${label}: symlinked parent/file not allowed`);
  assert(lst.size>0 && lst.size<=4*1024**3,`${label}: invalid file size`);
  return lst;
}
async function validatedDir(file,label){
  const stat=await fs.lstat(file);
  assert(stat.isDirectory()&&!stat.isSymbolicLink()&&await fs.realpath(file)===file,`${label}: must be a real directory`);
  return file;
}
function sameShot(a,b,label){
  assert(a?.id===b?.id && a?.sceneId===b?.sceneId && a?.durationSeconds===b?.durationSeconds && a?.aspectRatio===b?.aspectRatio,`${label}: shot differs from the approved workflow production`);
  for(const k of ['prompt','sourceExcerpt','visualPrompt'])if(a[k]!==undefined && b[k]!==undefined)assert(a[k]===b[k],`${label}: canonical prompt/excerpt differs`);
}

async function inspectLink(studio,{workflowId,stepId,packageDir}){
  valid(workflowId,'workflowId');valid(stepId,'stepId');assert(SHOT.test(stepId),'Only a canonical video-<shotId> can be attached');
  const home=await fs.realpath(studio.store.home);
  const state=await studio.store.read();
  const w=state.workflows?.[workflowId];assert(w,'Workflow not found');
  const step=w.spec.steps.find(x=>x.id===stepId),result=w.steps?.[stepId];
  assert(step && ['video.text','video.frames','video.ingredients'].includes(step.operation),`${stepId}: a completed video generation is required`);
  assert(state.accounts?.[step.accountId]?.provider==='google-flow',`${stepId}: not a Google Flow account`);
  assert(result?.status==='completed'&&result.output?.mediaType==='video'&&result.output.receipt,'Only a completed Flow video with a verified local media receipt can be attached');
  const jobId=result.externalJobId;
  assert(typeof jobId==='string'&&JOB.test(jobId)&&result.output.providerJobId===jobId,'Provider job ID does not match the completed Flow receipt');
  const receipt=result.output.receipt;
  assert(typeof receipt.sha256==='string'&&SHA.test(receipt.sha256),'Provider receipt must include a valid SHA-256');
  assert(typeof receipt.storedPath==='string','Provider receipt has no archived original path');
  const storedPath=receipt.storedPath.replaceAll('\\','/');
  const fileName=path.posix.basename(storedPath);
  const ext=path.posix.extname(fileName).toLowerCase();
  assert(VIDEO.has(ext)&&fileName===receipt.sha256+ext,'Archived Flow file must be named by verified digest');
  const required=`outputs/flow/${jobId}/${fileName}`;
  assert(storedPath===required,'Flow receipt is not under the dedicated job archive');
  const providerDir=await validatedDir(path.join(home,'outputs','flow',jobId),'Flow provider archive');
  assert(providerDir.startsWith(home+path.sep),'Flow provider archive escapes the studio home');
  const origin=path.join(providerDir,fileName);
  const fileInfo=await regularFile(origin,'Flow original');
  assert(await fileHash(origin)===receipt.sha256,'Archived Flow file SHA-256 mismatch');
  assert(receipt.bytes===fileInfo.size,'Archived Flow file size no longer matches provider receipt');
  const probe=await metadata(origin,ext);
  assert(probe.kind==='video'&&Number.isFinite(probe.durationSeconds),'Archived Flow media is not a readable video');
  const story=Object.values(state.stories||{}).find(x=>x.prepared?.workflowId===workflowId);
  assert(story && story.approvedAt && story.prepared.productionId===w.spec.projectId,'Workflow is not bound to an approved StoryGuide production');
  const storyId=valid(story.id,'storyId');
  const allowed=[path.join(home,'stories',storyId,'production'),path.join(home,'stories',storyId,'offline-render')];
  assert(typeof packageDir==='string' && allowed.includes(path.resolve(packageDir)),'Render package must be the original approved StoryGuide production or offline-render folder');
  const base=await validatedDir(path.resolve(packageDir),'render package');
  const files={};
  for(const name of ['EDIT_MANIFEST.json','production.json','RENDER_INPUTS.json']){
    const file=path.join(base,name);await regularFile(file,name);
    files[name]={content:await fs.readFile(file,'utf8'),file};
  }
  const prod=JSON.parse(files['production.json'].content),edit=JSON.parse(files['EDIT_MANIFEST.json'].content),mapping=JSON.parse(files['RENDER_INPUTS.json'].content);
  assert(prod.id===mapping.productionId && [storyId,w.spec.projectId].includes(prod.id), 'Render production is unrelated to this Flow workflow');
  assert(prod.source?.sha256===story.sha256 && edit.sourceSha256===story.sha256 && edit.storyId===storyId,'Render package does not match the approved story source');
  assert(mapping.schemaVersion===1&&(mapping.editManifest===undefined||mapping.editManifest==='EDIT_MANIFEST.json'),'Unexpected render manifest schema or edit file');
  assert(Array.isArray(mapping.shots)&&Array.isArray(prod.shots)&&Array.isArray(edit.scenes),'Malformed render package');
  const expected=edit.scenes.flatMap(x=>x.shots.map(y=>({sceneId:x.sceneId,stepId:y})));
  assert(expected.length===mapping.shots.length,'Render mapping no longer covers the canonical storyboard');
  for(let i=0;i<expected.length;i++)assert(mapping.shots[i].stepId===expected[i].stepId,'Render shot order differs from storyboard');
  const occurrences=expected.filter(x=>x.stepId===stepId);
  assert(occurrences.length===1,`${stepId}: must occur exactly once in the storyboard`);
  const shotId=stepId.slice('video-'.length);
  const canonical=state.projects?.[w.spec.projectId]?.manifest?.shots?.find(s=>s.id===shotId);
  const published=prod.shots.find(s=>s.id===shotId);
  assert(canonical&&published,'Missing approved canonical shot in production');
  sameShot(canonical,published,stepId);
  assert(published.sceneId===occurrences[0].sceneId,`${stepId}: scene mismatch`);
  const slot=mapping.shots.find(x=>x.stepId===stepId);
  assert(slot.durationSeconds===canonical.durationSeconds && step.inputs.durationSeconds===canonical.durationSeconds,`${stepId}: Flow/render/storyboard duration differs`);
  assert(step.inputs.aspectRatio===edit.aspectRatio && canonical.aspectRatio===edit.aspectRatio,`${stepId}: Flow aspect ratio differs from the story`);
  assert(probe.durationSeconds+0.08>=canonical.durationSeconds,`${stepId}: downloaded video shorter than approved storyboard`);
  const desired=edit.aspectRatio==='9:16'?9/16:edit.aspectRatio==='16:9'?16/9:1;
  assert(Math.abs(probe.width/probe.height-desired)<0.06,`${stepId}: downloaded video aspect ratio incompatible with the story`);
  const digest=hashBytes(files['RENDER_INPUTS.json'].content);
  return {workflowId,stepId,accountId:step.accountId,storyId,jobId,origin,base,receipt,probe,ext,mapping,slot,
    manifestPath:files['RENDER_INPUTS.json'].file,mappingSha256:digest,productionId:prod.id};
}

/** A read-only, fail-closed plan. Never marks the clip as approved or modifies a render package. */
export async function planFlowRenderLink(studio,options){
  const p=await inspectLink(studio,options);
  const alreadyLinked=p.slot.kind==='video' && p.slot.sha256===p.receipt.sha256;
  return {status:alreadyLinked?'ALREADY_LINKED':'AWAITING_OPERATOR_SELECTION',storyId:p.storyId,workflowId:p.workflowId,
    stepId:p.stepId,accountId:p.accountId,providerJobId:p.jobId,sha256:p.receipt.sha256,
    bytes:p.receipt.bytes,clipDurationSeconds:p.probe.durationSeconds,approvedShotDurationSeconds:p.slot.durationSeconds,
    mappingSha256:p.mappingSha256,renderPackage:p.base,alreadyLinked,
    note:'Technical Flow receipt verified. The operator must watch the clip and explicitly select it with render-flow-attach. No paid operations are performed.'};
}

/** Operator-only. Content-addressed copy, optimistic locking, history and atomic manifest change. */
export async function attachFlowRenderClip(studio,options){
  const {expectedSha256,expectedMappingSha256}=options;
  assert(typeof expectedSha256==='string'&&SHA.test(expectedSha256),'Operator must supply the exact clip SHA-256 from the read-only plan');
  assert(typeof expectedMappingSha256==='string'&&SHA.test(expectedMappingSha256),'Operator must supply the exact render mapping SHA-256 from the read-only plan');
  const preflight=await inspectLink(studio,options);
  assert(expectedSha256===preflight.receipt.sha256,'Operator selection hash does not match the Flow original');
  const lock=path.join(preflight.base,'.render-flow-link.lock');
  let handle;
  try {handle=await fs.open(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Render mapping currently locked; inspect existing operator process before retrying');throw e;}
  let temp;
  try {
    const p=await inspectLink(studio,options); // Validate again while holding the lock.
    assert(expectedMappingSha256===p.mappingSha256,'STALE_RENDER_MAPPING: re-run render-flow-plan before selecting the clip');
    if(p.slot.kind==='video' && p.slot.sha256===p.receipt.sha256){
      return {status:'ALREADY_LINKED',workflowId:p.workflowId,stepId:p.stepId,sha256:p.receipt.sha256,manifestPath:p.manifestPath};
    }
    const mediaDir=path.join(p.base,'media');
    try {await fs.mkdir(mediaDir,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}
    await validatedDir(mediaDir,'render media directory');
    const relative=`media/${p.stepId}-${p.receipt.sha256.slice(0,20)}${p.ext}`;
    const target=path.join(p.base,relative);
    try {await fs.copyFile(p.origin,target,fsConstants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;}
    await regularFile(target,'selected render clip');
    assert(await fileHash(target)===p.receipt.sha256,'Copied Flow clip changed; refusing to link');
    // Preserve every mapping revision. Do not delete previous selected media.
    const history=path.join(p.base,'render-history');
    try {await fs.mkdir(history,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}
    await validatedDir(history,'render mapping history');
    const priorPath=path.join(history,p.mappingSha256+'.json');
    try {await fs.copyFile(p.manifestPath,priorPath,fsConstants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;}
    await regularFile(priorPath,'render mapping history revision');
    assert(await fileHash(priorPath)===p.mappingSha256,'Previous render mapping history was modified');
    const updated=structuredClone(p.mapping),shot=updated.shots.find(x=>x.stepId===p.stepId);
    shot.kind='video';shot.file=relative;shot.sha256=p.receipt.sha256;shot.motion='static';
    shot.source={provider:'google-flow',workflowId:p.workflowId,stepId:p.stepId,accountId:p.accountId,
      providerJobId:p.jobId,archiveSha256:p.receipt.sha256,selectedBy:'local-operator',selectedAt:new Date().toISOString()};
    const contents=json(updated);
    temp=path.join(p.base,`.RENDER_INPUTS.${randomUUID()}.tmp`);
    await fs.writeFile(temp,contents,{flag:'wx',mode:0o600});
    assert(await fileHash(p.manifestPath)===p.mappingSha256,'STALE_RENDER_MAPPING: manifest changed during operator selection');
    await fs.rename(temp,p.manifestPath);temp=null;
    return {status:'FLOW_CLIP_SELECTED',storyId:p.storyId,workflowId:p.workflowId,stepId:p.stepId,
      sha256:p.receipt.sha256,file:relative,previousMappingSha256:p.mappingSha256,
      mappingSha256:hashBytes(contents),manifestPath:p.manifestPath,
      note:'Technical clip selected by operator; run render-plan then render. Final editorial approval is a separate decision.'};
  }finally{
    if(temp)await fs.rm(temp,{force:true});
    await handle.close();await fs.unlink(lock);
  }
}
