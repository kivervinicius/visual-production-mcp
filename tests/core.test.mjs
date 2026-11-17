import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Studio } from '../src/core.mjs';

async function fixture({ withAsset = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-mcp-'));
  const studio = new Studio(path.join(root, '.studio'));
  const manifest = {
    schemaVersion: 1, id: 'episode-1', title: 'Episode One', source: { repository: 'local', ref: 'main', path: '.' },
    assets: withAsset ? [{id:'hero-front',path:'hero.png'}] : [],
    characters: [{id:'hero', version:1, description:'A protagonist', referenceAssetIds:withAsset ? ['hero-front'] : []}],
    shots: [
      {id:'scene1-shot1', prompt:'A brave protagonist enters a dark room', aspectRatio:'9:16', durationSeconds:6, characterIds:['hero'], referenceAssetIds:[], estimatedCredits:50},
      {id:'scene1-shot2', prompt:'The protagonist approaches the window', aspectRatio:'9:16', durationSeconds:6, characterIds:['hero'], referenceAssetIds:[], estimatedCredits:50}
    ]
  };
  if (withAsset) await fs.writeFile(path.join(root,'hero.png'), Buffer.from([1,2,3,4]));
  const file = path.join(root, 'production.json'); await fs.writeFile(file, JSON.stringify(manifest));
  return { root, studio, manifest, file };
}
async function account(studio, id, creditEstimate = 100) {
  return studio.registerAccount({ id, provider:'google-flow', label:id, upstreamId:id, creditEstimate, authorized:true });
}

test('imports canonical manifest and hashes copy-once assets', async t => {
  const {root,studio,file}=await fixture({withAsset:true}); t.after(() => fs.rm(root,{recursive:true,force:true}));
  const imported = await studio.importProject(file); assert.equal(imported.assets,1);
  const syncProject = await studio.store.read();
  const asset = syncProject.projects['episode-1'].manifest.assets[0];
  assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  await fs.access(path.join(studio.store.home,asset.storedPath));
  assert.deepEqual(await studio.importProject(file), imported);
});

test('plans idempotently across separate accounts and never pools credits', async t => {
  const {root,studio,file}=await fixture(); t.after(() => fs.rm(root,{recursive:true,force:true}));
  await studio.importProject(file); await account(studio,'a',50); await account(studio,'b',50);
  const first = await studio.plan({projectId:'episode-1'});
  assert.deepEqual(first.jobs.map(j=>j.accountId),['a','b']);
  assert.equal(first.jobs.every(j=>j.status==='awaiting_approval'),true);
  const second = await studio.plan({projectId:'episode-1'});
  assert.deepEqual(second.jobs.map(j=>j.id),first.jobs.map(j=>j.id));
  const next = await studio.plan({projectId:'episode-1',variant:'v2'});
  assert.equal(next.jobs.every(j=>j.status==='unassigned'),true);
});

test('requires actual operator approval; duplicate dispatch claim is blocked', async t => {
  const {root,studio,file}=await fixture(); t.after(() => fs.rm(root,{recursive:true,force:true}));
  await studio.importProject(file); await account(studio,'a');
  const {jobs}=await studio.plan({projectId:'episode-1'}); const job = jobs[0];
  await assert.rejects(studio.claimForDispatch(job.id),/not approved/);
  await assert.rejects(studio.approve(job.id,false),/explicit approval/);
  await studio.approve(job.id,true); await studio.claimForDispatch(job.id);
  await assert.rejects(studio.claimForDispatch(job.id),/not approved/);
  await studio.mark(job.id,'submission_unknown',{note:'Provider response ambiguous'});
  await assert.rejects(studio.claimForDispatch(job.id),/not approved/);
});

test('sync plan reports missing account-local inputs, then becomes ready', async t => {
  const {root,studio,file}=await fixture({withAsset:true}); t.after(() => fs.rm(root,{recursive:true,force:true}));
  await studio.importProject(file); await account(studio,'a');
  const request = {projectId:'episode-1',accountId:'a',shotId:'scene1-shot1'};
  const before = await studio.syncPlan(request);
  assert.deepEqual(before.missing.assets,['hero-front']); assert.deepEqual(before.missing.characters,['hero']);
  await studio.bindAccountProject({projectId:'episode-1',accountId:'a',remoteProjectId:'flow-p-1',assets:{'hero-front':'flow-asset-1'},characters:{hero:'flow-char-1'}});
  const after = await studio.syncPlan(request); assert.equal(after.ready,true);
  assert.equal(after.remoteProjectId,'flow-p-1');
});

test('bundle contains portable manifest and reference bytes without account credentials', async t => {
  const {root,studio,file}=await fixture({withAsset:true}); t.after(() => fs.rm(root,{recursive:true,force:true}));
  await studio.importProject(file); await account(studio,'a');
  const exported = await studio.bundle({projectId:'episode-1',outputDir:path.join(root,'out')});
  const data = JSON.parse(await fs.readFile(path.join(exported.outputDir,'production.json'),'utf8'));
  assert.equal(data.assets.length,1); assert.equal(typeof data.assets[0].storedPath,'undefined');
  await fs.access(path.join(exported.outputDir,data.assets[0].path));
  assert.equal(JSON.stringify(data).includes('creditEstimate'),false);
});

test('refuses import of malicious relative path and invalid project dependencies', async t => {
  const {root,studio,file,manifest}=await fixture(); t.after(() => fs.rm(root,{recursive:true,force:true}));
  manifest.assets=[{id:'bad',path:'../secrets.txt'}]; await fs.writeFile(file,JSON.stringify(manifest));
  await assert.rejects(studio.importProject(file),/escapes manifest directory/);
});