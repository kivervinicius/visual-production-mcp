/**
 * Durable guided-production stage projections. Readiness is evidence-derived:
 * an upstream's reported completion is NOT validated local media or delivery.
 * No paid provider calls or editorial approvals are exposed by this module's MCP facade.
 */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';

const SHA = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const checkId = value => { assert(typeof value === 'string' && ID.test(value) && !['.','..','__proto__','prototype','constructor'].includes(value), 'Invalid storyId'); return value; };

export const STAGES = Object.freeze([
  'STORY', 'DIRECTING', 'BIBLE', 'STORYBOARD', 'REFERENCES',
  'SHOT_IMAGES', 'VIDEOS', 'REVIEW', 'AUDIO_EDIT', 'DELIVERY'
]);
const MAX_EVENTS = 1000;
const ACTION_TYPES = Object.freeze({
  SUBMIT_CAST: 'studio_story_submit_cast',
  SUBMIT_STORYBOARD: 'studio_story_submit_storyboard',
  PREPARE_PRODUCTION: 'studio_story_prepare',
  REVIEW_WORKFLOW: 'studio_workflow_plan',
  CONFIGURE_UPSTREAM: 'studio_discover_upstream',
  BIND_REMOTE_PROJECT: 'studio_bind_project',
  INSPECT_STEP: 'studio_workflow_inspect_step',
  CHECK_PROVIDER: 'studio_workflow_status',
  VERIFY_RESULTS: 'studio_workflow_status'
});

function revision(story) {
  if (!story.cast || !story.storyboard) return null;
  return SHA(JSON.stringify({ sourceSha256: story.sha256, cast: story.cast, storyboard: story.storyboard }));
}
function event(guide, type, payload) {
  guide.cursor++;
  guide.events.push({ seq: guide.cursor, type, at: now(), ...payload });
  if (guide.events.length > MAX_EVENTS) guide.events.splice(0, guide.events.length - MAX_EVENTS);
}
function nextAction(story, state, guide, workflow, reviewVersion) {
  let action;
  if (!story.cast) action = { type: 'SUBMIT_CAST', stage: 'DIRECTING', instruction: 'Leia a história integral e registre visualStyle, personagens e locais ancorados em trechos literais.', requiresHuman: false };
  else if (!story.storyboard) action = { type: 'SUBMIT_STORYBOARD', stage: 'STORYBOARD', instruction: 'Monte cenas e planos com sourceExcerpt literal, duração, quadro e movimento.', requiresHuman: false };
  else if (guide.review?.decision === 'request_changes' && guide.review.revision === reviewVersion) {
    action = { type: 'REVISE_STORYBOARD', stage: 'STORYBOARD', tool: 'studio_story_submit_storyboard', instruction: 'O operador solicitou alterações. Revise o storyboard; reenviar o mesmo conteúdo não resolve o bloqueio.', requiresHuman: false, note: guide.review.note || null };
  } else if (!story.approvedAt) {
    action = { type: 'APPROVE_EDITORIAL', stage: 'STORYBOARD', instruction: 'Revisar a bíblia visual, hipóteses e cobertura narrativa antes de aprovar.', requiresHuman: true,
      command: `npm run operator -- production-decision ${story.id} approve ${reviewVersion}` };
  } else if (!story.prepared) {
    const accounts = Object.values(state.accounts || {}).filter(a => a.authorized && a.enabled && a.provider === 'google-flow');
    action = accounts.length
      ? { type: 'PREPARE_PRODUCTION', stage: 'REFERENCES', instruction: 'Compile os manifestos com a estimativa de créditos informada pelo operador; nenhum gasto nesta fase.', requiresHuman: false }
      : { type: 'REGISTER_ACCOUNT', stage: 'REFERENCES', instruction: 'Cadastre uma conta Flow autorizada, sem fornecer senhas ou cookies. Não pressupor saldo real.', requiresHuman: true, tool: 'studio_register_account' };
  } else if (!workflow) {
    action = { type: 'REPAIR_LOCAL_WORKFLOW', stage: 'REFERENCES', instruction: 'Pacote preparado sem registro do workflow. Não gere novamente; confira os arquivos e recupere o vínculo.', requiresHuman: true };
  } else {
    const account = state.accounts?.[story.prepared.accountId];
    const binding = state.bindings?.[`${story.prepared.productionId}::${story.prepared.accountId}`];
    const steps = workflow.spec.order.map(id => ({ spec: workflow.spec.steps.find(x => x.id === id), state: workflow.steps[id] }));
    const unknown = steps.find(x => x.state?.status === 'submission_unknown');
    const running = steps.find(x => ['submitting','submitted'].includes(x.state?.status));
    const uncompleted = steps.find(x => x.state?.status !== 'completed');
    const stageOf = x => x?.spec?.id?.startsWith('frame-') ? 'SHOT_IMAGES' : x?.spec?.id?.startsWith('video-') || x?.spec?.id?.startsWith('scene-') ? 'VIDEOS' : 'REFERENCES';
    if (unknown) action = { type: 'RECONCILE_SUBMISSION', stage: stageOf(unknown), stepId: unknown.spec.id, instruction: 'Resultado possivelmente cobrado: conferir histórico do provedor. Não repetir a geração automaticamente.', requiresHuman: true, command: `npm run operator -- workflow-reconcile ${workflow.spec.id} ${unknown.spec.id} <externalJobId-verificado>` };
    else if (running) action = { type: 'CHECK_PROVIDER', stage: stageOf(running), stepId: running.spec.id, instruction: 'Verifique o andamento pelo ID original e recupere o arquivo, sem submeter um novo job.', requiresHuman: false, tool: 'studio_workflow_status' };
    else if (!account?.upstreamId) action = { type: 'CONFIGURE_UPSTREAM', stage: 'REFERENCES', instruction: 'Conecte e inspecione um MCP real para a conta; as 23 operações documentadas não equivalem a drivers instalados.', requiresHuman: true };
    else if (!binding) action = { type: 'BIND_REMOTE_PROJECT', stage: 'REFERENCES', instruction: 'Vincule o projeto remoto desta conta e valide a identidade da sessão antes de gerar mídia.', requiresHuman: true, tool: 'studio_bind_project' };
    else if (uncompleted) {
      const blockedBy = uncompleted.spec.dependsOn.filter(id => workflow.steps[id]?.status !== 'completed');
      if (blockedBy.length) action = { type: 'RESOLVE_DEPENDENCIES', stage: stageOf(uncompleted), stepId: uncompleted.spec.id, blockedBy, instruction: 'Dependências do plano ainda não estão concluídas ou verificadas; consulte studio_workflow_plan.', requiresHuman: false, tool: 'studio_workflow_plan' };
      else if (uncompleted.state?.status === 'planned') action = { type: 'REVIEW_WORKFLOW', stage: stageOf(uncompleted), stepId: uncompleted.spec.id, instruction: 'Inspecione as capacidades reais e solicite aprovação de gasto por etapa no CLI do operador, se aplicável.', requiresHuman: true, tool: 'studio_workflow_inspect_step',
        command: `npm run operator -- workflow-approve ${workflow.spec.id} ${uncompleted.spec.id}` };
      else if (uncompleted.state?.status === 'approved') action = { type: 'INSPECT_STEP', stage: stageOf(uncompleted), stepId: uncompleted.spec.id, instruction: 'Faça preflight do schema e execute somente o step já aprovado; não altere o modo de geração silenciosamente.', requiresHuman: false, tool: 'studio_workflow_inspect_step' };
      else action = { type: 'RESOLVE_STEP', stage: stageOf(uncompleted), stepId: uncompleted.spec.id, state: uncompleted.state?.status || 'missing', instruction: 'Trate explicitamente o estado da etapa antes de continuar.', requiresHuman: true };
    } else action = { type: 'VERIFY_RESULTS', stage: 'REVIEW', instruction: 'Todas as etapas remotas foram declaradas concluídas, mas isso ainda não comprova downloads íntegros, QC editorial, áudio, montagem ou MP4 final.', requiresHuman: true, tool: 'studio_workflow_status' };
  }
  action.tool ??= ACTION_TYPES[action.type] || null;
  action.key = SHA(JSON.stringify({storyId: story.id, revision: reviewVersion, type: action.type, stage: action.stage, stepId: action.stepId || null, blockedBy: action.blockedBy || null})).slice(0,20);
  return action;
}
function statusForGroup(workflow, predicate, editable) {
  if (!workflow) return { status: 'PENDING', evidence: 'NO_WORKFLOW', total: 0, providerReported: 0 };
  const steps = workflow.spec.steps.filter(predicate);
  if (!steps.length) return { status: 'NOT_APPLICABLE', evidence: 'NO_RELEVANT_STEPS', total: 0, providerReported: 0 };
  const states = steps.map(s => workflow.steps[s.id]?.status || 'missing');
  const done = states.filter(s => s === 'completed').length;
  let status = 'PENDING';
  if (states.includes('submission_unknown')) status = 'BLOCKED';
  else if (states.includes('submitting') || states.includes('submitted')) status = 'IN_PROGRESS';
  else if (done === steps.length) status = 'AWAITING_VERIFICATION';
  else if (states.some(s => s !== 'planned')) status = 'IN_PROGRESS';
  else if (editable) status = 'IN_PROGRESS';
  return { status, evidence: done > 0 ? 'PROVIDER_REPORTED_ONLY' : 'NOT_VERIFIED', total: steps.length, providerReported: done };
}
function projections(story, state, guide, workflow) {
  const hasCast = !!story.cast, hasBoard = !!story.storyboard, approved = !!story.approvedAt;
  const result = [
    { id:'STORY', status:'COMPLETED', evidence:'SOURCE_SHA256_VERIFIED' },
    { id:'DIRECTING', status:!hasCast?'IN_PROGRESS':approved?'COMPLETED':'DRAFT_READY', evidence:approved?'EDITORIAL_APPROVED':hasCast?'DRAFT_ONLY':'NOT_SUBMITTED' },
    { id:'BIBLE', status:!hasCast?'PENDING':approved?'COMPLETED':'DRAFT_READY', evidence:approved?'EDITORIAL_APPROVED':hasCast?'DRAFT_ONLY':'NOT_SUBMITTED' },
    { id:'STORYBOARD', status:!hasBoard?hasCast?'IN_PROGRESS':'PENDING':approved?'COMPLETED':guide.review?.decision === 'request_changes' && guide.review.revision === revision(story)?'BLOCKED':'AWAITING_APPROVAL', evidence:approved?'EDITORIAL_APPROVED':hasBoard?'DRAFT_ONLY':'NOT_SUBMITTED' },
  ];
  if (!approved) return [...result, ...STAGES.slice(4).map(id => ({id,status:'PENDING',evidence:'PRIOR_EDITIORIAL_APPROVAL_REQUIRED'}))];
  if (!story.prepared) return [...result, { id:'REFERENCES',status:'IN_PROGRESS',evidence:'PACKAGE_NOT_PREPARED' }, ...STAGES.slice(5).map(id=>({id,status:'PENDING',evidence:'PACKAGE_NOT_PREPARED'}))];
  const groups=[
    {id:'REFERENCES',filter:s=>s.id.startsWith('character-image-')||s.id.startsWith('location-image-')||s.id.startsWith('character-register-')},
    {id:'SHOT_IMAGES',filter:s=>s.id.startsWith('frame-')},
    {id:'VIDEOS',filter:s=>s.id.startsWith('video-')||s.id.startsWith('scene-')}
  ];
  for(const group of groups)result.push({id:group.id,...statusForGroup(workflow,group.filter,!!workflow)});
  for(const id of ['REVIEW','AUDIO_EDIT','DELIVERY'])result.push({id,status:'PENDING',evidence:'NOT_IMPLEMENTED_OR_VERIFIED'});
  return result;
}
function visualContinuity(story,state) {
  const required=[...(story.cast?.characters||[]).map(c=>({kind:'character',libraryId:c.libraryId||`${story.id}/${c.id}`,version:c.libraryVersion||null})),
    ...(story.cast?.locations||[]).map(l=>({kind:'location',libraryId:l.libraryId||`${story.id}/${l.id}`,version:l.libraryVersion||null})),
    ...(story.cast?.styleLibraryId?[{kind:'style',libraryId:story.cast.styleLibraryId,version:null}]:[])];
  const entries=required.map(x=>{
    const item=state.visualLibrary?.entities?.[x.libraryId];
    const versions=Object.values(item?.versions||{});
    const rev=x.version?versions.find(v=>v.version===x.version):versions.filter(v=>v.status==='approved').sort((a,b)=>b.version-a.version)[0];
    const status=!rev?'NOT_REGISTERED':rev.status!=='approved'?'UNAPPROVED':x.kind!=='style'&&!rev.references.length?'NO_REFERENCE':'APPROVED_LOCALLY';
    return {...x,version:rev?.version||x.version,status,referenceCount:rev?.references?.length||0};
  });
  return {required:entries.length,locallyApproved:entries.filter(x=>x.status==='APPROVED_LOCALLY').length,items:entries,
    note:'Local approval is separate from Flow upload, actual identity consistency and the editorial approval of each shot.'};
}
function stateView(story, state, guide) {
  const workflow = story.prepared && state.workflows?.[story.prepared.workflowId];
  const reviewVersion = revision(story);
  const stages = projections(story,state,guide,workflow);
  const next = nextAction(story,state,guide,workflow,reviewVersion);
  const completedStages = stages.filter(s=>s.status==='COMPLETED').length;
  return { schemaVersion:1,storyId:story.id,title:story.title,sourceSha256:story.sha256,reviewVersion,workflowId:story.prepared?.workflowId||null,
    stage:next.stage,stages,nextAction:next,visualContinuity:visualContinuity(story,state),progress:{completedStages,totalStages:STAGES.length},
    pendingActions:next.requiresHuman?[next]:[], blockers:next.type==='RECONCILE_SUBMISSION'?[{code:'SUBMISSION_UNKNOWN',stepId:next.stepId}]:[],
    estimatedCredits:{value:null,verified:false}, eventsCursor:guide.cursor };
}
export class StageEngine {
  constructor(studio) { this.studio=studio; }
  async status(storyId) {
    checkId(storyId);
    return this.studio.store.mutate(async state=>{
      const story=state.stories?.[storyId];assert(story,'Story not found');
      const source=await fs.readFile(path.join(this.studio.store.home,story.sourcePath),'utf8');
      assert(SHA(source)===story.sha256,'Story source integrity check failed');
      state.productionGuides??={};
      let guide=state.productionGuides[storyId];
      if(!guide){guide={schemaVersion:1,storyId,sourceSha256:story.sha256,cursor:0,events:[],stageSnapshot:{},actionKey:null,review:null};state.productionGuides[storyId]=guide;}
      assert(guide.sourceSha256===story.sha256,'Guide source revision mismatch');
      const view=stateView(story,state,guide);
      for(const stage of view.stages){
        const signature=JSON.stringify({status:stage.status,evidence:stage.evidence,providerReported:stage.providerReported||0});
        if(guide.stageSnapshot[stage.id]!==signature){event(guide,'stage_changed',{stage:stage.id,status:stage.status,evidence:stage.evidence});guide.stageSnapshot[stage.id]=signature;}
      }
      if(guide.actionKey!==view.nextAction.key){guide.actionKey=view.nextAction.key;event(guide,'next_action_changed',{stage:view.nextAction.stage,action: view.nextAction.type,actionKey:view.nextAction.key,requiresHuman:view.nextAction.requiresHuman});}
      view.eventsCursor=guide.cursor;
      return view;
    });
  }
  async next(storyId) { const s=await this.status(storyId);return {storyId:s.storyId,stage:s.stage,nextAction:s.nextAction,pendingActions:s.pendingActions,eventsCursor:s.eventsCursor}; }
  async events(storyId,{cursor=0,limit=50}={}) {
    assert(Number.isSafeInteger(cursor)&&cursor>=0,'cursor must be a nonnegative integer');
    assert(Number.isSafeInteger(limit)&&limit>=1&&limit<=100,'limit must be between 1 and 100');
    await this.status(storyId);
    const state=await this.studio.store.read();const guide=state.productionGuides?.[checkId(storyId)];assert(guide,'Story guide missing');
    const minimum=guide.events.length?guide.events[0].seq-1:guide.cursor;
    assert(cursor>=minimum,`EVENT_CURSOR_EXPIRED: oldest available cursor is ${minimum}; refresh status`);
    assert(cursor<=guide.cursor,'cursor cannot be greater than latest cursor');
    const events=guide.events.filter(e=>e.seq>cursor).slice(0,limit);
    return {storyId,cursor,events,nextCursor:events.length?events.at(-1).seq:cursor,hasMore:guide.events.some(e=>e.seq>(events.length?events.at(-1).seq:cursor)),latestCursor:guide.cursor};
  }
  /** Operator-only CLI. Never register this action as an MCP tool. */
  async operatorDecision(storyId,{decision,expectedReviewVersion,note=''}) {
    checkId(storyId);
    assert(['approve','request_changes'].includes(decision),'decision must be approve or request_changes');
    assert(typeof expectedReviewVersion==='string' && /^[a-f0-9]{64}$/.test(expectedReviewVersion),'expectedReviewVersion SHA-256 required');
    assert(typeof note==='string'&&note.length<=2000,'note must be at most 2000 characters');
    return this.studio.store.mutate(async state=>{
      const story=state.stories?.[storyId];assert(story?.cast&&story.storyboard,'Cast and storyboard are required for an editorial decision');
      const source=await fs.readFile(path.join(this.studio.store.home,story.sourcePath),'utf8');
      assert(SHA(source)===story.sha256,'Story source integrity check failed');
      const actual=revision(story);assert(expectedReviewVersion===actual,'STALE_REVIEW: cast or storyboard changed; fetch current status and review again');
      assert(!story.approvedAt,'Editorial approval already frozen; create a new story revision');
      state.productionGuides??={};
      const guide=state.productionGuides[storyId]??={schemaVersion:1,storyId,sourceSha256:story.sha256,cursor:0,events:[],stageSnapshot:{},actionKey:null,review:null};
      assert(guide.sourceSha256===story.sha256,'Guide source revision mismatch');
      if(decision==='approve'){
        assert(!(guide.review?.decision==='request_changes'&&guide.review.revision===actual),'Rejected draft must change before approval');
        story.approvedAt=now();
      }
      else if(guide.review?.decision==='request_changes'&&guide.review.revision===actual)
        throw new Error('Changes already requested for this exact revision');
      guide.review={decision,revision:actual,note,at:now(),actor:'local-operator'};
      event(guide,'editorial_decision',{stage:'STORYBOARD',decision,reviewVersion:actual,actor:'local-operator',note});
      return {storyId,decision,reviewVersion:actual,approvedAt:story.approvedAt||null,cursor:guide.cursor};
    });
  }
}
