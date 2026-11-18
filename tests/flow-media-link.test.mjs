import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { Studio } from '../src/core.mjs';
import { writeRenderTemplate, renderPlan, renderMedia } from '../src/application/deliver/media-composer.mjs';
import { planFlowRenderLink, attachFlowRenderClip } from '../src/application/deliver/flow-media-link.mjs';

const exec=promisify(execFile);
const sha256 = data=>createHash('sha256').update(data).digest('hex');
const jobId='aaaaaaab-bbbb-4ccc-8ddd-eeeeeeeeeeee';
async function make(t,{duration=2,width=180,height=320}={}) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vpm-flow-render-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const home=path.join(root,'.studio');const studio=new Studio(home);await studio.store.init();
  const sourceSha256=sha256('Mara entra.');
  const packageDir=path.join(home,'stories','pilot','offline-render');
  await fs.mkdir(packageDir,{recursive:true});
  const production={id:'pilot',schemaVersion:1,source:{sha256:sourceSha256},shots:[{id:'a',sceneId:'s1',durationSeconds:2,aspectRatio:'9:16',prompt:'Mara entra.',sourceExcerpt:'Mara entra.'}]};
  const edit={sourceSha256,storyId:'pilot',aspectRatio:'9:16',scenes:[{sceneId:'s1',shots:['video-a']}]};
  await fs.writeFile(path.join(packageDir,'production.json'),JSON.stringify(production));
  await fs.writeFile(path.join(packageDir,'EDIT_MANIFEST.json'),JSON.stringify(edit));
  await writeRenderTemplate(packageDir,{width:180,height:320});
  const native=path.join(home,'outputs','flow',jobId);await fs.mkdir(native,{recursive:true});
  const original=path.join(root,'clip.mp4');
  await exec('ffmpeg',['-hide_banner','-nostdin','-loglevel','error','-y','-f','lavfi','-i',`color=c=red:s=${width}x${height}:r=24:d=${duration}`,'-c:v','libx264','-pix_fmt','yuv420p',original]);
  const data=await fs.readFile(original),sha=sha256(data),archive=path.join(native,sha+'.mp4');
  await fs.copyFile(original,archive);
  const output={providerJobId:jobId,mediaType:'video',receipt:{sha256:sha,bytes:data.length,storedPath:`outputs/flow/${jobId}/${sha}.mp4`}};
  await studio.store.mutate(s=>{
    s.stories={pilot:{id:'pilot',sha256:sourceSha256,approvedAt:'2026-11-18T00:00:00Z',prepared:{productionId:'pilot-production',workflowId:'pilot-acc-flow'}}};
    s.accounts.acc={id:'acc',provider:'google-flow',enabled:true,authorized:true};
    s.projects['pilot-production']={manifest:{shots:[{...production.shots[0]}]}};
    s.workflows['pilot-acc-flow']={spec:{id:'pilot-acc-flow',projectId:'pilot-production',steps:[{id:'video-a',accountId:'acc',operation:'video.text',inputs:{aspectRatio:'9:16',durationSeconds:2}}]},steps:{'video-a':{status:'completed',externalJobId:jobId,output}}};
  });
  return {root,home,studio,packageDir,sha,jobId,archive,original,output,edit,production,
    options:{workflowId:'pilot-acc-flow',stepId:'video-a',packageDir}};
}
async function attach(p){const plan=await planFlowRenderLink(p.studio,p.options);return attachFlowRenderClip(p.studio,{...p.options,expectedSha256:p.sha,expectedMappingSha256:plan.mappingSha256});}

test('links a verified Flow original to the matching storyboard shot and renders a real MP4 with provenance',async t=>{
  const p=await make(t);const plan=await planFlowRenderLink(p.studio,p.options);
  assert.equal(plan.status,'AWAITING_OPERATOR_SELECTION');assert.equal(plan.sha256,p.sha);
  assert.equal(plan.clipDurationSeconds>=2,true);
  const selected=await attach(p);assert.equal(selected.status,'FLOW_CLIP_SELECTED');
  const manifest=path.join(p.packageDir,'RENDER_INPUTS.json');
  const data=JSON.parse(await fs.readFile(manifest,'utf8'));
  assert.equal(data.shots[0].kind,'video');assert.equal(data.shots[0].sha256,p.sha);
  assert.equal(data.shots[0].source.provider,'google-flow');assert.equal(data.shots[0].source.providerJobId,jobId);
  const preflight=await renderPlan(manifest);assert.equal(preflight.status,'READY_TO_RENDER');
  assert.equal(preflight.shots[0].source.providerJobId,jobId);
  const result=await renderMedia(manifest);assert.equal(result.status,'PREVIEW_RENDERED');
  assert.equal(result.inputs[0].source.archiveSha256,p.sha);
  assert.equal(result.technical.durationSeconds,2);
  const output=JSON.parse(await fs.readFile(path.join(result.outputDir,'RENDER_MANIFEST.json'),'utf8'));
  assert.equal(output.inputs[0].source.workflowId,'pilot-acc-flow');
  assert.equal((await planFlowRenderLink(p.studio,p.options)).status,'ALREADY_LINKED');
  const again=await attach(p);assert.equal(again.status,'ALREADY_LINKED');
});

test('requires both explicit clip hash and current render mapping revision',async t=>{
  const p=await make(t);const plan=await planFlowRenderLink(p.studio,p.options);
  await assert.rejects(attachFlowRenderClip(p.studio,{...p.options,expectedSha256:'f'.repeat(64),expectedMappingSha256:plan.mappingSha256}),/selection hash/);
  await assert.rejects(attachFlowRenderClip(p.studio,{...p.options,expectedSha256:p.sha,expectedMappingSha256:'a'.repeat(64)}),/STALE_RENDER_MAPPING/);
  assert.deepEqual((await fs.readdir(p.packageDir)).filter(x=>x.startsWith('.render-flow-link')),[]);
});

test('unknown, unverified and wrong-account jobs never enter the render',async t=>{
  const p=await make(t);
  await p.studio.store.mutate(s=>{s.workflows['pilot-acc-flow'].steps['video-a'].status='submission_unknown';});
  await assert.rejects(planFlowRenderLink(p.studio,p.options),/completed Flow video/);
  await p.studio.store.mutate(s=>{s.workflows['pilot-acc-flow'].steps['video-a'].status='completed';s.accounts.acc.provider='higgsfield';});
  await assert.rejects(planFlowRenderLink(p.studio,p.options),/Google Flow account/);
});

test('wrong story or workflow canonical shot cannot be linked',async t=>{
  const p=await make(t);
  await p.studio.store.mutate(s=>{s.stories.pilot.sha256='f'.repeat(64);});
  await assert.rejects(planFlowRenderLink(p.studio,p.options),/approved story source/);
  await p.studio.store.mutate(s=>{s.stories.pilot.sha256=p.edit.sourceSha256;s.projects['pilot-production'].manifest.shots[0].durationSeconds=3;});
  await assert.rejects(planFlowRenderLink(p.studio,p.options),/shot differs from the approved workflow/);
});

test('does not accept a provider receipt whose bytes, path or digest changed',async t=>{
  const p=await make(t);
  await fs.appendFile(p.archive,'tampered');
  await assert.rejects(planFlowRenderLink(p.studio,p.options),/SHA-256 mismatch/);
  await fs.copyFile(p.original,p.archive);
  await p.studio.store.mutate(s=>{s.workflows['pilot-acc-flow'].steps['video-a'].output.receipt.storedPath='../private.mp4';});
  await assert.rejects(planFlowRenderLink(p.studio,p.options),/named by verified digest|dedicated job archive/);
});

test('refuses symlinked Flow archives and symlinked media directories',async t=>{
  const p=await make(t);await fs.unlink(p.archive);await fs.symlink(p.original,p.archive);
  await assert.rejects(planFlowRenderLink(p.studio,p.options),/regular file/);
  await fs.unlink(p.archive);await fs.copyFile(p.original,p.archive);
  const m=path.join(p.packageDir,'media');await fs.symlink(p.root,m);
  await assert.rejects(attach(p),/real directory/);
});

test('rejects Flow clips shorter than the approved duration or wrong aspect ratio',async t=>{
  const p=await make(t,{duration:1});await assert.rejects(planFlowRenderLink(p.studio,p.options),/shorter than approved storyboard/);
  const q=await make(t,{width:320,height:180});await assert.rejects(planFlowRenderLink(q.studio,q.options),/aspect ratio incompatible/);
});

test('keeps previous mappings and originals when selecting a new verified variation',async t=>{
  const p=await make(t);const first=await attach(p);const manifest=path.join(p.packageDir,'RENDER_INPUTS.json');
  const before=JSON.parse(await fs.readFile(manifest,'utf8'));
  await exec('ffmpeg',['-hide_banner','-nostdin','-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=180x320:r=24:d=2','-c:v','libx264','-pix_fmt','yuv420p',p.original]);
  const buffer=await fs.readFile(p.original),secondSha=sha256(buffer),secondPath=path.join(path.dirname(p.archive),secondSha+'.mp4');
  await fs.copyFile(p.original,secondPath);
  await p.studio.store.mutate(s=>{const proof=s.workflows['pilot-acc-flow'].steps['video-a'].output.receipt;proof.sha256=secondSha;proof.bytes=buffer.length;proof.storedPath=`outputs/flow/${jobId}/${secondSha}.mp4`;});
  const next=await planFlowRenderLink(p.studio,p.options);
  const second=await attachFlowRenderClip(p.studio,{...p.options,expectedSha256:secondSha,expectedMappingSha256:next.mappingSha256});
  assert.notEqual(first.mappingSha256,second.mappingSha256);
  await fs.access(path.join(p.packageDir,before.shots[0].file));
  await fs.access(path.join(p.packageDir,'render-history',first.mappingSha256+'.json'));
  const end=JSON.parse(await fs.readFile(manifest,'utf8'));
  assert.equal(end.shots[0].sha256,secondSha);
});
