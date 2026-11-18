#!/usr/bin/env node
import { Studio } from './core.mjs';
import { reviewResult } from './media.mjs';
import { WorkflowStudio } from './workflows.mjs';
import { StoryGuide } from './story-guide.mjs';
import { StageEngine } from './application/guide/stage-engine.mjs';
import { VisualLibrary } from './application/library/visual-library.mjs';
const studio = new Studio();
const workflows = new WorkflowStudio(studio);
const stories = new StoryGuide(studio);
const stages = new StageEngine(studio);
const library = new VisualLibrary(studio);
const [command, ...params] = process.argv.slice(2);
try {
  let value;
  switch (command) {
    case 'visual-list':
      value=await library.list();break;
    case 'visual-status':
      if(!params[0])throw new Error('Usage: visual-status <libraryId> [version]');
      value=await library.get({libraryId:params[0],...(params[1]?{version:Number(params[1])}:{})});break;
    case 'visual-approve':
    case 'visual-reject':
      if(!params[0]||!params[1]||!params[2])throw new Error(`Usage: ${command} <libraryId> <version> <expectedFingerprint> [note]`);
      value=await library.decide({libraryId:params[0],version:Number(params[1]),expectedFingerprint:params[2],decision:command==='visual-approve'?'approve':'reject',note:params.slice(3).join(' ')});break;
    case 'visual-shot-review':
      if(!params[0]||!params[1]||!params[2]||!params[3]||!['approve','reject'].includes(params[4]))throw new Error('Usage: visual-shot-review <projectId> <shotId> <variant> <expectedSha256> approve|reject [note]');
      value=await library.decideShot({projectId:params[0],shotId:params[1],variant:params[2],expectedSha256:params[3],decision:params[4],note:params.slice(5).join(' ')});break;
    case 'story-start':
      if(!params[0]||!params[1]||!params[2])throw new Error('Usage: npm run operator -- story-start <id> <title> <story.txt>');
      value=await stories.create({id:params[0],title:params[1],storyPath:params[2]});break;
    case 'story-status':
      if(!params[0])throw new Error('Usage: npm run operator -- story-status <storyId>');
      value=await stories.status(params[0]);break;
    case 'production-status':
      if(!params[0])throw new Error('Usage: npm run operator -- production-status <storyId>');
      value=await stages.status(params[0]);break;
    case 'production-next':
      if(!params[0])throw new Error('Usage: npm run operator -- production-next <storyId>');
      value=await stages.next(params[0]);break;
    case 'production-events':
      if(!params[0])throw new Error('Usage: npm run operator -- production-events <storyId> [cursor]');
      value=await stages.events(params[0],{cursor:params[1]===undefined?0:Number(params[1])});break;
    case 'production-decision':
      if(!params[0]||!['approve','request_changes'].includes(params[1])||!params[2])throw new Error('Usage: npm run operator -- production-decision <storyId> approve|request_changes <expectedReviewVersion> [note]');
      value=await stages.operatorDecision(params[0],{decision:params[1],expectedReviewVersion:params[2],note:params.slice(3).join(' ')});break;
    case 'story-approve':
      if(!params[0])throw new Error('Usage: npm run operator -- story-approve <storyId>');
      value=await stories.approve(params[0]);break;
    case 'approve':
      if (!params[0]) throw new Error('Usage: npm run operator -- approve <jobId>');
      value = await studio.approve(params[0], true); break;
    case 'import':
      if (!params[0]) throw new Error('Usage: npm run operator -- import /path/to/production.json');
      value = await studio.importProject(params[0]); break;
    case 'reconcile':
      if (!params[0] || !params[1]) throw new Error('Usage: npm run operator -- reconcile <jobId> <externalJobId>');
      value = await studio.mark(params[0], 'submitted', {externalJobId: params[1], note: 'Operator reconciled against provider evidence'}); break;
    case 'review':
      if (!params[0] || !['approved','rejected'].includes(params[1])) throw new Error('Usage: npm run operator -- review <jobId> approved|rejected [note]');
      value = await reviewResult(studio,{jobId:params[0],decision:params[1],note:params.slice(2).join(' ')}); break;
    case 'workflow-import':
      if (!params[0]) throw new Error('Usage: npm run operator -- workflow-import /path/to/workflow.json');
      value = await workflows.importFile(params[0]); break;
    case 'workflow-approve':
      if (!params[0] || !params[1]) throw new Error('Usage: npm run operator -- workflow-approve <workflowId> <stepId>');
      value = await workflows.approve(params[0],params[1],true); break;
    case 'workflow-reconcile':
      if (!params[0] || !params[1] || !params[2]) throw new Error('Usage: npm run operator -- workflow-reconcile <workflowId> <stepId> <externalJobId>');
      value = await workflows.mark(params[0],params[1],'submitted',{externalJobId:params[2],evidence:'Operator manually reconciled against provider UI'}); break;
    case 'workflow-complete':
      if (!params[0] || !params[1] || !params[2] || !params[3]) throw new Error('Usage: npm run operator -- workflow-complete <workflowId> <stepId> <providerAssetId> <evidenceNote>');
      value = await workflows.mark(params[0],params[1],'completed',{output:{providerAssetId:params[2]},evidence:params.slice(3).join(' ')}); break;
    case 'workflow-plan':
      if (!params[0]) throw new Error('Usage: npm run operator -- workflow-plan <workflowId>');
      value = await workflows.plan(params[0]); break;
    case 'status': value = await studio.list(); break;
    default: throw new Error('Operator commands: visual-list | visual-status <libraryId> [version] | visual-approve <libraryId> <version> <fingerprint> | visual-reject <libraryId> <version> <fingerprint> <note> | visual-shot-review <projectId> <shotId> <variant> <sha256> approve|reject [note] | production-status <id> | production-next <id> | production-events <id> [cursor] | production-decision <id> approve|request_changes <reviewVersion> [note] | story-start <id> <title> <storyfile> | story-status <id> | story-approve <id> | workflow-import <file> | workflow-plan <id> | workflow-approve <id> <step> | workflow-reconcile <id> <step> <remoteJob> | workflow-complete <id> <step> <remoteAsset> <evidence> | approve <jobId> | reconcile <jobId> <externalJobId> | review <jobId> approved|rejected [note] | import <manifestPath> | status');
  }
  console.log(JSON.stringify(value, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
