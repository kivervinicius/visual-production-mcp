import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

/** Upstream servers are configured only by the local operator, never through agent tool input. */
export async function withUpstream(home, upstreamId, fn) {
  const file = process.env.STUDIO_UPSTREAMS_CONFIG || path.join(home, 'upstreams.json');
  const config = JSON.parse(await fs.readFile(file, 'utf8'))[upstreamId];
  if (!config || !config.command || !Array.isArray(config.args)) throw new Error(`Unconfigured upstream: ${upstreamId}`);
  const transport = new StdioClientTransport({ command: config.command, args: config.args, env: { ...process.env, ...(config.env || {}) } });
  const client = new Client({ name: 'visual-production-mcp-bridge', version: '0.2.0' });
  try { await client.connect(transport); return await fn(client); }
  finally { await client.close(); }
}

const ALLOWED = {
  'google-flow': new Set(['flow_generate_video', 'flow_generate_image']),
  'higgsfield': new Set(['higgsfield_generate_video', 'higgsfield_generate_image'])
};

export async function discoverUpstream(home, upstreamId) {
  return withUpstream(home, upstreamId, async client => {
    const response = await client.listTools();
    return response.tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
  });
}

/** Only dispatch an explicitly approved shot, with provider inputs supplied by the harness. */
export async function dispatchJob(studio, { jobId, toolName, toolArguments }) {
  const state = await studio.store.read();
  const job = state.jobs[jobId]; if (!job) throw new Error('Unknown job');
  const acct = state.accounts[job.accountId];
  const shot = state.projects[job.projectId].manifest.shots.find(s => s.id === job.shotId);
  if (!ALLOWED[acct.provider]?.has(toolName)) throw new Error(`Tool ${toolName} not approved for ${acct.provider}`);
  if (!toolArguments || typeof toolArguments !== 'object' || Array.isArray(toolArguments) || toolArguments.prompt !== shot.prompt) {
    throw new Error('toolArguments.prompt must exactly match the versioned shot prompt');
  }
  if (!acct.upstreamId) throw new Error('Account has no configured local upstream bridge');
  const sync = await studio.syncPlan({ projectId: job.projectId, accountId: job.accountId, shotId: job.shotId });
  const remoteId = toolArguments.projectId ?? toolArguments.project_id;
  if (!remoteId || remoteId !== sync.remoteProjectId) throw new Error('Generation arguments must explicitly target the bound remote project via projectId or project_id');
  if (!sync.ready) throw new Error(`Remote project/inputs not ready: ${JSON.stringify(sync.missing)}`);
  await studio.claimForDispatch(jobId);
  try {
    const response = await withUpstream(studio.store.home, acct.upstreamId, async client => {
      const tools = await client.listTools();
      if (!tools.tools.some(t => t.name === toolName)) throw new Error(`Upstream does not implement ${toolName}`);
      return client.callTool({ name: toolName, arguments: toolArguments });
    });
    const combined = (response.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    let parsed = null; try { parsed = JSON.parse(combined); } catch {}
    const jobIdFromProvider = parsed?.jobId || parsed?.job_id || parsed?.operationId || parsed?.operation_id || null;
    // Some upstream MCPs return prepared forms, not confirmed paid jobs: never call that "submitted".
    const status = !response.isError && jobIdFromProvider ? 'submitted' : 'submission_unknown';
    const result = await studio.mark(jobId, status, { externalJobId: jobIdFromProvider || undefined, note: 'Upstream response must be reconciled against provider UI before retry/complete' });
    return { job: result, upstreamResponse: response, warning: status === 'submission_unknown' ? 'Possible submission is uncertain: DO NOT RETRY automatically. Inspect provider before reconciliation.' : undefined };
  } catch (e) {
    await studio.mark(jobId, 'submission_unknown', { note: `Upstream call error. Inspect provider before retry: ${String(e?.message || e).slice(0, 300)}` });
    throw new Error(`Dispatch uncertain for job ${jobId}; inspect provider before manual reconciliation: ${e.message || e}`);
  }
}