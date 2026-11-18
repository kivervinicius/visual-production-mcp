import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Studio } from '../src/core.mjs';
import { VisualLibrary } from '../src/application/library/visual-library.mjs';
import { StoryGuide } from '../src/story-guide.mjs';

// Valid short PNG fixtures are enough for binary provenance tests, not image-quality tests.
const A='89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082';
const B='89504e470d0a1a0a0000000d4948445200000002000000010806000000f4227f8a0000000b49444154789c636000020000050001a5f645400000000049454e44ae426082';
async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vpm-visual-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const a=path.join(root,'a.png'),b=path.join(root,'b.png');
  await fs.writeFile(a,Buffer.from(A,'hex'));await fs.writeFile(b,Buffer.from(B,'hex'));
  const studio=new Studio(path.join(root,'.studio'));
  return {root,a,b,studio,library:new VisualLibrary(studio)};
}
async function manifest(root,id,characters,shots) {
 const folder=path.join(root,id);await fs.mkdir(folder);
 const p=path.join(folder,'production.json');
 await fs.writeFile(p,JSON.stringify({schemaVersion:1,id,title:id,assets:[],characters,shots}));return p;
}
const char=(libraryId,version=1)=>({id:'lia',libraryId,version,description:'Lia em desenho 2D, casaco preto',referenceAssetIds:[]});
const shot=(id,characters=[])=>({id,prompt:`Cena ${id}`,aspectRatio:'9:16',durationSeconds:6,estimatedCredits:20,characterIds:characters,referenceAssetIds:[]});

test('visual proposals are immutable, idempotent and only the operator can approve a version',async t=>{
 const {a,b,library}=await fixture(t);
 const proposed=await library.propose({libraryId:'global/lia',kind:'character',name:'Lia',description:char('global/lia').description,referencePaths:[a],originNotes:'Imagem aprovada para avaliação humana'});
 assert.equal(proposed.version,1);assert.equal(proposed.status,'proposed');
 const repeat=await library.propose({libraryId:'global/lia',kind:'character',name:'Lia',description:char('global/lia').description,referencePaths:[a],originNotes:'Imagem aprovada para avaliação humana'});
 assert.equal(repeat.alreadyExists,true);
 await assert.rejects(library.decide({libraryId:'global/lia',version:1,decision:'approve',expectedFingerprint:'0'.repeat(64)}),/STALE_REVIEW/);
 const approved=await library.decide({libraryId:'global/lia',version:1,decision:'approve',expectedFingerprint:proposed.fingerprint});
 assert.equal(approved.status,'approved');
 await assert.rejects(library.decide({libraryId:'global/lia',version:1,decision:'reject',expectedFingerprint:proposed.fingerprint,note:'Mudou'}),/already approved/);
 const second=await library.propose({libraryId:'global/lia',kind:'character',name:'Lia',description:char('global/lia').description,referencePaths:[b]});
 assert.equal(second.version,2);
 const entries=(await library.list({approvedOnly:true})).items;assert.equal(entries[0].latestApprovedVersion,1);
 const verified=await library.verify({libraryId:'global/lia',version:1});assert.equal(verified.verifiedHashes.length,1);
});

test('operator cannot approve character without image or after a rejected immutable proposal',async t=>{
 const {library}=await fixture(t);
 const v1=await library.propose({libraryId:'global/camila',kind:'character',name:'Camila',description:'Mulher com cabelos longos'});
 await assert.rejects(library.decide({libraryId:'global/camila',version:1,decision:'approve',expectedFingerprint:v1.fingerprint}),/reference image is required/);
 const rejected=await library.decide({libraryId:'global/camila',version:1,decision:'reject',note:'Precisa de referência',expectedFingerprint:v1.fingerprint});
 assert.equal(rejected.status,'rejected');
 await assert.rejects(library.decide({libraryId:'global/camila',version:1,decision:'approve',expectedFingerprint:v1.fingerprint}),/already rejected/);
 const style=await library.propose({libraryId:'global/stickman',kind:'style',name:'Stickman 2D',description:'Contornos simples e contraste alto'});
 const approved=await library.decide({libraryId:'global/stickman',version:1,decision:'approve',expectedFingerprint:style.fingerprint});
 assert.equal(approved.status,'approved');
});

test('references are content-addressed and bad input, symlink and corruption are rejected',async t=>{
 const {root,a,studio,library}=await fixture(t);
 const link=path.join(root,'linked.png');await fs.symlink(a,link);
 await assert.rejects(library.propose({libraryId:'refs/linked',kind:'location',name:'Lugar',description:'Lugar A',referencePaths:[link]}),/non-symlink/);
 const fake=path.join(root,'fake.png');await fs.writeFile(fake,'not image');
 await assert.rejects(library.propose({libraryId:'refs/fake',kind:'character',name:'Fake',description:'Fake',referencePaths:[fake]}),/not a supported/);
 await assert.rejects(library.propose({libraryId:'__proto__',kind:'style',name:'bad',description:'bad'}),/invalid identifier/);
 const p=await library.propose({libraryId:'scene/workshop',kind:'location',name:'Oficina',description:'Um galpão',referencePaths:[a]});
 const ref=(await library.get({libraryId:'scene/workshop',version:1})).references[0];
 await fs.appendFile(path.join(studio.store.home,ref.storedPath),'tampered');
 await assert.rejects(library.decide({libraryId:'scene/workshop',version:1,decision:'approve',expectedFingerprint:p.fingerprint}),/missing or changed|integrity mismatch/);
});

test('impact is granular across stories, scenes and canonical projects; no snapshots mutate',async t=>{
 const {root,a,studio,library}=await fixture(t);
 const first=await library.propose({libraryId:'shared/lia',kind:'character',name:'Lia',description:char('shared/lia').description,referencePaths:[a]});
 await library.decide({libraryId:'shared/lia',version:1,decision:'approve',expectedFingerprint:first.fingerprint});
 for(const id of ['ep01','ep02']){
   const file=await manifest(root,id,[char('shared/lia')],[shot('uses-lia',['lia']),shot('no-lia')]);
   await studio.importProject(file);
 }
 const guide=new StoryGuide(studio);
 await guide.create({id:'episode-story',title:'Lia',storyText:'Lia caminhou para a oficina. O gato dormia.'});
 await guide.submitCast('episode-story',{visualStyle:'2D',characters:[{id:'lia',name:'Lia',designPrompt:'Lia de casaco',sourceExcerpt:'Lia caminhou',libraryId:'shared/lia'}],locations:[],assumptions:[]});
 await guide.submitStoryboard('episode-story',{scenes:[{id:'s1',title:'Caminhada',sourceExcerpt:'Lia caminhou',shots:[{id:'p1',sourceExcerpt:'Lia caminhou',visualPrompt:'Lia anda',motionPrompt:'Caminhar',durationSeconds:5,characterIds:['lia']},{id:'p2',sourceExcerpt:'O gato dormia.',visualPrompt:'Gato',motionPrompt:'Respira',durationSeconds:5,characterIds:[]}]}]});
 const p=await library.propose({libraryId:'shared/lia',kind:'character',name:'Lia',description:'Lia em desenho 2D, casaco azul',referencePaths:[a]});
 const impact=await library.impact({libraryId:'shared/lia',version:p.version});
 assert.equal(impact.projects.length,2);assert(impact.projects.every(x=>x.shots.length===1 && x.shots[0].shotId==='uses-lia'));
 assert.equal(impact.stories.length,1);assert.deepEqual(impact.stories[0].shots.map(x=>x.shotId),['p1']);
 const read=await studio.store.read();assert.equal(read.projects.ep01.manifest.characters[0].version,1);
 assert.equal((await library.projectReadiness({projectId:'ep01'})).readyForContinuity,true);
});

test('a character version mismatch is flagged, not silently upgraded',async t=>{
 const {root,a,studio,library}=await fixture(t);
 const p=await library.propose({libraryId:'shared/lia',kind:'character',name:'Lia',description:'Different description',referencePaths:[a]});
 await library.decide({libraryId:'shared/lia',version:1,decision:'approve',expectedFingerprint:p.fingerprint});
 const filename=await manifest(root,'episode',[char('shared/lia')],[shot('p1',['lia'])]);
 await studio.importProject(filename);
 const ready=await library.projectReadiness({projectId:'episode'});
 assert.equal(ready.characters[0].status,'DESCRIPTION_MISMATCH');assert.equal(ready.readyForContinuity,false);
});

test('per-shot candidates preserve originals and one selection with human review',async t=>{
 const {root,a,b,studio,library}=await fixture(t);
 const file=await manifest(root,'episode',[],[shot('plan1'),shot('plan2')]);await studio.importProject(file);
 const one=await library.submitShot({projectId:'episode',shotId:'plan1',variant:'v01',filePath:a});
 await assert.rejects(library.decideShot({projectId:'episode',shotId:'plan1',variant:'v01',expectedSha256:'0'.repeat(64),decision:'approve'}),/STALE_REVIEW/);
 const reject=await library.decideShot({projectId:'episode',shotId:'plan1',variant:'v01',expectedSha256:one.sha256,decision:'reject',note:'O figurino mudou'});
 assert.equal(reject.selectedVariant,null);
 await assert.rejects(library.decideShot({projectId:'episode',shotId:'plan1',variant:'v01',expectedSha256:one.sha256,decision:'approve'}),/Already reviewed/);
 const two=await library.submitShot({projectId:'episode',shotId:'plan1',variant:'v02',filePath:b});
 const approve=await library.decideShot({projectId:'episode',shotId:'plan1',variant:'v02',expectedSha256:two.sha256,decision:'approve'});
 assert.equal(approve.selectedVariant,'v02');
 const another=await library.shotList({projectId:'episode',shotId:'plan2'});assert.equal(Object.keys(another.variants).length,0);
 await assert.rejects(library.submitShot({projectId:'episode',shotId:'plan1',variant:'v02',filePath:a}),/Variant ID already/);
 const state=await library.shotList({projectId:'episode',shotId:'plan1'});assert.equal(state.variants.v01.status,'rejected');assert.equal(state.variants.v02.status,'approved');
});

test('parallel proposals of same canonical spec are idempotent under state lock',async t=>{
 const {a,library}=await fixture(t);
 const proposal={libraryId:'shared/place',kind:'location',name:'Place',description:'House',referencePaths:[a]};
 const results=await Promise.all([library.propose(proposal),library.propose(proposal)]);
 assert.deepEqual(results.map(x=>x.version),[1,1]);
 const item=await library.get({libraryId:'shared/place'});assert.equal(Object.keys(item.versions).length,1);
});

test('approved character and location reference images are actually reused by story compilation, not regenerated',async t=>{
 const {a,b,studio,library}=await fixture(t);
 const pc=await library.propose({libraryId:'shared/lia',kind:'character',name:'Lia',description:'Lia de casaco',referencePaths:[a]});
 await library.decide({libraryId:'shared/lia',version:1,decision:'approve',expectedFingerprint:pc.fingerprint});
 const pl=await library.propose({libraryId:'shared/oficina',kind:'location',name:'Oficina',description:'Oficina escura',referencePaths:[b]});
 await library.decide({libraryId:'shared/oficina',version:1,decision:'approve',expectedFingerprint:pl.fingerprint});
 const guide=new StoryGuide(studio);
 await guide.create({id:'reuse',title:'Reuso',storyText:'Lia entrou na oficina.'});
 await guide.submitCast('reuse',{visualStyle:'2D',characters:[{id:'lia',name:'Lia',sourceExcerpt:'Lia entrou',designPrompt:'Lia de casaco',libraryId:'shared/lia',libraryVersion:1}],locations:[{id:'oficina',name:'Oficina',sourceExcerpt:'na oficina',designPrompt:'Oficina escura',libraryId:'shared/oficina',libraryVersion:1}],assumptions:[]});
 await guide.submitStoryboard('reuse',{scenes:[{id:'sc1',title:'Entrada',sourceExcerpt:'Lia entrou na oficina.',locationId:'oficina',shots:[{id:'sh1',sourceExcerpt:'Lia entrou',visualPrompt:'Lia',motionPrompt:'Caminha',durationSeconds:6,characterIds:['lia']}]}]});
 await guide.approve('reuse');
 await studio.registerAccount({id:'flow',label:'Conta A',provider:'google-flow',authorized:true,creditEstimate:100,upstreamId:'bridge'});
 const pkg=await guide.prepare({storyId:'reuse',accountId:'flow',videoEstimatedCredits:20,includeCharacterCreation:true});
 const production=JSON.parse(await fs.readFile(path.join(pkg.packageDir,'production.json'),'utf8'));
 const flow=JSON.parse(await fs.readFile(path.join(pkg.packageDir,'workflow.json'),'utf8'));
 assert.equal(production.assets.length,2);assert.equal(pkg.reusedReferenceImages,2);
 assert.equal(production.characters[0].referenceAssetIds.length,1);
 assert.equal(production.characters[0].version,1);
 assert.equal(flow.steps.filter(x=>x.operation==='asset.upload').length,2);
 assert.equal(flow.steps.filter(x=>x.operation==='image.generate').length,1); // Scene frame only
 const frame=flow.steps.find(x=>x.id==='frame-sh1');
 assert.equal(frame.inputs.referenceImages.length,2);
 assert(frame.inputs.referenceImages.every(x=>x.startsWith('asset:')));
 assert.equal(frame.dependsOn.length,2);
 const results=await studio.syncPlan({projectId:pkg.productionId,accountId:'flow',shotId:'sh1'});
 assert.equal(results.missing.project,true);
 const output=await library.projectReadiness({projectId:pkg.productionId});
 assert(output.readyForContinuity);
 const prepared=await guide.prepare({storyId:'reuse',accountId:'flow',videoEstimatedCredits:20,includeCharacterCreation:true});
 assert(prepared.alreadyPrepared);
});

test('pinned visual revision or changed cast design must not silently select a different appearance',async t=>{
 const {a,studio,library}=await fixture(t);
 const p=await library.propose({libraryId:'shared/lia',kind:'character',name:'Lia',description:'Lia de casaco',referencePaths:[a]});
 await library.decide({libraryId:'shared/lia',version:1,decision:'approve',expectedFingerprint:p.fingerprint});
 const guide=new StoryGuide(studio);
 await guide.create({id:'mismatch',title:'Mismatch',storyText:'Lia voltou.'});
 await guide.submitCast('mismatch',{visualStyle:'2D',characters:[{id:'lia',name:'Lia',sourceExcerpt:'Lia voltou.',designPrompt:'Lia de vestido azul',libraryId:'shared/lia',libraryVersion:1}],locations:[],assumptions:[]});
 await guide.submitStoryboard('mismatch',{scenes:[{id:'sc1',title:'V',sourceExcerpt:'Lia voltou.',shots:[{id:'sh1',sourceExcerpt:'Lia voltou.',visualPrompt:'Lia',motionPrompt:'Caminha',durationSeconds:6,characterIds:['lia']}]}]});
 await guide.approve('mismatch');
 await studio.registerAccount({id:'flow',label:'Conta A',provider:'google-flow',authorized:true,creditEstimate:100});
 await assert.rejects(guide.prepare({storyId:'mismatch',accountId:'flow',videoEstimatedCredits:20}),/Visual description mismatch/);
});

test('visual reference approval is shown in stage status and emitted as durable cursor events',async t=>{
 const {a,studio,library}=await fixture(t);
 const {StageEngine}=await import('../src/application/guide/stage-engine.mjs');
 const guide=new StoryGuide(studio),engine=new StageEngine(studio);
 await guide.create({id:'alerts',title:'Alerta',storyText:'Lia entrou na oficina.'});
 await guide.submitCast('alerts',{visualStyle:'2D',styleLibraryId:'shared/blackwhite',characters:[{id:'lia',name:'Lia',designPrompt:'Lia de casaco',sourceExcerpt:'Lia entrou',libraryId:'shared/lia'}],locations:[{id:'oficina',name:'Oficina',designPrompt:'Galpão',sourceExcerpt:'na oficina',libraryId:'shared/workshop'}],assumptions:[]});
 await guide.submitStoryboard('alerts',{scenes:[{id:'sc',title:'Cena',sourceExcerpt:'Lia entrou na oficina.',locationId:'oficina',shots:[{id:'sh',sourceExcerpt:'Lia entrou',visualPrompt:'Lia chega',motionPrompt:'Entra',durationSeconds:5,characterIds:['lia']}]}]});
 const before=await engine.status('alerts');
 assert.equal(before.visualContinuity.required,3);
 const p=await library.propose({libraryId:'shared/lia',kind:'character',name:'Lia',description:'Lia de casaco',referencePaths:[a]});
 const decision=await library.decide({libraryId:'shared/lia',version:1,expectedFingerprint:p.fingerprint,decision:'approve'});
 assert.equal(decision.status,'approved');
 const events=await engine.events('alerts',{cursor:before.eventsCursor});
 assert(events.events.some(x=>x.type==='visual_revision_decision'&&x.libraryId==='shared/lia'));
 const after=await engine.status('alerts');assert.equal(after.visualContinuity.locallyApproved,1);
 const noRepeat=await engine.events('alerts',{cursor:after.eventsCursor});assert.equal(noRepeat.events.length,0);
 const impact=await library.impact({libraryId:'shared/lia',version:1});assert.equal(impact.stories[0].shots.length,1);
});

test('completed asset upload stores account-local provider ID and hash without crossing accounts',async t=>{
 const {a,studio,library}=await fixture(t);
 const p=await library.propose({libraryId:'shared/lia',kind:'character',name:'Lia',description:'Lia de casaco',referencePaths:[a]});
 await library.decide({libraryId:'shared/lia',version:1,expectedFingerprint:p.fingerprint,decision:'approve'});
 const guide=new StoryGuide(studio);
 await guide.create({id:'bindtest',title:'Bind',storyText:'Lia chegou.'});
 await guide.submitCast('bindtest',{visualStyle:'2D',characters:[{id:'lia',name:'Lia',sourceExcerpt:'Lia chegou.',designPrompt:'Lia de casaco',libraryId:'shared/lia',libraryVersion:1}],locations:[],assumptions:[]});
 await guide.submitStoryboard('bindtest',{scenes:[{id:'s',title:'S',sourceExcerpt:'Lia chegou.',shots:[{id:'sh',sourceExcerpt:'Lia chegou.',visualPrompt:'Lia',motionPrompt:'Caminha',durationSeconds:6,characterIds:['lia']}]}]});
 await guide.approve('bindtest');
 await studio.registerAccount({id:'accountA',label:'A',provider:'google-flow',authorized:true,creditEstimate:100,upstreamId:'mcpA'});
 await studio.registerAccount({id:'accountB',label:'B',provider:'google-flow',authorized:true,creditEstimate:100,upstreamId:'mcpB'});
 const pkg=await guide.prepare({storyId:'bindtest',accountId:'accountA',videoEstimatedCredits:20});
 await studio.bindAccountProject({projectId:pkg.productionId,accountId:'accountA',remoteProjectId:'project-A'});
 await studio.bindAccountProject({projectId:pkg.productionId,accountId:'accountB',remoteProjectId:'project-B'});
 const {WorkflowStudio}=await import('../src/workflows.mjs');const workflows=new WorkflowStudio(studio);
 const w=await workflows.get(pkg.workflowId),upload=w.spec.steps.find(x=>x.operation==='asset.upload');
 await workflows.approve(pkg.workflowId,upload.id,true);
 await workflows.claim(pkg.workflowId,upload.id);
 await workflows.mark(pkg.workflowId,upload.id,'submitted',{externalJobId:'operation-A'});
 await workflows.mark(pkg.workflowId,upload.id,'completed',{output:{providerAssetId:'asset-A'},evidence:'Operador conferiu o upload em Flow'});
 const state=await studio.store.read();const local=state.bindings[`${pkg.productionId}::accountA`];
 assert.equal(local.assets[upload.inputs.assetId],'asset-A');
 assert.equal(local.assetHashes[upload.inputs.assetId],state.projects[pkg.productionId].manifest.assets[0].sha256);
 assert.equal(state.bindings[`${pkg.productionId}::accountB`].assets[upload.inputs.assetId],undefined);
});

test('compilation rejects an unpinned global library identity instead of selecting a newer version silently',async t=>{
 const {a,studio,library}=await fixture(t);
 const p=await library.propose({libraryId:'shared/lia',kind:'character',name:'Lia',description:'Lia de casaco',referencePaths:[a]});
 await library.decide({libraryId:'shared/lia',version:1,expectedFingerprint:p.fingerprint,decision:'approve'});
 const guide=new StoryGuide(studio);
 await guide.create({id:'unpin',title:'Sem pin',storyText:'Lia acena.'});
 await guide.submitCast('unpin',{visualStyle:'2D',characters:[{id:'lia',name:'Lia',sourceExcerpt:'Lia acena.',designPrompt:'Lia de casaco',libraryId:'shared/lia'}],locations:[],assumptions:[]});
 await guide.submitStoryboard('unpin',{scenes:[{id:'sc',title:'Cena',sourceExcerpt:'Lia acena.',shots:[{id:'shot',sourceExcerpt:'Lia acena.',visualPrompt:'Lia',motionPrompt:'Aceno',durationSeconds:5,characterIds:['lia']}]}]});
 await guide.approve('unpin');await studio.registerAccount({id:'flow',label:'Conta',provider:'google-flow',authorized:true,creditEstimate:60});
 await assert.rejects(guide.prepare({storyId:'unpin',accountId:'flow',videoEstimatedCredits:20}),/pin libraryVersion/);
});
