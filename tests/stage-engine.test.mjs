import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Studio } from '../src/core.mjs';
import { StoryGuide } from '../src/story-guide.mjs';
import { StageEngine, STAGES } from '../src/application/guide/stage-engine.mjs';

const narrative='Lia abre a porta da oficina. A cidade desapareceu. Ela olha para o relógio parado.';
const cast={visualStyle:'Animação 2D minimalista, preto e branco, sem alterar a história.',characters:[{id:'lia',name:'Lia',sourceExcerpt:'Lia abre a porta da oficina.',designPrompt:'Lia com cabelo curto e casaco preto'}],locations:[{id:'oficina',name:'Oficina',sourceExcerpt:'a porta da oficina',designPrompt:'Oficina com relógio analógico'}],assumptions:['Cabelo e casaco são hipóteses criativas']};
const board={scenes:[{id:'cena1',title:'A oficina',sourceExcerpt:'Lia abre a porta da oficina. A cidade desapareceu. Ela olha para o relógio parado.',locationId:'oficina',shots:[{id:'plano1',sourceExcerpt:'Lia abre a porta da oficina.',visualPrompt:'Lia diante da porta',motionPrompt:'Movimento lento da porta',durationSeconds:6,characterIds:['lia']}]}]};
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vpm-stage-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const studio=new Studio(path.join(root,'.studio'));
 const story=new StoryGuide(studio);const engine=new StageEngine(studio);
 await story.create({id:'episodio',title:'O silêncio',storyText:narrative});
 return {root,studio,story,engine};
}
const statusBy=(view,id)=>view.stages.find(s=>s.id===id);

test('story-only intake exposes exactly one meaningful next action and honest 10-stage projection',async t=>{
 const {engine}=await fixture(t);
 const s=await engine.status('episodio');
 assert.equal(s.nextAction.type,'SUBMIT_CAST');assert.equal(s.pendingActions.length,0);
 assert.deepEqual(s.stages.map(x=>x.id),STAGES);assert.equal(s.progress.completedStages,1);
 assert.equal(statusBy(s,'VIDEOS').status,'PENDING');assert.equal(statusBy(s,'DELIVERY').status,'PENDING');
 assert.equal(s.estimatedCredits.verified,false);
 const events=await engine.events('episodio',{cursor:0});
 assert.equal(events.nextCursor,s.eventsCursor);assert.equal(events.hasMore,false);
 const repeated=await engine.status('episodio');assert.equal(repeated.eventsCursor,s.eventsCursor,'repeated polls must not manufacture events');
});

test('agent can submit cast/storyboard but only operator CLI decision approves, using revision compare-and-swap',async t=>{
 const {story,engine}=await fixture(t);
 await story.submitCast('episodio',cast);
 let s=await engine.status('episodio');assert.equal(s.nextAction.type,'SUBMIT_STORYBOARD');
 await story.submitStoryboard('episodio',board);
 s=await engine.status('episodio');assert.equal(s.nextAction.type,'APPROVE_EDITORIAL');assert.equal(s.nextAction.requiresHuman,true);
 assert.equal(statusBy(s,'DIRECTING').status,'DRAFT_READY');
 assert.equal(statusBy(s,'STORYBOARD').status,'AWAITING_APPROVAL');
 await assert.rejects(engine.operatorDecision('episodio',{decision:'approve',expectedReviewVersion:'0'.repeat(64)}),/STALE_REVIEW/);
 const a=await engine.operatorDecision('episodio',{decision:'approve',expectedReviewVersion:s.reviewVersion,note:'Conferido com o roteiro'});
 assert(a.approvedAt);
 s=await engine.status('episodio');assert.equal(s.nextAction.type,'REGISTER_ACCOUNT');
 assert.equal(statusBy(s,'DIRECTING').status,'COMPLETED');assert.equal(statusBy(s,'STORYBOARD').status,'COMPLETED');
 assert.equal(s.progress.completedStages,4);
 assert.equal(statusBy(s,'DELIVERY').status,'PENDING');
});

test('request_changes blocks approval of identical draft and re-submission restores the gate',async t=>{
 const {story,engine}=await fixture(t);await story.submitCast('episodio',cast);await story.submitStoryboard('episodio',board);
 const original=await engine.status('episodio');
 const reject=await engine.operatorDecision('episodio',{decision:'request_changes',expectedReviewVersion:original.reviewVersion,note:'Ajustar enquadramento'});
 assert.equal(reject.decision,'request_changes');
 let s=await engine.status('episodio');assert.equal(s.nextAction.type,'REVISE_STORYBOARD');
 assert.equal(statusBy(s,'STORYBOARD').status,'BLOCKED');
 await assert.rejects(story.approve('episodio'),/Rejected draft must change/);
 await assert.rejects(engine.operatorDecision('episodio',{decision:'approve',expectedReviewVersion:original.reviewVersion}),/Rejected draft must change/);
 await story.submitStoryboard('episodio',{scenes:[{...board.scenes[0],shots:[{...board.scenes[0].shots[0],camera:'plano geral'}]}]});
 s=await engine.status('episodio');assert.equal(s.nextAction.type,'APPROVE_EDITORIAL');assert.notEqual(s.reviewVersion,original.reviewVersion);
 await engine.operatorDecision('episodio',{decision:'approve',expectedReviewVersion:s.reviewVersion});
 assert.equal((await engine.status('episodio')).progress.completedStages,4);
});

test('restart and agent switch recover the same next action, event cursor and operator decision without duplicate alerts',async t=>{
 const {studio,story,engine}=await fixture(t);
 await story.submitCast('episodio',cast);await story.submitStoryboard('episodio',board);
 const prior=await engine.status('episodio');
 const second=new StageEngine(new Studio(studio.store.home));
 const resumed=await second.next('episodio');assert.equal(resumed.nextAction.key,prior.nextAction.key);
 assert.equal(resumed.eventsCursor,prior.eventsCursor);
 const none=await second.events('episodio',{cursor:prior.eventsCursor});assert.equal(none.events.length,0);
 const approval=await second.operatorDecision('episodio',{decision:'approve',expectedReviewVersion:prior.reviewVersion});
 const after=await engine.events('episodio',{cursor:prior.eventsCursor,limit:2});
 assert(after.events.some(e=>e.type==='editorial_decision'));assert.equal(after.hasMore,true);
 const remaining=await engine.events('episodio',{cursor:after.nextCursor});
 assert(remaining.events.some(e=>e.type==='next_action_changed'));
 const history=await engine.events('episodio',{cursor:0,limit:100});
 assert(history.events.some(e=>e.type==='editorial_decision'&&e.reviewVersion===approval.reviewVersion));
});

test('source corruption blocks every stage projection instead of inventing completion',async t=>{
 const {studio,engine}=await fixture(t);
 await fs.writeFile(path.join(studio.store.home,'stories','episodio','source.md'),'adulterated');
 await assert.rejects(engine.status('episodio'),/integrity/);
});

test('prepared plan tracks remote-reported steps without ever declaring verified video or MP4',async t=>{
 const {studio,story,engine}=await fixture(t);
 await story.submitCast('episodio',cast);await story.submitStoryboard('episodio',board);await story.approve('episodio');
 await studio.registerAccount({id:'g1',provider:'google-flow',label:'Conta de teste',authorized:true,creditEstimate:200,upstreamId:'flow-mcp'});
 const prepared=await story.prepare({storyId:'episodio',accountId:'g1',videoEstimatedCredits:20});
 const first=await engine.status('episodio');assert.equal(first.nextAction.type,'BIND_REMOTE_PROJECT');
 // The plan can be marked as provider-reported complete, but the stage never claims media verified.
 await studio.bindAccountProject({projectId:prepared.productionId,accountId:'g1',remoteProjectId:'remote-project-1'});
 await studio.store.mutate(state=>{
  const w=state.workflows[prepared.workflowId];
  for(const step of w.spec.steps){w.steps[step.id].status='completed';w.steps[step.id].output={providerAssetId:'simulated-remote-asset'};}
 });
 const s=await engine.status('episodio');
 assert.equal(s.nextAction.type,'VERIFY_RESULTS');
 assert.equal(statusBy(s,'VIDEOS').status,'AWAITING_VERIFICATION');
 assert.equal(statusBy(s,'SHOT_IMAGES').status,'AWAITING_VERIFICATION');
 assert.equal(statusBy(s,'REVIEW').status,'PENDING');
 assert.equal(statusBy(s,'DELIVERY').status,'PENDING');
 assert.equal(s.progress.completedStages,4);
});

test('uncertain paid submission blocks retries and exposes one reconciliation action',async t=>{
 const {studio,story,engine}=await fixture(t);
 await story.submitCast('episodio',cast);await story.submitStoryboard('episodio',board);await story.approve('episodio');
 await studio.registerAccount({id:'g1',provider:'google-flow',label:'Conta de teste',authorized:true,creditEstimate:200,upstreamId:'bridge'});
 const prepared=await story.prepare({storyId:'episodio',accountId:'g1',videoEstimatedCredits:20});
 await studio.bindAccountProject({projectId:prepared.productionId,accountId:'g1',remoteProjectId:'provider-project'});
 await studio.store.mutate(state=>{const w=state.workflows[prepared.workflowId];w.steps[w.spec.order[0]].status='submission_unknown';});
 const s=await engine.status('episodio');assert.equal(s.nextAction.type,'RECONCILE_SUBMISSION');assert.equal(s.nextAction.requiresHuman,true);assert.equal(s.blockers[0].code,'SUBMISSION_UNKNOWN');
});

test('cursor pagination and invalid cursor errors are stable',async t=>{
 const {engine}=await fixture(t);const s=await engine.status('episodio');
 const a=await engine.events('episodio',{cursor:0,limit:2});assert.equal(a.events.length,2);assert.equal(a.hasMore,true);
 const b=await engine.events('episodio',{cursor:a.nextCursor,limit:100});assert.equal(b.hasMore,false);assert.equal(b.nextCursor,s.eventsCursor);
 await assert.rejects(engine.events('episodio',{cursor:-1}),/cursor/);
 await assert.rejects(engine.events('episodio',{cursor:s.eventsCursor+1}),/greater than/);
});
