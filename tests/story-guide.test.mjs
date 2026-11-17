import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { Studio } from '../src/core.mjs';
import { StoryGuide } from '../src/story-guide.mjs';
import { WorkflowStudio } from '../src/workflows.mjs';

const narrative='Lia abre a porta da oficina. O relógio está parado. Ela vê a cidade submersa pela janela. Lia acende uma lanterna e sai em silêncio.';
const cast={visualStyle:'2D limited animation, high-contrast graphite, 9:16, recurring composition and color palette.',characters:[
  {id:'lia',name:'Lia',sourceExcerpt:'Lia abre a porta da oficina.',designPrompt:'Lia with short black hair, practical coat, consistent silhouette'}],locations:[
  {id:'oficina',name:'Oficina',sourceExcerpt:'a porta da oficina',designPrompt:'A compact workshop with a stopped analog clock'}],assumptions:['Hair and coat are proposed designs not described in source']};
const storyboard={scenes:[{id:'entrada',title:'Oficina abandonada',sourceExcerpt:'Lia abre a porta da oficina. O relógio está parado. Ela vê a cidade submersa pela janela.',locationId:'oficina',shots:[
  {id:'entrance',sourceExcerpt:'Lia abre a porta da oficina.',visualPrompt:'Close shot of a metal door opening',motionPrompt:'Door slowly creaks open',durationSeconds:6,characterIds:['lia'],camera:'slow dolly in'},
  {id:'clock',sourceExcerpt:'O relógio está parado.',visualPrompt:'Static clock face',motionPrompt:'Camera tilts toward stopped hands',durationSeconds:4,characterIds:[]}
]}, {id:'saida',title:'A cidade',sourceExcerpt:'Ela vê a cidade submersa pela janela. Lia acende uma lanterna e sai em silêncio.',locationId:'oficina',shots:[
  {id:'exit',sourceExcerpt:'Lia acende uma lanterna e sai em silêncio.',visualPrompt:'Silhouette behind a window',motionPrompt:'Lia walks away from the workshop',durationSeconds:8,characterIds:['lia']}
]}]};
async function setup(t){
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'vpm-story-'));t.after(()=>fs.rm(folder,{recursive:true,force:true}));
  const studio=new Studio(path.join(folder,'.studio'));
  return {studio,guide:new StoryGuide(studio),folder};
}
async function planned(t){
  const values=await setup(t);const {guide}=values;
  await guide.create({id:'story-01',title:'Oficina',storyText:narrative});
  await guide.submitCast('story-01',cast);
  await guide.submitStoryboard('story-01',storyboard);
  return values;
}

test('first call accepts a story only and returns a guided cast step',async t=>{
  const {guide}=await setup(t);
  const started=await guide.create({id:'pilot',title:'Pilot',storyText:narrative});
  assert.equal(started.next.stage,'cast');assert.equal(started.storyLength,narrative.length);
  const status=await guide.status('pilot');assert.equal(status.completed.story,true);assert.equal(status.completed.cast,false);
  const chunk=await guide.source('pilot',{offset:0,length:20});
  assert.equal(chunk.content,narrative.slice(0,20));assert.equal(chunk.hasMore,true);
});
test('original story identity is stable and cannot be replaced under same ID',async t=>{
  const {guide}=await setup(t);
  await guide.create({id:'pilot',title:'Pilot',storyText:narrative});
  assert.equal((await guide.create({id:'pilot',title:'Pilot',storyText:narrative})).alreadyExists,true);
  await assert.rejects(guide.create({id:'pilot',title:'Other',storyText:'Another story with same ID'}),/different source/);
  await assert.rejects(guide.create({id:'bad/unsafe',title:'Unsafe',storyText:narrative}),/invalid identifier/);
  await assert.rejects(guide.create({id:'x',title:'Bad',storyText:narrative,storyPath:'/tmp/story'}),/exactly one/);
});
test('cast details and storyboard references must come from the actual story',async t=>{
  const {guide}=await setup(t);
  await guide.create({id:'p',title:'P',storyText:narrative});
  await assert.rejects(guide.submitCast('p',{...cast,characters:[{...cast.characters[0],sourceExcerpt:'Invented text nowhere in story'}]}),/exact quotation/);
  await guide.submitCast('p',cast);
  await assert.rejects(guide.submitStoryboard('p',{scenes:[{...storyboard.scenes[0],shots:[{...storyboard.scenes[0].shots[0],characterIds:['unknown']}]}]}),/unknown character/);
  await assert.rejects(guide.submitStoryboard('p',{scenes:[{...storyboard.scenes[0],sourceExcerpt:'A fabricated scene never written'}]}),/exact quotation/);
});
test('guided stages are sequential, require explicit human approval and do not spend credits',async t=>{
  const {guide}=await planned(t);
  const status=await guide.status('story-01');assert.equal(status.next.stage,'approval');assert.equal(status.scenes,2);assert.equal(status.shots,3);
  await assert.rejects(guide.prepare({storyId:'story-01',accountId:'g1',videoEstimatedCredits:20}),/operator-approved/);
  await guide.approve('story-01');assert.equal((await guide.status('story-01')).next.stage,'account');
  await assert.rejects(guide.submitStoryboard('story-01',storyboard),/already approved/);
  await assert.rejects(guide.submitCast('story-01',cast),/frozen/);
});
test('compilation creates character references, scene frames, video steps and editable source manifests',async t=>{
  const {guide,studio}=await planned(t);
  await guide.approve('story-01');await studio.registerAccount({id:'g1',provider:'google-flow',label:'Manual auth',authorized:true,creditEstimate:240,upstreamId:'flow-bridge'});
  const output=await guide.prepare({storyId:'story-01',accountId:'g1',videoEstimatedCredits:25,includeCharacterCreation:true,includeSceneCompose:true});
  const production=JSON.parse(await fs.readFile(path.join(output.packageDir,'production.json'),'utf8'));
  const workflow=JSON.parse(await fs.readFile(path.join(output.packageDir,'workflow.json'),'utf8'));
  assert.equal(production.characters[0].libraryId,'story-01/lia');assert.equal(production.shots.length,3);
  assert.equal(workflow.steps.filter(x=>x.operation==='image.generate').length,5); // character + location + 3 frames
  assert.equal(workflow.steps.filter(x=>x.operation==='video.frames').length,3);
  assert.equal(workflow.steps.filter(x=>x.operation==='scene.compose').length,2);
  assert.equal(workflow.steps.filter(x=>x.operation==='character.create').length,1);
  const first=workflow.steps.find(x=>x.id==='frame-entrance');
  assert.deepEqual(first.inputs.referenceImages,['step:character-image-lia','step:location-image-oficina']);
  const video=workflow.steps.find(x=>x.id==='video-entrance');assert.equal(video.inputs.startFrame,'step:frame-entrance');
  assert.deepEqual(video.dependsOn,['frame-entrance']);
  assert.equal((await new WorkflowStudio(studio).plan(output.workflowId)).summary.total,11);
  assert.equal((await guide.status('story-01')).next.stage,'production');
  assert.match(await fs.readFile(path.join(output.packageDir,'RUNBOOK.md'),'utf8'),/not remote media/);
  assert.equal((await guide.prepare({storyId:'story-01',accountId:'g1',videoEstimatedCredits:25,includeCharacterCreation:true,includeSceneCompose:true})).alreadyPrepared,true);
});
test('no account or invalid account, negative quotas, and changing build settings are refused',async t=>{
  const {guide,studio}=await planned(t);await guide.approve('story-01');
  await assert.rejects(guide.prepare({storyId:'story-01',accountId:'absent',videoEstimatedCredits:20}),/authorized/);
  await studio.registerAccount({id:'g1',provider:'google-flow',label:'Auth',authorized:true,creditEstimate:20});
  await assert.rejects(guide.prepare({storyId:'story-01',accountId:'g1',videoEstimatedCredits:0}),/positive/);
  await guide.prepare({storyId:'story-01',accountId:'g1',videoEstimatedCredits:10});
  await assert.rejects(guide.prepare({storyId:'story-01',accountId:'g1',videoEstimatedCredits:99}),/immutable/);
});
test('reading a story detects local corruption',async t=>{
  const {guide,studio}=await setup(t);await guide.create({id:'p',title:'P',storyText:narrative});
  await fs.writeFile(path.join(studio.store.home,'stories/p/source.md'),'changed');
  await assert.rejects(guide.source('p'),/integrity/);
  await assert.rejects(guide.submitCast('p',cast),/changed/);
});
test('source coverage is reported rather than hallucinating missing scenes',async t=>{
  const {guide}=await setup(t);await guide.create({id:'p',title:'P',storyText:narrative});await guide.submitCast('p',cast);
  const x=await guide.submitStoryboard('p',{scenes:[{...storyboard.scenes[0],sourceExcerpt:'Lia abre a porta da oficina.',shots:[storyboard.scenes[0].shots[0]]}]});
  assert(x.sourceCoveragePercent<70);assert(x.warnings.length>0);
});
test('character reference IDs can be reused across an independent story by canonical libraryId',async t=>{
  const {guide,studio}=await planned(t);await guide.approve('story-01');await studio.registerAccount({id:'g1',provider:'google-flow',label:'Auth',authorized:true,creditEstimate:100});
  await guide.prepare({storyId:'story-01',accountId:'g1',videoEstimatedCredits:10});
  const catalog=await studio.library();assert(catalog.characters.some(x=>x.key==='story-01/lia@1'));
});

test('an agent can resume another session from the persisted cast and storyboard',async t=>{
  const {guide}=await planned(t);
  const resumed=new StoryGuide(guide.studio);
  const d=await resumed.draft('story-01');
  assert.equal(d.cast.characters[0].name,'Lia');assert.equal(d.storyboard.scenes[0].shots[0].id,'entrance');
  assert.equal(d.next.stage,'approval');
});
test('approved story source is checked again before compilation',async t=>{
  const {guide,studio}=await planned(t);await guide.approve('story-01');
  await studio.registerAccount({id:'g1',provider:'google-flow',label:'Authorized',authorized:true,creditEstimate:100});
  await fs.writeFile(path.join(studio.store.home,'stories/story-01/source.md'),'modified after approval');
  await assert.rejects(guide.prepare({storyId:'story-01',accountId:'g1',videoEstimatedCredits:20}),/integrity/);
});