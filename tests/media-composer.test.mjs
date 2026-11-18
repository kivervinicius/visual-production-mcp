import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import {renderPlan,renderMedia,renderTemplate,writeRenderTemplate,offlineStoryPlan,exportOfflineStory} from '../src/application/deliver/media-composer.mjs';

const run=promisify(execFile);
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const validSha='a'.repeat(64);
async function makeFixture() {
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'vpm-composer-'));
  await fs.mkdir(path.join(base,'media'));
  const file=path.join(base,'media','video-a.png');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=red:s=180x320:d=1','-frames:v','1','-update','1',file]);
  const file2=path.join(base,'media','video-b.png');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=180x320:d=1','-frames:v','1','-update','1',file2]);
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:duration=2.2','-ac','1',path.join(base,'voice.wav')]);
  const edit={sourceSha256:validSha,storyId:'example',aspectRatio:'9:16',scenes:[{sceneId:'s1',shots:['video-a','video-b']}]};
  await fs.writeFile(path.join(base,'EDIT_MANIFEST.json'),JSON.stringify(edit));
  await fs.writeFile(path.join(base,'production.json'),JSON.stringify({id:'example-prod',shots:[{id:'a',durationSeconds:2},{id:'b',durationSeconds:2}]}));
  const spec={schemaVersion:1,productionId:'example-prod',fps:24,width:180,height:320,editManifest:'EDIT_MANIFEST.json',shots:[
    {stepId:'video-a',kind:'image',file:'media/video-a.png',durationSeconds:2,motion:'slow_zoom_in'},
    {stepId:'video-b',kind:'image',file:'media/video-b.png',durationSeconds:2,motion:'slow_pan_right'}
  ],audio:{file:'voice.wav'},subtitles:[{startSeconds:0,endSeconds:1.2,text:'Primeira fala'},{startSeconds:2,endSeconds:3.5,text:'Segunda fala'}]};
  const save=async()=>fs.writeFile(path.join(base,'RENDER_INPUTS.json'),JSON.stringify(spec,null,2));
  await save();
  return {base,spec,save,manifest:path.join(base,'RENDER_INPUTS.json'),file,file2};
}
async function withFixture(fn) { const f=await makeFixture();try{return await fn(f);}finally{await fs.rm(f.base,{recursive:true,force:true});} }

test('renderTemplate follows canonical StoryGuide order and writes no files',async()=>withFixture(async({base})=>{
  const template=await renderTemplate(base,{width:180,height:320});
  assert.equal(template.productionId,'example-prod');
  assert.deepEqual(template.shots.map(x=>x.stepId),['video-a','video-b']);
  assert.equal(template.shots[1].durationSeconds,2);
}));

test('writeRenderTemplate never overwrites user mappings',async()=>withFixture(async({base})=>{
  await fs.rm(path.join(base,'RENDER_INPUTS.json'));
  const result=await writeRenderTemplate(base,{width:180,height:320});
  assert.equal(result.shots,2);
  await assert.rejects(writeRenderTemplate(base,{width:180,height:320}),e=>e.code==='EEXIST');
}));

test('renders real mp4, embedded subtitles, audio, sidecar SRT and SHA report',async()=>withFixture(async({manifest})=>{
  const plan=await renderPlan(manifest);assert.equal(plan.status,'READY_TO_RENDER');assert.equal(plan.durationSeconds,4);
  const result=await renderMedia(manifest);
  assert.equal(result.status,'PREVIEW_RENDERED');assert.equal(result.alreadyRendered,false);
  assert.equal(result.technical.codec,'h264');assert.equal(result.technical.hasAudio,true);
  assert.equal(result.technical.hasEmbeddedSubtitles,true);
  assert.equal(result.technical.width,180);assert.equal(result.technical.height,320);
  const video=await fs.readFile(path.join(result.outputDir,'final.mp4'));
  assert.equal(hash(video),result.output.sha256);
  const srt=await fs.readFile(path.join(result.outputDir,'subtitles.srt'),'utf8');
  assert.match(srt,/00:00:00,000 --> 00:00:01,200/);assert.match(srt,/Segunda fala/);
  const manifestCopy=JSON.parse(await fs.readFile(path.join(result.outputDir,'RENDER_MANIFEST.json'),'utf8'));
  assert.equal(manifestCopy.inputs.length,2);
  const repeat=await renderMedia(manifest);assert.equal(repeat.alreadyRendered,true);assert.equal(repeat.output.sha256,result.output.sha256);
}));

test('can render supplied video clip beside a static image, without audio',async()=>withFixture(async(f)=>{
  const clip='media/video-a.mp4';
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=180x320:rate=24:duration=2','-c:v','libx264','-pix_fmt','yuv420p',path.join(f.base,clip)]);
  f.spec.shots[0]={...f.spec.shots[0],file:clip,kind:'video',motion:'static'};f.spec.shots[1].motion='slow_zoom_out';f.spec.audio=null;f.spec.subtitles=[];await f.save();
  const result=await renderMedia(f.manifest);assert.equal(result.technical.hasAudio,false);assert.equal(result.technical.hasEmbeddedSubtitles,false);assert.equal(result.technical.durationSeconds,4);
}));

test('rejects reordering and dropping storyboard shots',async()=>withFixture(async(f)=>{
  f.spec.shots.reverse();await f.save();await assert.rejects(renderPlan(f.manifest),/Shot order mismatch/);
  f.spec.shots.pop();await f.save();await assert.rejects(renderPlan(f.manifest),/Every canonical shot/);
}));

test('rejects wrong media digest and missing file',async()=>withFixture(async(f)=>{
  f.spec.shots[0].sha256='0'.repeat(64);await f.save();await assert.rejects(renderPlan(f.manifest),/SHA-256 mismatch/);
  f.spec.shots[0].sha256=undefined;f.spec.shots[0].file='media/missing.png';await f.save();await assert.rejects(renderPlan(f.manifest),/ENOENT/);
}));

test('rejects traversal and symlink escape',async()=>withFixture(async(f)=>{
  f.spec.shots[0].file='../outside.png';await f.save();await assert.rejects(renderPlan(f.manifest),/unsafe path/);
  f.spec.shots[0].file='media/escape.png';await fs.symlink('/etc/hosts',path.join(f.base,'media','escape.png'));await f.save();await assert.rejects(renderPlan(f.manifest),/symlink escapes/);
}));

test('rejects mismatched aspect, excessive scene duration and invalid subtitles',async()=>withFixture(async(f)=>{
  f.spec.width=320;await f.save();await assert.rejects(renderPlan(f.manifest),/Output dimensions/);
  f.spec.width=180;f.spec.shots[0].durationSeconds=16;await f.save();await assert.rejects(renderPlan(f.manifest),/durationSeconds must be/);
  f.spec.shots[0].durationSeconds=2;f.spec.subtitles[1].startSeconds=0.8;await f.save();await assert.rejects(renderPlan(f.manifest),/overlap/);
}));

test('rejects shorter video than requested canonical shot',async()=>withFixture(async(f)=>{
  const clip='media/video-a.mp4';
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=180x320:rate=24:duration=1','-c:v','libx264','-pix_fmt','yuv420p',path.join(f.base,clip)]);
  f.spec.shots[0].file=clip;f.spec.shots[0].kind='video';f.spec.shots[0].motion='static';await f.save();
  await assert.rejects(renderPlan(f.manifest),/clip shorter than storyboard/);
}));

test('tampered existing render fails rather than overwriting output',async()=>withFixture(async(f)=>{
  const out=await renderMedia(f.manifest);await fs.appendFile(path.join(out.outputDir,'final.mp4'),'unexpected');
  await assert.rejects(renderMedia(f.manifest),/Existing render is modified/);
}));

test('edited input changes fingerprint and creates a separate immutable render',async()=>withFixture(async(f)=>{
  const first=await renderMedia(f.manifest);
  f.spec.shots[1].motion='static';await f.save();
  const second=await renderMedia(f.manifest);
  assert.notEqual(first.outputDir,second.outputDir);
  assert.notEqual(first.renderFingerprint,second.renderFingerprint);
  await fs.access(path.join(first.outputDir,'final.mp4'));
}));

test('refuses to shorten a canonical storyboard duration',async()=>withFixture(async f=>{
  f.spec.shots[0].durationSeconds=1;await f.save();await assert.rejects(renderPlan(f.manifest),/not the approved canonical duration/);
}));

test('E2E from a real approved StoryGuide package to a physical offline MP4',async()=>{
  const {Studio}=await import('../src/core.mjs');
  const {StoryGuide}=await import('../src/story-guide.mjs');
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'vpm-story-render-'));
  try {
    const studio=new Studio(path.join(home,'.studio'));const guide=new StoryGuide(studio);
    const source='Mara abre a porta. O farol apaga.';
    await guide.create({id:'pilot',title:'Farol',storyText:source,aspectRatio:'9:16'});
    await guide.submitCast('pilot',{visualStyle:'2D minimal shapes, flat lighting',characters:[{id:'mara',name:'Mara',sourceExcerpt:'Mara abre a porta.',designPrompt:'Mara in a blue coat'}],locations:[],assumptions:['Coat chosen for design only']});
    await guide.submitStoryboard('pilot',{scenes:[{id:'entrance',title:'A porta',sourceExcerpt:'Mara abre a porta. O farol apaga.',shots:[{id:'door',sourceExcerpt:'Mara abre a porta.',visualPrompt:'Door and silhouette',motionPrompt:'Camera pushes in',durationSeconds:1,characterIds:['mara']},{id:'dark',sourceExcerpt:'O farol apaga.',visualPrompt:'Lighthouse goes dark',motionPrompt:'Camera holds',durationSeconds:1,characterIds:[]}]}]});
    await guide.approve('pilot');
    await studio.registerAccount({id:'local',provider:'google-flow',label:'No generation in this test',authorized:true,creditEstimate:100});
    const pkg=await guide.prepare({storyId:'pilot',accountId:'local',videoEstimatedCredits:10});
    const proposed=await renderTemplate(pkg.packageDir,{width:180,height:320});
    await fs.mkdir(path.join(pkg.packageDir,'media'));
    const original=path.join(home,'fixture.png');
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=green:s=180x320:d=1','-frames:v','1','-update','1',original]);
    for(const shot of proposed.shots)await fs.copyFile(original,path.join(pkg.packageDir,shot.file));
    await fs.writeFile(path.join(pkg.packageDir,'RENDER_INPUTS.json'),JSON.stringify(proposed,null,2));
    const result=await renderMedia(path.join(pkg.packageDir,'RENDER_INPUTS.json'));
    assert.equal(result.technical.durationSeconds,2);
    assert.equal(result.inputs.length,2);
    assert.equal(result.status,'PREVIEW_RENDERED');
    await fs.access(path.join(result.outputDir,'final.mp4'));
    assert.equal((await new StoryGuide(studio).status('pilot')).completed.story,true);
  }finally{await fs.rm(home,{recursive:true,force:true});}
});


test('offline approved StoryGuide can export and render without any Flow account',async()=>{
  const {Studio}=await import('../src/core.mjs');
  const {StoryGuide}=await import('../src/story-guide.mjs');
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'vpm-no-flow-'));
  try{
    const studio=new Studio(path.join(home,'.studio'));const guide=new StoryGuide(studio);
    await guide.create({id:'solo',title:'Offline',storyText:'A luz apaga.',aspectRatio:'9:16'});
    await guide.submitCast('solo',{visualStyle:'Ink noir',characters:[],locations:[],assumptions:[]});
    await guide.submitStoryboard('solo',{scenes:[{id:'scene',title:'Luz',sourceExcerpt:'A luz apaga.',shots:[{id:'light',sourceExcerpt:'A luz apaga.',visualPrompt:'Black wall',motionPrompt:'Slow zoom',durationSeconds:1,characterIds:[]}]}]});
    await assert.rejects(offlineStoryPlan(studio,'solo'),/editor-approved/);
    await guide.approve('solo');
    const report=await exportOfflineStory(studio,'solo');
    assert.equal(report.shotCount,1);
    const again=await exportOfflineStory(studio,'solo');assert.equal(again.packageDir,report.packageDir);
    const inputs=await renderTemplate(report.packageDir,{width:180,height:320});
    await fs.mkdir(path.join(report.packageDir,'media'));
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=black:s=180x320:d=1','-frames:v','1','-update','1',path.join(report.packageDir,inputs.shots[0].file)]);
    await fs.writeFile(path.join(report.packageDir,'RENDER_INPUTS.json'),JSON.stringify(inputs));
    const rendered=await renderMedia(path.join(report.packageDir,'RENDER_INPUTS.json'));
    assert.equal(rendered.technical.durationSeconds,1);
    assert.equal(rendered.status,'PREVIEW_RENDERED');
    const state=await studio.store.read(); assert.deepEqual(Object.keys(state.accounts),[]);
    await fs.access(path.join(rendered.outputDir,'final.mp4'));
  }finally{await fs.rm(home,{recursive:true,force:true});}
});
