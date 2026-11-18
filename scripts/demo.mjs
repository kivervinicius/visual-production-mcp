#!/usr/bin/env node
/** Synthetic/offline MP4 onboarding demo. Does not approve a real story or contact any provider. */
import { promises as fs, constants as fsConstants } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPlan, renderMedia } from '../src/application/deliver/media-composer.mjs';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = text => createHash('sha256').update(text).digest('hex');
const story = 'Uma luz surge na escuridão. Um novo dia começa.';
const demoFolder = 'primeiro-video-demo-v1';
const file = (name, directory) => path.join(directory, name);

async function writeFixedOnce(target, data) {
  try { await fs.writeFile(target, data, { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (await fs.readFile(target, 'utf8') !== data) throw new Error(`Arquivo de demonstração alterado: ${target}. Use um novo STUDIO_HOME para uma demonstração limpa; não sobrescrevemos seu trabalho.`);
  }
}

async function image(target, background, accent) {
  try { await fs.access(target); return; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const tmp = `${target}.tmp-${process.pid}.png`;
  try {
    await exec('ffmpeg', [
      '-hide_banner','-loglevel','error','-nostdin','-y',
      '-f','lavfi','-i',`color=c=${background}:s=180x320:r=1:d=1`,
      '-vf',`drawbox=x=26:y=80:w=128:h=128:color=${accent}:t=fill,drawbox=x=40:y=235:w=100:h=6:color=white@0.8:t=fill`,
      '-frames:v','1','-update','1',tmp,
    ], { timeout: 30000 });
    try { await fs.copyFile(tmp, target, fsConstants.COPYFILE_EXCL); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  } catch (error) {
    throw new Error(`Falha ao criar imagem de demonstração com FFmpeg: ${String(error.stderr || error.message).slice(-500)}`);
  } finally { await fs.rm(tmp, { force: true }); }
}

export async function createDemo({ home = process.env.STUDIO_HOME || path.join(root, '.studio') } = {}) {
  const base = path.join(path.resolve(home), 'demos', demoFolder);
  const media = file('media', base);
  await fs.mkdir(media, { recursive: true, mode: 0o700 });
  await image(file('video-luz.png', media), '0x17203b', '0xf3bf71');
  await image(file('video-dia.png', media), '0x19545a', '0xbde7f0');
  const sourceSha256 = hash(story);
  const production = {
    schemaVersion: 1, id: 'demonstracao-local', title: 'Primeiro vídeo (demonstração)',
    source: { type: 'synthetic-demo', sha256: sourceSha256 }, assets: [], characters: [],
    shots: [{ id: 'luz', sceneId: 'cena-demo', durationSeconds: 2 }, { id: 'dia', sceneId: 'cena-demo', durationSeconds: 2 }],
  };
  const edit = { sourceSha256, storyId: 'demonstracao-local', aspectRatio: '9:16', scenes: [{ sceneId: 'cena-demo', shots: ['video-luz', 'video-dia'] }] };
  const inputs = {
    schemaVersion: 1, productionId: production.id, editManifest: 'EDIT_MANIFEST.json', fps: 24, width: 180, height: 320,
    shots: [
      { stepId: 'video-luz', kind: 'image', file: 'media/video-luz.png', durationSeconds: 2, motion: 'slow_zoom_in' },
      { stepId: 'video-dia', kind: 'image', file: 'media/video-dia.png', durationSeconds: 2, motion: 'slow_pan_right' },
    ],
    audio: null,
    subtitles: [
      { startSeconds: 0, endSeconds: 1.85, text: 'Uma luz surge na escuridão.' },
      { startSeconds: 2, endSeconds: 3.85, text: 'Um novo dia começa.' },
    ],
  };
  await Promise.all([
    writeFixedOnce(file('production.json', base), JSON.stringify(production, null, 2) + '\n'),
    writeFixedOnce(file('EDIT_MANIFEST.json', base), JSON.stringify(edit, null, 2) + '\n'),
    writeFixedOnce(file('RENDER_INPUTS.json', base), JSON.stringify(inputs, null, 2) + '\n'),
    writeFixedOnce(file('LEIA-ME.txt', base), 'DEMONSTRAÇÃO SINTÉTICA. Não há análise por IA, personagens reais, Google Flow, créditos ou aprovação editorial.\n'),
  ]);
  const manifest = file('RENDER_INPUTS.json', base);
  await renderPlan(manifest);
  const result = await renderMedia(manifest);
  return { kind: 'offline-synthetic-demo', status: result.status, reused: result.alreadyRendered, base, video: file('final.mp4', result.outputDir), report: file('QC_REPORT.json', result.outputDir), durationSeconds: result.technical.durationSeconds, hasSubtitles: result.technical.hasEmbeddedSubtitles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = await createDemo();
    console.log('\nSeu vídeo de demonstração foi criado com sucesso.\n');
    console.log(`Vídeo: ${r.video}`);
    console.log(`Relatório técnico: ${r.report}`);
    console.log(`Duração: ${r.durationSeconds}s | Legendas: ${r.hasSubtitles ? 'incluídas' : 'não incluídas'}`);
    console.log('É um exemplo SINTÉTICO, sem conta Google, sem IA, sem cobrança e sem aprovação editorial.');
    console.log('Agora siga docs/COMECE_AQUI.md para produzir uma história sua.\n');
  } catch (error) { console.error(`\nDemonstração interrompida: ${error.message}\nVerifique npm run doctor e docs/PROBLEMAS_COMUNS.md.`); process.exitCode = 1; }
}
