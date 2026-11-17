import { promises as fs } from 'node:fs';
import path from 'node:path';
async function withUpstream(...args) { const upstream = await import('./upstream.mjs'); return upstream.withUpstream(...args); }
import { FLOW_OPERATIONS } from './flow-operations.mjs';

const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const safeKey=k=>typeof k==='string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(k) && !['__proto__','constructor','prototype'].includes(k);
function get(object, dotted) {
  assert(typeof dotted==='string'&&dotted.length<=120&&dotted.split('.').every(safeKey),`Invalid adapter path ${dotted}`);
  return dotted.split('.').reduce((value,key)=>value==null?undefined:value[key],object);
}
export function compileArguments(mapping, context) {
  assert(mapping && typeof mapping==='object'&&!Array.isArray(mapping),'Adapter mapping missing arguments');
  const result=Object.create(null);
  for(const [key,v] of Object.entries(mapping)) {
    assert(safeKey(key),`Invalid mapping key ${key}`);
    assert(v && typeof v==='object'&&!Array.isArray(v),`Adapter argument ${key} must use {from} or {literal}`);
    assert(Object.keys(v).length===1,`${key}: only a single mapping operator is supported`);
    let value;
    if(Object.hasOwn(v,'from')){
      assert(typeof v.from==='string'&&/^(input|account|binding|workflow|step)\./.test(v.from),`Untrusted argument source ${v.from}`);
      value=get(context,v.from);
    } else if(Object.hasOwn(v,'literal')){
      value=v.literal;
    } else throw Error(`${key}: unsupported mapping expression`);
    if(value!==undefined)result[key]=structuredClone(value);
  }
  return result;
}
export function validateToolSignature(tool, args) {
  assert(tool?.inputSchema?.type==='object',`Cannot validate upstream schema for ${tool?.name}`);
  const schema=tool.inputSchema;
  for(const required of schema.required||[]) assert(Object.hasOwn(args,required),`Missing required upstream parameter: ${required}`);
  if(schema.additionalProperties===false) for(const key of Object.keys(args)) assert(Object.hasOwn(schema.properties||{},key),`Upstream does not support parameter ${key}`);
  for(const [key, value] of Object.entries(args)){
    const type=schema.properties?.[key]?.type;
    if(type==='string')assert(typeof value==='string',`${key}: expected string`);
    if(type==='boolean')assert(typeof value==='boolean',`${key}: expected boolean`);
    if(type==='integer')assert(Number.isInteger(value),`${key}: expected integer`);
    if(type==='number')assert(typeof value==='number',`${key}: expected number`);
    if(type==='array')assert(Array.isArray(value),`${key}: expected array`);
  }
  return true;
}
/** Resolve canonical media references to account-local provider IDs. Never assume IDs transfer across accounts. */
export function resolveWorkflowInputs(state,workflow,step,home) {
  const project=state.projects[workflow.spec.projectId]?.manifest;
  assert(project,`Unknown canonical project ${workflow.spec.projectId}`);
  const binding=state.bindings[`${workflow.spec.projectId}::${step.accountId}`];
  const resolve=value=>{
    if(typeof value==='string' && value.startsWith('asset:')){
      const id=value.substring(6), a=project.assets.find(x=>x.id===id);
      assert(a,`Unknown canonical asset ${id}`);
      assert(binding?.assets?.[id] && binding.assetHashes?.[id]===a.sha256,`Asset ${id} is not synchronized to account ${step.accountId}`);
      return binding.assets[id];
    }
    if(typeof value==='string'&&value.startsWith('step:')){
      const id=value.substring(5), dep=workflow.spec.steps.find(s=>s.id===id);
      assert(dep && step.dependsOn.includes(id),`Undeclared step reference ${id}`);
      assert(dep.accountId===step.accountId,`Cannot reuse provider-local output ${id} across accounts; export, import and bind it first`);
      const output=workflow.steps[id];
      assert(output?.status==='completed'&&output.output?.providerAssetId,`Missing verified provider asset ID from step ${id}`);
      return output.output.providerAssetId;
    }
    if(Array.isArray(value))return value.map(resolve);
    if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolve(v)]));
    return value;
  };
  const inputs=resolve(step.inputs);
  if(step.operation==='asset.upload'){
    const asset=project.assets.find(a=>a.id===step.inputs.assetId);
    assert(asset,'Canonical asset missing');
    inputs.localPath=path.join(home,asset.storedPath);
    inputs.assetSha256=asset.sha256;
  }
  return inputs;
}

export async function readAdapter(home,provider,operation) {
  assert(FLOW_OPERATIONS[operation],`Operation not in allowlist: ${operation}`);
  const filename=process.env.STUDIO_ADAPTERS_CONFIG||path.join(home,'adapters.json');
  const cfg=JSON.parse(await fs.readFile(filename,'utf8'));
  const mapping=cfg[provider]?.[operation];
  assert(mapping && typeof mapping.tool==='string'&&/^[A-Za-z][A-Za-z0-9_-]{1,99}$/.test(mapping.tool),`No operator-provided mapping for ${provider}/${operation}`);
  assert(mapping.arguments && typeof mapping.arguments==='object',`Missing arguments map for ${operation}`);
  return mapping;
}
function parseProviderReceipt(result, mapping) {
  const roots=[result.structuredContent];
  for(const part of result.content||[]){if(part.type==='text')try{roots.push(JSON.parse(part.text));}catch{}}
  const find=paths=>{
    for(const root of roots) for(const p of paths){
      if(!root)continue;
      const val=get(root,p);
      if(typeof val==='string'&&val.trim().length>0&&val.length<300)return val;
    }
    return null;
  };
  const externalId=find(mapping.resultIdPaths||['jobId','job_id','operationId','operation_id','data.jobId','data.operationId']);
  const providerStatus=find(mapping.statusPaths||['status','state','data.status','job.status']);
  const accepted=mapping.submittedStatuses||['submitted','queued','generating','running','processing','pending','completed'];
  assert(Array.isArray(accepted)&&accepted.every(x=>typeof x==='string'),'submittedStatuses must be string array');
  // An ID without a positive submission status is NOT evidence of a paid operation.
  const acceptedSubmission=!result.isError && externalId && providerStatus && accepted.some(x=>x.toLowerCase()===providerStatus.toLowerCase());
  return {externalId,providerStatus,acceptedSubmission:Boolean(acceptedSubmission)};
}
export async function inspectWorkflowStep(studio,workflowId,stepId,{connection=withUpstream}={}) {
  const w=await studio.get(workflowId);
  const step=w.spec.steps.find(s=>s.id===stepId);assert(step,`Unknown workflow step ${stepId}`);
  const state=await studio.studio.store.read();
  const account=state.accounts[step.accountId];
  const mapping=await readAdapter(studio.studio.store.home,account.provider,step.operation);
  const binding=state.bindings[`${w.spec.projectId}::${step.accountId}`];
  const input=resolveWorkflowInputs(state,w,step,studio.studio.store.home);
  const args=compileArguments(mapping.arguments,{input,account, binding,
    workflow:{id:workflowId,projectId:w.spec.projectId},step:{id:stepId}});
  const inspected=await connection(studio.studio.store.home,account.upstreamId,async client=>{
    const response=await client.listTools();
    const tool=response.tools.find(t=>t.name===mapping.tool);
    assert(tool,`Configured upstream tool ${mapping.tool} not found`);
    validateToolSignature(tool,args);
    return {tool:tool.name,inputSchema:tool.inputSchema};
  });
  return {workflowId,stepId,operation:step.operation,upstreamId:account.upstreamId,
    mappingTool:inspected.tool,argumentsPreview:Object.fromEntries(Object.keys(args).map(k=>[k,'[mapped]'])),
    schemaVerified:true,liveAccountVerified:false,creditQuoteVerified:false,
    note:'Only MCP schema was checked; account login, actual Flow workspace and available credits require provider-side verification.'};
}
/** Exactly once attempt. Unknown outcomes stop; operator reconciliation required. */
export async function executeWorkflowStep(studio,workflowId,stepId,{connection=withUpstream}={}) {
  // Inspect BEFORE claiming. No local state mutation if the bridge/schema is missing.
  await inspectWorkflowStep(studio,workflowId,stepId,{connection});
  const {step,account,projectId,remoteProjectId}=await studio.claim(workflowId,stepId);
  try {
    const mapping=await readAdapter(studio.studio.store.home,account.provider,step.operation);
    const state=await studio.studio.store.read();
    const binding=state.bindings[`${projectId}::${account.id}`];
    const input=resolveWorkflowInputs(state,await studio.get(workflowId),step,studio.studio.store.home);
    const args=compileArguments(mapping.arguments,{input,account,binding,
      workflow:{id:workflowId,projectId,remoteProjectId},step:{id:stepId}});
    const response=await connection(studio.studio.store.home,account.upstreamId,async client=>{
      const schemas=await client.listTools();
      const tool=schemas.tools.find(t=>t.name===mapping.tool);
      assert(tool,'Upstream tool disappeared after preflight');validateToolSignature(tool,args);
      return client.callTool({name:mapping.tool,arguments:args});
    });
    const receipt=parseProviderReceipt(response,mapping);
    const operationId=receipt.externalId;
    const status=receipt.acceptedSubmission ? 'submitted' : 'submission_unknown';
    await studio.mark(workflowId,stepId,status,{externalJobId:operationId||undefined,
      evidence:status==='submitted'?'Provider returned an operation identifier; result still requires reconciliation':'Ambiguous tool response; inspect Flow manually'});
    return {workflowId,stepId,status,externalJobId:operationId,providerStatus:receipt.providerStatus,
      warning:status==='submission_unknown'?'Do not automatically retry. Reconcile against provider UI first.':undefined};
  } catch(error) {
    await studio.mark(workflowId,stepId,'submission_unknown',{evidence:`Execution uncertain: ${String(error.message).slice(0,500)}`});
    throw new Error(`Workflow dispatch uncertain for ${stepId}; manual reconciliation required: ${error.message}`);
  }
}