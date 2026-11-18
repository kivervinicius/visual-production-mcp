#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { Studio } from './core.mjs';
import { discoverUpstream, dispatchJob } from './upstream.mjs';
import { ingestResult } from './media.mjs';
import { preflight } from './preflight.mjs';
import { WorkflowStudio } from './workflows.mjs';
import { StoryGuide } from './story-guide.mjs';
import { StageEngine } from './application/guide/stage-engine.mjs';
import { listFlowOperations } from './flow-operations.mjs';
import { inspectWorkflowStep, executeWorkflowStep } from './workflow-adapter.mjs';

const studio = new Studio();
const workflows = new WorkflowStudio(studio);
const storyGuide = new StoryGuide(studio);
const stageEngine = new StageEngine(studio);
const server = new McpServer({ name: 'visual-production-mcp', version: '0.5.0' });
const result = x => ({ content: [{ type: 'text', text: JSON.stringify(x, null, 2) }] });
const tool = (name, description, inputSchema, action) => server.registerTool(name, { description, inputSchema: z.object(inputSchema) }, async args => {
  try { return result(await action(args)); }
  catch (error) { return { isError: true, content: [{ type: 'text', text: String(error?.message || error) }] }; }
});

const id = z.string().min(1).max(100);
const strings = z.record(z.string(), z.string());

tool('studio_library', 'Show reusable, versioned canonical character registry and reference hashes without provider credentials.', {}, () => studio.library());
tool('studio_status', 'View locally registered projects, jobs and manually reported account budgets; no live credits are claimed.', {}, () => studio.list());
tool('studio_import_project', 'Import a versioned production manifest with asset hashes, character bible and shots from local disk.', { manifestPath: z.string().min(1) }, ({ manifestPath }) => studio.importProject(manifestPath));
tool('studio_register_account', 'Register a separately authorized provider session and a manually reported credit estimate, never a password or cookie.', {
  id, provider: z.enum(['google-flow','higgsfield']), label: z.string().min(1), upstreamId: id.optional(), authorized: z.boolean(), enabled: z.boolean().optional(), creditEstimate: z.number().int().nonnegative(), maxConcurrent: z.number().int().min(1).max(3).optional()
}, args => studio.registerAccount(args));
tool('studio_update_balance', 'Refresh manually reported credit balance, without claiming live verification.', { accountId: id, creditEstimate: z.number().int().nonnegative(), enabled: z.boolean().optional() }, args => studio.updateBalance(args));
tool('studio_bind_project', 'Link a canonical production to an account-local provider project, with IDs of uploaded references and created characters.', {
  projectId: id, accountId: id, remoteProjectId: z.string().min(1), assets: strings.optional(), characters: strings.optional()
}, args => studio.bindAccountProject(args));
tool('studio_sync_plan', 'List precisely what is missing to hydrate one provider-local project for a canonical shot; never recreate all episodes.', { projectId: id, accountId: id, shotId: id }, args => studio.syncPlan(args));
tool('studio_plan', 'Plan idempotent per-shot assignments across separately authorized accounts, within operator-entered budget; creates no paid generations.', { projectId: id, provider: z.enum(['google-flow','higgsfield']).optional(), variant: id.optional() }, args => studio.plan(args));
tool('studio_preflight', 'Read-only per-account production preflight; reports missing references and upstream tool compatibility, never verifies live credits.', { projectId: id, accountId: id, shotId: id, probeUpstream: z.boolean().optional() }, args => preflight(studio, args));
tool('studio_discover_upstream', 'Read tools and schemas of a locally configured upstream MCP; does not run paid generations.', { upstreamId: id }, ({ upstreamId }) => discoverUpstream(studio.store.home, upstreamId));
tool('studio_dispatch_job', 'Dispatch only an operator-approved job via a configured local upstream. On uncertain submission, block retries for manual reconciliation.', {
  jobId: z.string().uuid(), toolName: z.string(), toolArguments: z.record(z.string(), z.unknown())
}, args => dispatchJob(studio, args));
tool('studio_record_failure', 'Record a confirmed upstream failure. Unknown submissions remain blocked until operator CLI reconciles them.', { jobId: z.string().uuid(), status: z.enum(['failed', 'submission_unknown']), note: z.string().max(1000).optional() }, ({jobId,status,note}) => studio.mark(jobId,status,{note}));
tool('studio_ingest_result', 'Copy an already generated local media file into content-addressed storage, verify integrity and ffprobe video, then mark complete pending human editorial review. No generation or credit spend.', { jobId: z.string().uuid(), filePath: z.string().min(1), externalJobId: z.string().optional(), expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional() }, args => ingestResult(studio,args));
tool('studio_bundle', 'Export portable canonical project manifest and original reference assets to a local folder; does not include account credentials.', { projectId: id, outputDir: z.string().min(1) }, args => studio.bundle(args));


// The documented Flow product surface and the real installed upstream MCP are deliberately separate.
tool('studio_flow_capabilities', 'Read-only catalog of documented Google Flow operations; actual account capabilities require live inspection.', {}, () => listFlowOperations());
tool('studio_workflow_import', 'Import a versioned DAG of Flow operations from an operator-controlled local JSON file. No provider calls or spending.', { workflowPath: z.string().min(1) }, ({ workflowPath }) => workflows.importFile(workflowPath));
tool('studio_workflow_list', 'List local workflows and their persistent step states.', {}, () => workflows.list());
tool('studio_workflow_status', 'Read a single workflow, its canonical inputs, approvals and recorded outcomes.', { workflowId: id }, ({ workflowId }) => workflows.get(workflowId));
tool('studio_workflow_plan', 'Read-only dependency plan with per-account bindings, readiness and manual credit estimates.', { workflowId: id }, ({ workflowId }) => workflows.plan(workflowId));
tool('studio_workflow_inspect_step', 'Verify tool name, parameters and required fields against the real upstream MCP schema. No spending or provider-login assertion.', { workflowId: id, stepId: id }, ({workflowId,stepId}) => inspectWorkflowStep(workflows,workflowId,stepId));
tool('studio_workflow_execute_step', 'Submit exactly one previously OPERATOR-approved workflow step through configured upstream. On unknown result, block retries. Never rotates accounts.', { workflowId: id, stepId: id }, ({workflowId,stepId}) => executeWorkflowStep(workflows,workflowId,stepId));

// Story-first guided planning: agent turns the original story into an evidence-linked plan.
// Production approvals remain operator-only, not tools callable by an autonomous agent.
tool('studio_story_start','BEGIN HERE for a new film: accept one original story, preserve a SHA-256 snapshot, and return the next guided creative task. Never generates or spends credits.',{
  id, title:z.string().min(1).max(200), storyText:z.string().min(1).max(200000).optional(), storyPath:z.string().min(1).optional(),
  aspectRatio:z.enum(['9:16','16:9']).optional(),language:z.string().min(1).max(40).optional()
}, args=>storyGuide.create(args));
tool('studio_story_list','List stories and the stage each one has reached.',{},()=>storyGuide.list());
tool('studio_story_status','Return the current guided production stage, completion status, creative assumptions, and what the agent must do next.',{storyId:id},({storyId})=>storyGuide.status(storyId));
tool('studio_story_draft','Read the persisted cast and storyboard for human review or resuming in another agent; never modifies the source.',{storyId:id},({storyId})=>storyGuide.draft(storyId));
tool('studio_story_source','Read an original narrative in small sections, including exact wording for sourceExcerpt fields. Never paraphrases the canonical story.',{
  storyId:id,offset:z.number().int().min(0).optional(),length:z.number().int().min(1).max(12000).optional()
},({storyId,...options})=>storyGuide.source(storyId,options));
tool('studio_story_submit_cast','Submit source-anchored characters, places, approved visual-style proposal, and explicitly disclosed creative assumptions. No media generation.',{
  storyId:id,cast:z.object({visualStyle:z.string(),characters:z.array(z.object({id,name:z.string(),sourceExcerpt:z.string(),designPrompt:z.string(),libraryId:z.string().optional()})).max(100),
    locations:z.array(z.object({id,name:z.string(),sourceExcerpt:z.string(),designPrompt:z.string()})).max(100),assumptions:z.array(z.string()).optional()})
},({storyId,cast})=>storyGuide.submitCast(storyId,cast));
tool('studio_story_submit_storyboard','Submit source-anchored ordered scenes and image/video shot directions with canonical character IDs; requires later human review.',{
  storyId:id,storyboard:z.object({scenes:z.array(z.object({id,title:z.string(),sourceExcerpt:z.string(),locationId:id.nullable().optional(),shots:z.array(z.object({id,sourceExcerpt:z.string(),visualPrompt:z.string(),motionPrompt:z.string(),durationSeconds:z.number().int(),characterIds:z.array(id).optional(),camera:z.string().optional(),audio:z.string().optional()}))}))})
},({storyId,storyboard})=>storyGuide.submitStoryboard(storyId,storyboard));
tool('studio_story_prepare','Only after OPERATOR editorial approval and registered account: compile canonical manifest, character bible, detailed storyboard and account-local image->video workflow; no provider calls or charges.',{
  storyId:id,accountId:id,videoEstimatedCredits:z.number().int().positive(),imageEstimatedCredits:z.number().int().nonnegative().optional(),includeCharacterCreation:z.boolean().optional(),includeSceneCompose:z.boolean().optional()
},args=>storyGuide.prepare(args));

// Phase/state tools only read and reconcile local evidence. Human approval remains CLI-only.
tool('production_get_status','Return durable 10-stage production progress, evidence levels, human approval gates, blockers and current next action. No provider spending.',{
  storyId:id
},({storyId})=>stageEngine.status(storyId));
tool('production_get_next_action','Get one actionable next step for the selected story without replaying the full chat; ID is stable for retries.',{
  storyId:id
},({storyId})=>stageEngine.next(storyId));
tool('production_events','Poll ordered local stage and decision events since a cursor. No background notification channel is implied.',{
  storyId:id,cursor:z.number().int().nonnegative().optional(),limit:z.number().int().min(1).max(100).optional()
},({storyId,cursor,limit})=>stageEngine.events(storyId,{cursor,limit}));

await server.connect(new StdioServerTransport());
