#!/usr/bin/env node
/** Local, read-only environment check. Never opens a Google session or changes the filesystem. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 8000, windowsHide: true });
  return { ok: !result.error && result.status === 0, output: `${result.stdout || ''}\n${result.stderr || ''}`, error: result.error?.message || (result.status !== 0 ? `exit ${result.status}` : undefined) };
};

export function diagnose() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const npm = process.platform === 'win32' ? run('cmd.exe', ['/d','/s','/c','npm --version']) : run('npm', ['--version']);
  const ffmpeg = run('ffmpeg', ['-version']);
  const ffprobe = run('ffprobe', ['-version']);
  const encoders = ffmpeg.ok ? run('ffmpeg', ['-hide_banner', '-encoders']) : { ok: false, output: '' };
  const codecs = {
    h264: encoders.ok && /\blibx264\b/.test(encoders.output),
    aac: encoders.ok && /\baac\b/.test(encoders.output),
    subtitles: encoders.ok && /\bmov_text\b/.test(encoders.output),
  };
  const dependencies = ['@modelcontextprotocol/client', '@modelcontextprotocol/server', 'zod'].every(name => existsSync(path.join(root, 'node_modules', ...name.split('/'), 'package.json')));
  const renderReady = ffmpeg.ok && ffprobe.ok && codecs.h264 && codecs.aac && codecs.subtitles;
  return {
    version: 1,
    platform: process.platform,
    node: { version: process.versions.node, ok: nodeMajor >= 20 },
    npm: { version: npm.ok ? npm.output.trim().split('\n')[0] : null, ok: npm.ok },
    packages: { installed: dependencies },
    ffmpeg: { available: ffmpeg.ok, version: ffmpeg.ok ? ffmpeg.output.trim().split('\n')[0] : null },
    ffprobe: { available: ffprobe.ok },
    codecs,
    planningReady: nodeMajor >= 20 && npm.ok && dependencies,
    renderReady,
    studioHome: path.resolve(process.env.STUDIO_HOME || path.join(root, '.studio')),
    note: 'Read-only diagnostic: does not test or connect Google Flow, does not authorize credits.',
  };
}

function message(report) {
  const flag = yes => yes ? 'OK' : 'PENDENTE';
  const items = [
    ['Node.js 20+', report.node.ok, `versão ${report.node.version}`],
    ['npm', report.npm.ok, report.npm.version ? `versão ${report.npm.version}` : 'instale Node.js LTS'],
    ['Dependências MCP', report.packages.installed, 'execute npm install na pasta do projeto'],
    ['FFmpeg', report.ffmpeg.available, 'instale o FFmpeg e abra um novo terminal'],
    ['FFprobe', report.ffprobe.available, 'vem com uma instalação completa do FFmpeg'],
    ['H.264 (libx264)', report.codecs.h264, 'necessário para o MP4'],
    ['Áudio AAC', report.codecs.aac, 'necessário para áudio opcional'],
    ['Legendas mov_text', report.codecs.subtitles, 'necessário para legendas embutidas'],
  ];
  console.log('\nVisual Production MCP — diagnóstico da sua máquina\n');
  for (const [name, ok, hint] of items) console.log(`[${flag(ok)}] ${name} — ${hint}`);
  console.log(`\nPasta dos projetos: ${report.studioHome}`);
  console.log(`Planejamento com agente: ${report.planningReady ? 'PRONTO' : 'REQUER AJUSTES'}`);
  console.log(`Montagem MP4 local: ${report.renderReady ? 'PRONTO' : 'REQUER AJUSTES'}`);
  console.log(report.renderReady ? '\nPróximo passo: npm run demo (gera um vídeo de demonstração sem Google Flow).' : '\nPara gerar MP4: instale FFmpeg completo, abra outro terminal e execute npm run doctor novamente.');
  console.log('Nenhum login, arquivo ou crédito foi alterado por este diagnóstico.\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = diagnose();
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else message(report);
  if (process.argv.includes('--strict') && (!report.planningReady || !report.renderReady)) process.exitCode = 1;
}
