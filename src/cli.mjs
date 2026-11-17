#!/usr/bin/env node
import { Studio } from './core.mjs';
import { reviewResult } from './media.mjs';
const studio = new Studio();
const [command, ...params] = process.argv.slice(2);
try {
  let value;
  switch (command) {
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
    case 'status': value = await studio.list(); break;
    default: throw new Error('Operator commands: approve <jobId> | reconcile <jobId> <externalJobId> | review <jobId> approved|rejected [note] | import <manifestPath> | status');
  }
  console.log(JSON.stringify(value, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }