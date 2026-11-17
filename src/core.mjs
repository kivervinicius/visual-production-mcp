import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const LIBRARY_ID = /^[a-zA-Z0-9][a-zA-Z0-9._\/-]{0,159}$/;
const PROVIDERS = new Set(['google-flow', 'higgsfield']);
const NON_FINAL = new Set(['awaiting_approval', 'approved', 'submitting', 'submitted', 'submission_unknown']);
const MESSAGE = 'Accounts and credits are not pooled; this tool only coordinates approved independent sessions. Do not use it to evade service limits.';

function assert(condition, message) { if (!condition) throw new Error(message); }
function checkId(value, field = 'id') { assert(typeof value === 'string' && ID.test(value) && !['.', '..', '__proto__', 'constructor', 'prototype'].includes(value), `${field}: invalid identifier`); return value; }
function checkLibraryId(value) { assert(typeof value === 'string' && LIBRARY_ID.test(value) && !value.split('/').some(p => !p || ['.','..','__proto__','constructor','prototype'].includes(p)), 'Invalid libraryId'); return value; }
function checkStr(value, field) { assert(typeof value === 'string' && value.length > 0 && value.length <= 20000, `${field}: nonempty string required`); return value; }
function uniqueById(items, name) { const ids = items.map(x => checkId(x?.id, name)); assert(new Set(ids).size === ids.length, `${name}: duplicate id`); }
function array(value) { return Array.isArray(value) ? value : []; }
function now() { return new Date().toISOString(); }
function positiveCredits(n) { assert(Number.isInteger(n) && n > 0, 'estimatedCredits must be a positive integer'); return n; }
function clone(value) { return structuredClone(value); }
function ensureWithin(base, file) { const abs = path.resolve(base, file); assert(abs.startsWith(path.resolve(base) + path.sep), `Asset path escapes manifest directory: ${file}`); return abs; }
function emptyState() { return { schemaVersion: 2, accounts: {}, projects: {}, bindings: {}, jobs: {}, catalog: { characters: {} } }; }
async function sha256(file) { return createHash('sha256').update(await fs.readFile(file)).digest('hex'); }

export class StudioStore {
  constructor(home = process.env.STUDIO_HOME || path.resolve('.studio')) { this.home = path.resolve(home); this.statePath = path.join(this.home, 'state.json'); this.lockPath = path.join(this.home, 'state.lock'); }
  async init() {
    await fs.mkdir(this.home, { recursive: true, mode: 0o700 });
    try { await fs.access(this.statePath); return; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const temp = `${this.statePath}.${randomUUID()}.init`;
    try {
      await fs.writeFile(temp, JSON.stringify(emptyState(), null, 2) + '\n', { mode: 0o600 });
      try { await fs.link(temp, this.statePath); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    } finally { await fs.rm(temp, { force: true }); }
  }
  async atomicWrite(file, value) { const tmp = `${file}.${randomUUID()}.tmp`; await fs.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); await fs.rename(tmp, file); }
  async read() { await this.init(); return JSON.parse(await fs.readFile(this.statePath, 'utf8')); }
  async mutate(fn) {
    await this.init(); let acquired = false;
    for (let i = 0; i < 35; i++) {
      try { await fs.mkdir(this.lockPath); acquired = true; break; }
      catch (e) { if (e.code !== 'EEXIST') throw e; await new Promise(r => setTimeout(r, 100)); }
    }
    assert(acquired, `Studio workspace locked at ${this.lockPath}; inspect the owner before manual removal`);
    try { const state = await this.read(); state.catalog ??= { characters: {} }; const result = await fn(state); await this.atomicWrite(this.statePath, state); return clone(result); }
    finally { await fs.rmdir(this.lockPath); }
  }
}

export class Studio {
  constructor(home) { this.store = new StudioStore(home); }
  async importProject(manifestPath) {
    const full = path.resolve(checkStr(manifestPath, 'manifestPath'));
    const manifest = JSON.parse(await fs.readFile(full, 'utf8'));
    assert(manifest.schemaVersion === 1, 'Expected schemaVersion 1'); checkId(manifest.id); checkStr(manifest.title, 'title');
    for (const field of ['assets', 'characters', 'shots']) assert(Array.isArray(manifest[field]), `${field} must be an array`);
    uniqueById(manifest.assets, 'assets'); uniqueById(manifest.characters, 'characters'); uniqueById(manifest.shots, 'shots');
    const assetIds = new Set(manifest.assets.map(a => a.id)); const characterIds = new Set(manifest.characters.map(c => c.id));
    for (const character of manifest.characters) { assert(Number.isInteger(character.version) && character.version > 0, 'character version invalid'); checkLibraryId(character.libraryId || `${manifest.id}/${character.id}`); checkStr(character.description, 'character description'); for (const id of array(character.referenceAssetIds)) assert(assetIds.has(id), `Unknown character asset ${id}`); }
    for (const shot of manifest.shots) {
      checkStr(shot.prompt, 'shot prompt'); assert(['9:16', '16:9', '1:1'].includes(shot.aspectRatio), 'Invalid aspect ratio');
      assert(Number.isInteger(shot.durationSeconds) && shot.durationSeconds > 0, 'durationSeconds must be positive'); positiveCredits(shot.estimatedCredits);
      for (const id of array(shot.characterIds)) assert(characterIds.has(id), `Unknown character ${id}`);
      for (const id of array(shot.referenceAssetIds)) assert(assetIds.has(id), `Unknown shot asset ${id}`);
    }
    const normalized = clone(manifest);
    for (const asset of normalized.assets) {
      checkId(asset.id, 'asset id'); checkStr(asset.path, 'asset.path');
      assert(!path.isAbsolute(asset.path), 'Asset paths must be relative');
      const file = ensureWithin(path.dirname(full), asset.path);
      const realFile = await fs.realpath(file);
      const realBase = await fs.realpath(path.dirname(full));
      assert(realFile.startsWith(realBase + path.sep), `Asset resolves outside manifest directory: ${asset.path}`);
      const hash = await sha256(file);
      if (asset.sha256) assert(asset.sha256 === hash, `SHA-256 mismatch for asset ${asset.id}`);
      const dest = path.join(this.store.home, 'assets', hash + path.extname(file).toLowerCase());
      await fs.mkdir(path.dirname(dest), { recursive: true });
      try { await fs.copyFile(file, dest, fs.constants.COPYFILE_EXCL); } catch (e) { if (e.code !== 'EEXIST') throw e; }
      asset.sha256 = hash; asset.storedPath = path.relative(this.store.home, dest); delete asset.path;
    }
    const fingerprint = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    const catalog = normalized.characters.map(c => {
      const libraryId = c.libraryId || `${normalized.id}/${c.id}`;
      const referenceHashes = array(c.referenceAssetIds).map(id => normalized.assets.find(a => a.id === id).sha256).sort();
      const spec = { libraryId, version: c.version, description: c.description, referenceHashes };
      return { ...spec, key: `${libraryId}@${c.version}`, fingerprint: createHash('sha256').update(JSON.stringify(spec)).digest('hex') };
    });
    return this.store.mutate(state => {
      for (const c of catalog) {
        const previous = state.catalog.characters[c.key];
        assert(!previous || previous.fingerprint === c.fingerprint, `Character revision conflict for ${c.key}; increment version instead of silently changing references`);
      }

      const existing = state.projects[normalized.id];
      if (existing && existing.fingerprint !== fingerprint) {
        const related = Object.values(state.jobs).some(j => j.projectId === normalized.id);
        assert(!related, 'Project has jobs. Import revisions under a new project ID or implement explicit migration.');
      }
      for (const c of catalog) state.catalog.characters[c.key] = { ...c, updatedAt: now() };
      state.projects[normalized.id] = { manifest: normalized, fingerprint, updatedAt: now() };
      return { projectId: normalized.id, fingerprint, shots: normalized.shots.length, characters: normalized.characters.length, assets: normalized.assets.length };
    });
  }
  async registerAccount({ id, provider, label, upstreamId, authorized = false, enabled = true, creditEstimate, maxConcurrent = 1 }) {
    checkId(id); assert(PROVIDERS.has(provider), `Unsupported provider ${provider}`); checkStr(label, 'label');
    assert(authorized === true, 'Explicit authorization for this provider account is required');
    assert(Number.isInteger(creditEstimate) && creditEstimate >= 0, 'creditEstimate must be >= 0');
    assert(Number.isInteger(maxConcurrent) && maxConcurrent >= 1 && maxConcurrent <= 3, 'maxConcurrent must be 1..3');
    if (upstreamId) checkId(upstreamId, 'upstreamId');
    return this.store.mutate(state => {
      assert(!state.accounts[id], `Account already exists: ${id}`);
      state.accounts[id] = { id, provider, label, upstreamId: upstreamId || null, authorized, enabled, creditEstimate, creditRecordedAt: now(), maxConcurrent };
      return state.accounts[id];
    });
  }
  async updateBalance({ accountId, creditEstimate, enabled }) {
    checkId(accountId, 'accountId'); assert(Number.isInteger(creditEstimate) && creditEstimate >= 0, 'creditEstimate must be >= 0');
    return this.store.mutate(state => { const acct = state.accounts[accountId]; assert(acct, 'Account missing'); acct.creditEstimate = creditEstimate; acct.creditRecordedAt = now(); if (typeof enabled === 'boolean') acct.enabled = enabled; return acct; });
  }
  async library() { const state = await this.store.read(); return { characters: Object.values(state.catalog?.characters || {}) }; }
  async list() {
    const state = await this.store.read();
    return { accounts: Object.values(state.accounts).map(a => ({ ...a, creditEstimateSource: 'manually reported; not verified live' })), projects: Object.values(state.projects).map(p => ({ id: p.manifest.id, title: p.manifest.title, shots: p.manifest.shots.length, fingerprint: p.fingerprint })), jobs: Object.values(state.jobs), notice: MESSAGE };
  }
  async bindAccountProject({ projectId, accountId, remoteProjectId, assets = {}, characters = {} }) {
    checkId(projectId, 'projectId'); checkId(accountId, 'accountId'); checkStr(remoteProjectId, 'remoteProjectId');
    return this.store.mutate(state => {
      assert(state.projects[projectId] && state.accounts[accountId], 'Project/account missing');
      const manifest = state.projects[projectId].manifest;
      for (const [key, value] of Object.entries(assets)) { assert(manifest.assets.some(a => a.id === key), `Unknown asset: ${key}`); checkStr(value, 'remote asset id'); }
      for (const [key, value] of Object.entries(characters)) { assert(manifest.characters.some(c => c.id === key), `Unknown character: ${key}`); checkStr(value, 'remote character id'); }
      const id = `${projectId}::${accountId}`;
      const prev = state.bindings[id];
      assert(!prev || prev.remoteProjectId === remoteProjectId, 'Changing remoteProjectId requires explicit migration');
      const assetHashes = Object.fromEntries(Object.entries(assets).map(([key]) => [key, manifest.assets.find(a => a.id === key).sha256]));
      const characterVersions = Object.fromEntries(Object.entries(characters).map(([key]) => [key, manifest.characters.find(c => c.id === key).version]));
      state.bindings[id] = { projectId, accountId, remoteProjectId,
        assets: { ...(prev?.assets || {}), ...assets }, assetHashes: { ...(prev?.assetHashes || {}), ...assetHashes },
        characters: { ...(prev?.characters || {}), ...characters }, characterVersions: { ...(prev?.characterVersions || {}), ...characterVersions },
        evidence: 'operator-reported, not independently verified', updatedAt: now() };
      return state.bindings[id];
    });
  }
  async syncPlan({ projectId, accountId, shotId }) {
    const state = await this.store.read();
    const p = state.projects[projectId]?.manifest; assert(p, `Unknown project ${projectId}`);
    const a = state.accounts[accountId]; assert(a, `Unknown account ${accountId}`);
    const shot = p.shots.find(s => s.id === shotId); assert(shot, `Unknown shot ${shotId}`);
    const binding = state.bindings[`${projectId}::${accountId}`];
    const referencedCharacters = p.characters.filter(c => array(shot.characterIds).includes(c.id));
    const requiredAssets = [...new Set([...array(shot.referenceAssetIds), ...referencedCharacters.flatMap(c => array(c.referenceAssetIds))])];
    const validAsset = id => binding?.assets?.[id] && binding.assetHashes?.[id] === p.assets.find(a => a.id === id).sha256;
    const validCharacter = c => binding?.characters?.[c.id] && binding.characterVersions?.[c.id] === c.version;
    return { projectId, accountId, shotId, provider: a.provider, remoteProjectId: binding?.remoteProjectId || null,
      missing: { project: !binding, assets: requiredAssets.filter(id => !validAsset(id)), characters: referencedCharacters.filter(c => !validCharacter(c)).map(c => c.id) },
      assets: p.assets.filter(x => requiredAssets.includes(x.id)).map(x => ({ ...x, localPath: path.join(this.store.home, x.storedPath) })),
      characters: referencedCharacters, shot, ready: Boolean(binding && requiredAssets.every(validAsset) && referencedCharacters.every(validCharacter)) };
  }
  async plan({ projectId, provider = 'google-flow', variant = 'v1' }) {
    checkId(projectId, 'projectId'); checkId(variant, 'variant'); assert(PROVIDERS.has(provider), 'Unsupported provider');
    return this.store.mutate(state => {
      const project = state.projects[projectId]; assert(project, `Unknown project ${projectId}`);
      const accounts = Object.values(state.accounts).filter(a => a.provider === provider && a.enabled && a.authorized);
      assert(accounts.length > 0, `No authorized enabled accounts for ${provider}`);
      const output = []; const active = Object.values(state.jobs).filter(j => j.status !== 'cancelled');
      const reserved = Object.fromEntries(accounts.map(a => [a.id, active.filter(j => j.accountId === a.id && j.createdAt >= a.creditRecordedAt).reduce((acc, j) => acc + j.estimatedCredits, 0)]));
      const load = Object.fromEntries(accounts.map(a => [a.id, active.filter(j => j.accountId === a.id && NON_FINAL.has(j.status)).length]));
      for (const shot of project.manifest.shots) {
        const existing = Object.values(state.jobs).find(j => j.projectId === projectId && j.shotId === shot.id && j.variant === variant && j.provider === provider);
        if (existing) { output.push(existing); continue; }
        const eligible = accounts.filter(a => a.creditEstimate - reserved[a.id] >= shot.estimatedCredits)
          .sort((a,b) => load[a.id] - load[b.id] || (b.creditEstimate - reserved[b.id]) - (a.creditEstimate - reserved[a.id]) || a.id.localeCompare(b.id));
        if (!eligible.length) { output.push({ shotId: shot.id, status: 'unassigned', reason: 'Insufficient manually reported budget; no automatic account rotation' }); continue; }
        const account = eligible[0]; reserved[account.id] += shot.estimatedCredits; load[account.id]++;
        const job = { id: randomUUID(), projectId, provider, shotId: shot.id, variant, accountId: account.id, estimatedCredits: shot.estimatedCredits, status: 'awaiting_approval', externalJobId: null, resultPath: null, createdAt: now(), updatedAt: now() };
        state.jobs[job.id] = job; output.push(job);
      }
      return { jobs: output, accounting: 'Budget is an estimate entered by operator; actual credit balance is not fetched', notice: MESSAGE };
    });
  }
  async approve(jobId, explicitApproval) {
    assert(explicitApproval === true, 'Paid generation requires explicit approval');
    return this.store.mutate(state => { const job = state.jobs[jobId]; assert(job, 'Unknown job'); assert(job.status === 'awaiting_approval', `Cannot approve ${job.status}`); job.status = 'approved'; job.updatedAt = now(); return job; });
  }
  async claimForDispatch(jobId) {
    return this.store.mutate(state => {
      const job = state.jobs[jobId]; assert(job, 'Unknown job'); assert(job.status === 'approved', `Job is ${job.status}, not approved`);
      const acct = state.accounts[job.accountId]; assert(acct?.authorized && acct.enabled, 'Account not authorized/enabled');
      const inFlight = Object.values(state.jobs).filter(j => j.accountId === acct.id && ['submitting', 'submitted', 'submission_unknown'].includes(j.status)).length;
      assert(inFlight < acct.maxConcurrent, 'Account concurrency cap reached');
      job.status = 'submitting'; job.updatedAt = now(); return { job, account: acct };
    });
  }
  async mark(jobId, status, { externalJobId, resultPath, note } = {}) {
    assert(status !== 'complete', 'Use studio_ingest_result to verify media before completing a job');
    const allowed = { submitting: ['submitted', 'submission_unknown', 'failed'], submitted: ['failed', 'submission_unknown'], submission_unknown: ['submitted', 'failed'], approved: ['cancelled'], awaiting_approval: ['cancelled'] };
    return this.store.mutate(state => {
      const job = state.jobs[jobId]; assert(job, 'Unknown job'); assert(allowed[job.status]?.includes(status), `${job.status} -> ${status} not allowed`);
      if (externalJobId) { checkStr(externalJobId, 'externalJobId'); job.externalJobId = externalJobId; }
      job.status = status; job.note = note || null; job.updatedAt = now(); return job;
    });
  }
  async bundle({ projectId, outputDir }) {
    checkId(projectId, 'projectId'); checkStr(outputDir, 'outputDir');
    const state = await this.store.read(); const p = state.projects[projectId]; assert(p, 'Project missing');
    const target = path.resolve(outputDir); await fs.mkdir(target, { recursive: true });
    const out = clone(p.manifest);
    for (const asset of out.assets) {
      const ext = path.extname(asset.storedPath); const destRel = `assets/${asset.sha256}${ext}`; const dest = path.join(target, destRel);
      await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.copyFile(path.join(this.store.home, asset.storedPath), dest);
      delete asset.storedPath; asset.path = destRel;
    }
    await fs.writeFile(path.join(target, 'production.json'), JSON.stringify(out, null, 2) + '\n');
    return { projectId, outputDir: target, assets: out.assets.length, note: 'Portable manifest and reference images only. Provider-native project/credit balance is not copied.' };
  }
}