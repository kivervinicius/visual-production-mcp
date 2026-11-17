import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { FLOW_OPERATIONS } from './flow-operations.mjs';

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const VALID_STATES = new Set(['planned', 'approved', 'submitting', 'submitted', 'submission_unknown', 'completed', 'failed']);
const RESERVED = new Set(['approved', 'submitting', 'submitted', 'submission_unknown', 'completed']);
const BUSY = new Set(['submitting', 'submitted', 'submission_unknown']);
function assert(ok, reason) { if (!ok) throw new Error(reason); }
function validId(s, field) { assert(typeof s === 'string' && ID.test(s) && !['__proto__','constructor','prototype'].includes(s), `${field}: invalid identifier`); return s; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function array(v) { return Array.isArray(v) ? v : []; }
function checkSensitive(value) {
  if (Array.isArray(value)) return value.forEach(checkSensitive);
  if (!obj(value)) return;
  for (const [k,v] of Object.entries(value)) {
    assert(!/(password|cookie|credential|access.?token|refresh.?token|api.?key|authorization|totp|otp|session.?secret)/i.test(k), `Secrets are forbidden in workflow inputs: ${k}`);
    checkSensitive(v);
  }
}
function refsFrom(v, result = []) {
  if (typeof v === 'string' && /^(asset|step):/.test(v)) result.push(v);
  else if (Array.isArray(v)) for (const x of v) refsFrom(x,result);
  else if (obj(v)) for (const x of Object.values(v)) refsFrom(x,result);
  return result;
}
function sortDAG(steps) {
  const byId = new Map(steps.map(s=>[s.id,s]));
  const done = new Set(), active = new Set(), ordered=[];
  const visit = id => {
    assert(byId.has(id), `Dependency does not exist: ${id}`);
    assert(!active.has(id), `Cycle detected at ${id}`);
    if (done.has(id)) return;
    active.add(id);
    for (const d of byId.get(id).dependsOn) visit(d);
    active.delete(id); done.add(id); ordered.push(id);
  };
  for (const s of steps) visit(s.id);
  return ordered;
}

export function validateWorkflow(input, state) {
  assert(obj(input) && input.schemaVersion === 1, 'Workflow schemaVersion must be 1');
  validId(input.id, 'workflow.id'); validId(input.projectId, 'workflow.projectId');
  const project = state.projects[input.projectId]?.manifest;
  assert(project, `Canonical project not imported: ${input.projectId}`);
  assert(Array.isArray(input.steps) && input.steps.length > 0 && input.steps.length <= 250, 'steps: expected 1..250 entries');
  const seen=new Set();
  const steps = input.steps.map((s,i)=>{
    assert(obj(s),'step must be an object');validId(s.id,'step.id');assert(!seen.has(s.id),`Duplicate step ${s.id}`);seen.add(s.id);
    assert(typeof s.operation==='string' && FLOW_OPERATIONS[s.operation],`Unsupported Flow operation: ${s.operation}`);
    const spec=FLOW_OPERATIONS[s.operation];
    assert(obj(s.inputs), `${s.id}: inputs must be an object`);
    checkSensitive(s.inputs);
    for (const field of spec.required) assert(s.inputs[field]!==undefined && s.inputs[field]!==null && s.inputs[field]!=='' && (!Array.isArray(s.inputs[field]) || s.inputs[field].length>0), `${s.id}: missing ${field}`);
    for (const f of ['prompt','title']) if(s.inputs[f]!==undefined) assert(typeof s.inputs[f]==='string' && s.inputs[f].trim().length>0 && s.inputs[f].length<=20000,`${s.id}: ${f} must be a nonempty string`);
    const accountId=validId(s.accountId||input.accountId,`${s.id}.accountId`);
    const account=state.accounts[accountId];
    assert(account && account.provider==='google-flow' && account.authorized && account.enabled, `${s.id}: account must be an authorized enabled Google Flow session`);
    const credits = s.estimatedCredits;
    assert(Number.isInteger(credits) && credits>=0 && (spec.credit!=='metered'||credits>0),`${s.id}: estimatedCredits must be ${spec.credit==='metered'?'positive':'nonnegative'} integer (manual quote)`);
    const deps=array(s.dependsOn);
    assert(new Set(deps).size===deps.length,`${s.id}: duplicate dependency`);
    deps.forEach(d=>validId(d,`${s.id}.dependsOn`));
    if(s.operation.startsWith('video.')){
      if(s.inputs.aspectRatio!==undefined)assert(['16:9','9:16'].includes(s.inputs.aspectRatio),`${s.id}: Flow video ratio invalid`);
      if(s.inputs.durationSeconds!==undefined)assert(Number.isInteger(s.inputs.durationSeconds)&&s.inputs.durationSeconds>=1&&s.inputs.durationSeconds<=15,`${s.id}: duration outside documented Flow range`);
    }
    if (['character.create','character.update'].includes(s.operation)) assert(project.characters.some(c=>c.id===s.inputs.characterId),`${s.id}: unknown canonical character`);
    if (s.operation==='asset.upload') assert(project.assets.some(a=>a.id===s.inputs.assetId),`${s.id}: unknown canonical asset`);
    const references=refsFrom(s.inputs);
    for (const ref of references) {
      const [kind,name]=ref.split(':');validId(name,`${s.id} reference`);
      if (kind==='asset') assert(project.assets.some(a=>a.id===name),`${s.id}: unknown asset ${name}`);
      if (kind==='step') assert(deps.includes(name),`${s.id}: add ${name} to dependsOn to reference its output`);
    }
    return { id:s.id, accountId, operation:s.operation, estimatedCredits:credits,
      inputs:structuredClone(s.inputs),dependsOn:deps, order:i };
  });
  const order=sortDAG(steps);
  return { schemaVersion:1,id:input.id,projectId:input.projectId,title:input.title||input.id,
    steps,order };
}

function reservedCredits(state,accountId,exceptWorkflow,exceptStep) {
  let amount=0;
  const account=state.accounts[accountId];
  for(const job of Object.values(state.jobs||{}))
    if(job.accountId===accountId && job.createdAt>=account.creditRecordedAt && !['failed','cancelled'].includes(job.status)) amount+=job.estimatedCredits;
  for(const w of Object.values(state.workflows||{}))
    for(const s of w.spec.steps){
      if(s.accountId!==accountId || (w.spec.id===exceptWorkflow && s.id===exceptStep))continue;
      if(RESERVED.has(w.steps[s.id].status) && w.steps[s.id].approvedAt>=account.creditRecordedAt)amount+=s.estimatedCredits;
    }
  return amount;
}

function bindingNeeds(state,step,projectId,workflow) {
  const binding=state.bindings[`${projectId}::${step.accountId}`];
  if(step.operation==='project.create')return { missing:[],remoteProjectId:null };
  const manifest=state.projects[projectId].manifest;
  const missing=[];
  for(const dependency of step.dependsOn) {
    // The output of one account's Flow project has no meaning in another account's project.
    // A portable output must first be exported, imported as a canonical asset and rebound.
    const depStep=workflow?.spec.steps.find(s=>s.id===dependency);
    if(depStep?.accountId!==step.accountId && depStep && refsFrom(step.inputs).includes(`step:${dependency}`))
      missing.push(`cross-account-step:${dependency} (export/import required)`);
  }
  if(!binding)return {missing:['remote project binding',...missing],remoteProjectId:null};
  for(const assetId of new Set(refsFrom(step.inputs).filter(x=>x.startsWith('asset:')).map(x=>x.substring(6)))) {
    const canonical=manifest.assets.find(a=>a.id===assetId);
    if(!binding.assets?.[assetId] || binding.assetHashes?.[assetId]!==canonical.sha256)missing.push(`asset:${assetId}`);
  }
  // Upload is the operation that creates the missing asset; no remote asset binding required yet.
  if(step.operation==='asset.upload')missing.splice(0,missing.length);
  if(['character.create','character.update'].includes(step.operation)) {
    const canonical=manifest.characters.find(c=>c.id===step.inputs.characterId);
    for (const assetId of array(canonical.referenceAssetIds)) {
      const a=manifest.assets.find(x=>x.id===assetId);
      if(!binding.assets?.[assetId]||binding.assetHashes?.[assetId]!==a.sha256)missing.push(`character-reference:${assetId}`);
    }
  }
  return {missing,remoteProjectId:binding.remoteProjectId};
}

export class WorkflowStudio {
  constructor(studio) {this.studio=studio;}
  async importFile(file) {
    const filename=path.resolve(file);
    const source=JSON.parse(await fs.readFile(filename,'utf8'));
    return this.studio.store.mutate(state=>{
      state.workflows??={};
      const spec=validateWorkflow(source,state);
      const fingerprint=createHash('sha256').update(JSON.stringify(spec)).digest('hex');
      const existing=state.workflows[spec.id];
      if(existing){ assert(existing.fingerprint===fingerprint,'Workflow is immutable: use a new id for changes');return {id:spec.id,alreadyImported:true,steps:spec.steps.length,fingerprint}; }
      const steps=Object.fromEntries(spec.steps.map(s=>[s.id,{status:'planned',updatedAt:new Date().toISOString(),externalJobId:null,output:null}]));
      state.workflows[spec.id]={spec,fingerprint,steps,createdAt:new Date().toISOString()};
      return {id:spec.id,steps:spec.steps.length,order:spec.order,fingerprint};
    });
  }
  async get(id) {
    const state=await this.studio.store.read();
    const w=state.workflows?.[id];assert(w,`Unknown workflow ${id}`);
    return structuredClone(w);
  }
  async list() {
    const state=await this.studio.store.read();
    return Object.values(state.workflows||{}).map(w=>({id:w.spec.id,title:w.spec.title,steps:w.spec.steps.length,
      states:Object.fromEntries(Object.entries(w.steps).map(([id,r])=>[id,r.status]))}));
  }
  async plan(id) {
    const state=await this.studio.store.read();
    const workflow=state.workflows?.[id];assert(workflow,`Unknown workflow ${id}`);
    const items=workflow.spec.order.map(stepId=>{
      const step=workflow.spec.steps.find(s=>s.id===stepId);const current=workflow.steps[stepId];
      const blocked=step.dependsOn.filter(d=>workflow.steps[d].status!=='completed');
      const {missing,remoteProjectId}=bindingNeeds(state,step,workflow.spec.projectId,workflow);
      const acct=state.accounts[step.accountId];
      const ready=blocked.length===0 && missing.length===0 && current.status==='approved' && Boolean(acct.upstreamId);
      return {id:step.id,operation:step.operation,accountId:step.accountId,status:current.status,
        dependsOn:step.dependsOn,blockedBy:blocked,missingReferences:missing,remoteProjectId,
        approved:current.status!=='planned',readyForDispatch:ready,estimatedCredits:step.estimatedCredits,
        creditKind:FLOW_OPERATIONS[step.operation].credit,
        upstreamConfigured:!!acct.upstreamId,output:current.output};
    });
    return {id,projectId:workflow.spec.projectId,steps:items,summary:{total:items.length,completed:items.filter(x=>x.status==='completed').length,ready:items.filter(x=>x.readyForDispatch).length},note:'Plan is local only. Live Flow features, credits and project existence are not verified.'};
  }
  async approve(workflowId,stepId,confirmation) {
    assert(confirmation===true,'Operator approval required');
    return this.studio.store.mutate(state=>{
      const w=state.workflows?.[workflowId];assert(w,`Unknown workflow ${workflowId}`);
      const step=w.spec.steps.find(s=>s.id===stepId);assert(step,`Unknown step ${stepId}`);
      const current=w.steps[stepId];assert(current.status==='planned',`${stepId} is ${current.status}`);
      const a=state.accounts[step.accountId];assert(a.authorized&&a.enabled,'Account not enabled/authorized');
      const available=a.creditEstimate-reservedCredits(state,a.id,workflowId,stepId);
      assert(available>=step.estimatedCredits,`Insufficient operator-reported credits (${available}); no silent account rotation`);
      current.status='approved';current.approvedAt=new Date().toISOString();current.updatedAt=current.approvedAt;
      return {workflowId,stepId,status:current.status,estimatedCredits:step.estimatedCredits,accountId:a.id};
    });
  }
  async claim(workflowId,stepId) {
    return this.studio.store.mutate(state=>{
      const w=state.workflows?.[workflowId];assert(w,`Unknown workflow ${workflowId}`);
      const step=w.spec.steps.find(s=>s.id===stepId);assert(step,`Unknown step ${stepId}`);
      const cur=w.steps[stepId];assert(cur.status==='approved',`${stepId} must be approved, currently ${cur.status}`);
      assert(step.dependsOn.every(d=>w.steps[d].status==='completed'),'Dependencies not completed');
      const {missing}=bindingNeeds(state,step,w.spec.projectId,w);assert(missing.length===0,`Missing account-local references: ${missing.join(', ')}`);
      const account=state.accounts[step.accountId];assert(account.authorized&&account.enabled&&account.upstreamId,'Account has no enabled authorized upstream');
      const coreBusy=Object.values(state.jobs||{}).filter(j=>j.accountId===account.id&&BUSY.has(j.status)).length;
      const workflowBusy=Object.values(state.workflows||{}).flatMap(w=>w.spec.steps.map(s=>({accountId:s.accountId,status:w.steps[s.id].status}))).filter(x=>x.accountId===account.id&&BUSY.has(x.status)).length;
      assert(coreBusy+workflowBusy<account.maxConcurrent,'Account concurrency cap reached');
      cur.status='submitting';cur.updatedAt=new Date().toISOString();
      return {step,projectId:w.spec.projectId,account,remoteProjectId:state.bindings[`${w.spec.projectId}::${account.id}`]?.remoteProjectId??null};
    });
  }
  async mark(workflowId,stepId,status,details={}) {
    assert(VALID_STATES.has(status),`Invalid state ${status}`);
    const transitions={submitting:['submitted','submission_unknown'],submitted:['completed','submission_unknown','failed'],submission_unknown:['submitted','failed'],approved:['failed']};
    return this.studio.store.mutate(state=>{
      const w=state.workflows?.[workflowId];assert(w,`Unknown workflow ${workflowId}`);
      const cur=w.steps[stepId];assert(cur,`Unknown step ${stepId}`);
      assert(transitions[cur.status]?.includes(status),`Illegal transition ${cur.status} -> ${status}`);
      if(status==='completed')assert(details.output && typeof details.output==='object' && details.evidence,'Completion needs output and operator-checked evidence');
      if(details.externalJobId)cur.externalJobId=String(details.externalJobId).slice(0,200);
      if(details.output)cur.output=structuredClone(details.output);
      if(details.evidence)cur.evidence=String(details.evidence).slice(0,1000);
      cur.status=status;cur.updatedAt=new Date().toISOString();
      return {workflowId,stepId,...cur};
    });
  }
}