import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Studio } from '../src/core.mjs';
import { ingestResult, reviewResult } from '../src/media.mjs';
import { preflight } from '../src/preflight.mjs';

async function workspace(t, { characterId='hero', version=1 } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-reliability-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const studio = new Studio(path.join(dir, '.studio'));
  const manifest = { schemaVersion:1, id:'ep1', title:'Episode 1', assets:[],
    characters:[{id:'hero',libraryId:characterId,version,description:'Consistent cast',referenceAssetIds:[]}],
    shots:[{id:'s1',prompt:'The hero arrives',aspectRatio:'9:16',durationSeconds:8,characterIds:['hero'],referenceAssetIds:[],estimatedCredits:40}] };
  const file=path.join(dir,'production.json');
  await fs.writeFile(file,JSON.stringify(manifest));
  await studio.importProject(file);
  await studio.registerAccount({id:'a',provider:'google-flow',label:'Session A',upstreamId:'flow-a',authorized:true,creditEstimate:40});
  return {studio,dir,file,manifest};
}

test('characters use explicit global libraryId and do not silently mutate an approved version', async t => {
  const {studio,manifest,file}=await workspace(t,{characterId:'arquivo-amanha/hero'});
  const entries=await studio.library();
  assert.equal(entries.characters[0].key,'arquivo-amanha/hero@1');
  manifest.characters[0].description='Unexpected visual change';
  await fs.writeFile(file,JSON.stringify(manifest));
  await assert.rejects(studio.importProject(file),/Character revision conflict/);
  manifest.characters[0].version=2;
  await fs.writeFile(file,JSON.stringify(manifest));
  await studio.importProject(file);
  assert.equal((await studio.library()).characters.length,2);
});

test('remote binding rejects invalid IDs and exposes operator-reported evidence', async t => {
  const {studio}=await workspace(t);
  await assert.rejects(studio.bindAccountProject({projectId:'ep1',accountId:'a',remoteProjectId:'p',characters:{hero:''}}),/remote character id/);
  const bound=await studio.bindAccountProject({projectId:'ep1',accountId:'a',remoteProjectId:'p',characters:{hero:'native-char'}});
  assert.match(bound.evidence,/operator-reported/);
  assert.equal((await studio.syncPlan({projectId:'ep1',accountId:'a',shotId:'s1'})).ready,true);
});

test('result ingestion verifies image signature, SHA-256, retains original, and requires editorial review', async t => {
  const {studio,dir}=await workspace(t);
  await studio.bindAccountProject({projectId:'ep1',accountId:'a',remoteProjectId:'p',characters:{hero:'native-char'}});
  const {jobs}=await studio.plan({projectId:'ep1'});
  const job=jobs[0];
  await studio.approve(job.id,true);
  await studio.claimForDispatch(job.id);
  await studio.mark(job.id,'submitted',{externalJobId:'provider-op-123'});
  const file=path.join(dir,'result.png');
  const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex');
  await fs.writeFile(file,png);
  const receipt=await ingestResult(studio,{jobId:job.id,filePath:file});
  assert.equal(receipt.review,'pending');
  assert.equal(receipt.receipt.kind,'image');
  await fs.access(path.join(studio.store.home,receipt.receipt.storedPath));
  assert.equal((await ingestResult(studio,{jobId:job.id,filePath:file})).alreadyImported,true);
  await assert.rejects(studio.mark(job.id,'complete',{resultPath:'fake.png'}),/Use studio_ingest_result/);
  const humanReview=await reviewResult(studio,{jobId:job.id,decision:'approved',note:'Story continuity checked'});
  assert.equal(humanReview.review,'approved');
});

test('invalid media or uncertain submissions cannot be marked complete without evidence', async t => {
  const {studio,dir}=await workspace(t);
  const {jobs}=await studio.plan({projectId:'ep1'}); const job=jobs[0];
  await studio.approve(job.id,true);await studio.claimForDispatch(job.id);
  await studio.mark(job.id,'submission_unknown',{note:'timeout during submit'});
  const bad=path.join(dir,'fake.png');await fs.writeFile(bad,'not a png');
  await assert.rejects(ingestResult(studio,{jobId:job.id,filePath:bad}),/reconcile unknown submissions/);
  const file=path.join(dir,'good.png');await fs.writeFile(file,Buffer.from('89504e470d0a1a0a','hex'));
  await assert.rejects(ingestResult(studio,{jobId:job.id,filePath:file}),/reconcile unknown submissions/);
  await studio.mark(job.id,'submitted',{externalJobId:'confirmed-op1',note:'Operator verified'});
  await assert.rejects(ingestResult(studio,{jobId:job.id,filePath:bad}),/image signature/);
  const recorded=await ingestResult(studio,{jobId:job.id,filePath:file});
  assert.equal(recorded.status,'complete');
});

test('preflight detects missing upstream configuration without connecting or spending credits', async t => {
  const {studio}=await workspace(t);
  const inspection=await preflight(studio,{projectId:'ep1',accountId:'a',shotId:'s1'});
  assert.equal(inspection.localReady,false);
  assert.equal(inspection.liveReady,false);
  assert(inspection.failures.some(s=>s.includes('Missing remote bindings')));
  assert(inspection.failures.some(s=>s.includes('Upstream configuration/connection')));
});

test('concurrent workspace initialization does not overwrite existing state', async t => {
  const {studio}=await workspace(t);
  await Promise.all(Array.from({length:10},()=>studio.store.read()));
  assert.equal((await studio.store.read()).projects.ep1.manifest.title,'Episode 1');
});