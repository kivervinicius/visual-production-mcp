import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { diagnose } from '../scripts/doctor.mjs';
import { createDemo } from '../scripts/demo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('doctor is read-only and returns independently actionable checks', async () => {
  const report = diagnose();
  assert.equal(report.version, 1);
  assert.equal(typeof report.planningReady, 'boolean');
  assert.equal(typeof report.renderReady, 'boolean');
  assert.equal(typeof report.codecs.h264, 'boolean');
  assert.match(report.note, /does not test or connect Google Flow/);
  const output = JSON.parse(execFileSync(process.execPath, ['scripts/doctor.mjs','--json'], { cwd: root, encoding: 'utf8' }));
  assert.equal(output.platform, process.platform);
  assert.equal(typeof output.studioHome,'string');
});

test('first-use demo creates a real video, is offline and resumes without overwriting', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'vpm-beginner-'));
  try {
    const first = await createDemo({ home });
    assert.equal(first.status, 'PREVIEW_RENDERED');
    assert.equal(first.reused, false);
    assert.equal(first.durationSeconds, 4);
    assert.equal(first.hasSubtitles, true);
    const original = await fs.readFile(first.video);
    const report = JSON.parse(await fs.readFile(first.report,'utf8'));
    assert.equal(report.output.sha256,sha(original));
    assert.equal(report.technical.hasAudio, false);
    assert.equal(report.status, 'PREVIEW_RENDERED');
    assert.equal(report.technical.hasEmbeddedSubtitles, true);
    const repeat = await createDemo({ home });
    assert.equal(repeat.reused, true);
    assert.equal(repeat.video, first.video);
    assert.deepEqual(await fs.readFile(repeat.video), original);
    const outside = await fs.readdir(home);
    assert.deepEqual(outside, ['demos']);
    const inputs=path.join(first.base,'RENDER_INPUTS.json');
    await fs.appendFile(inputs,'\n');
    await assert.rejects(createDemo({home}),/Arquivo de demonstração alterado/);
  } finally { await fs.rm(home, {recursive:true,force:true}); }
});
