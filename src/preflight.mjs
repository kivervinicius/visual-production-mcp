import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Read-only diagnostic: a green result only proves that requirements are registered, not that Flow is operable. */
export async function preflight(studio, { projectId, accountId, shotId, probeUpstream = false }) {
  const state = await studio.store.read();
  const acct = state.accounts[accountId];
  const failures = []; const warnings = [];
  if (!acct) return { ready: false, failures: ['Account not registered'], warnings };
  if (!acct.authorized || !acct.enabled) failures.push('Account is not authorized and enabled');
  if (!acct.upstreamId) failures.push('No upstream MCP configured');
  const shot = state.projects[projectId]?.manifest.shots.find(s => s.id === shotId);
  if (!shot) failures.push('Production/shot missing');
  const sync = shot ? await studio.syncPlan({ projectId, accountId, shotId }) : null;
  if (sync && !sync.ready) failures.push(`Missing remote bindings: ${JSON.stringify(sync.missing)}`);
  const assigned = Object.values(state.jobs).find(j => j.projectId === projectId && j.shotId === shotId && j.accountId === accountId && ['approved', 'submitting', 'submitted', 'submission_unknown'].includes(j.status));
  if (!assigned) warnings.push('No approved/active job currently assigned to this account');
  let toolStatus = 'unprobed'; let availableTools = [];
  if (acct.upstreamId) {
    const configPath = process.env.STUDIO_UPSTREAMS_CONFIG || path.join(studio.store.home, 'upstreams.json');
    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      if (!config[acct.upstreamId]?.command || !Array.isArray(config[acct.upstreamId]?.args)) failures.push(`Invalid upstream configuration for ${acct.upstreamId}`);
      else if (probeUpstream) {
        const { discoverUpstream } = await import('./upstream.mjs');
        availableTools = (await discoverUpstream(studio.store.home, acct.upstreamId)).map(t => t.name);
        const allowed = acct.provider === 'google-flow' ? ['flow_generate_video','flow_generate_image'] : ['higgsfield_generate_video','higgsfield_generate_image'];
        toolStatus = availableTools.some(x => allowed.includes(x)) ? 'declares-generation-tools' : 'unsupported-tool-contract';
        if (toolStatus !== 'declares-generation-tools') failures.push('Bridge does not expose a known allowlisted generation tool; adapter required');
      }
    } catch (e) { failures.push(`Upstream configuration/connection unavailable: ${String(e.message).slice(0, 180)}`); }
  }
  warnings.push('Provider session, project and actual credit quote are NOT independently verified by this diagnostic');
  return { localReady: failures.length === 0 && toolStatus !== 'unsupported-tool-contract', liveReady: false, projectId, accountId, shotId, sync, toolStatus, availableTools, failures, warnings };
}