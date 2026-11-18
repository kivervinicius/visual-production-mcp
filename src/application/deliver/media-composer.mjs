/**
 * Local-first Media Composer. No provider calls, browser sessions or spending.
 * A render is a technical preview, never editorial approval of the story.
 * Inputs are confined to the directory containing the render manifest.
 */
import { promises as fs, createReadStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execFile);
const assert = (value, message) => { if (!value) throw new Error(message); };
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const HASH = /^[a-f0-9]{64}$/;
const EXT = {image: new Set(['.png','.jpg','.jpeg','.webp']), video: new Set(['.mp4','.mov','.webm','.mkv'])};
const MOTIONS = new Set(['static','slow_zoom_in','slow_zoom_out','slow_pan_left','slow_pan_right']);
const stableHash = obj => createHash('sha256').update(JSON.stringify(obj)).digest('hex');

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const block of createReadStream(file)) hash.update(block);
  return hash.digest('hex');
}
async function binary(command, args, timeout = 120000) {
  try { return await exec(command, args, { timeout, maxBuffer: 8 * 1024 * 1024 }); }
  catch (error) { throw new Error(`${command} failed: ${(error.stderr || error.message || String(error)).slice(-1600)}`); }
}
async function probe(file) {
  const { stdout } = await binary('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',file], 20000);
  const data = JSON.parse(stdout);
  const video = data.streams?.find(s => s.codec_type === 'video');
  const audio = data.streams?.find(s => s.codec_type === 'audio');
  const subtitles = data.streams?.find(s => s.codec_type === 'subtitle');
  return {video, audio, subtitles, durationSeconds:Number(data.format?.duration || video?.duration || 0)};
}
function safeId(value, name) { assert(typeof value === 'string' && ID.test(value) && !['.','..','constructor','prototype','__proto__'].includes(value), `${name} invalid`); return value; }
function safeRelative(value, name) {
  assert(typeof value === 'string' && value.length && value.length <= 500 && !path.isAbsolute(value), `${name}: relative file path required`);
  assert(!value.includes('\\') && !value.includes('\0') && !value.split('/').some(v => !v || v === '.' || v === '..'), `${name}: unsafe path`);
  return value;
}
async function within(base, relative, name) {
  const file = path.resolve(base, safeRelative(relative, name));
  assert(file.startsWith(base + path.sep), `${name}: outside render package`);
  const real = await fs.realpath(file);
  assert(real.startsWith(base + path.sep), `${name}: symlink escapes render package`);
  const st = await fs.stat(real);
  assert(st.isFile() && st.size > 0 && st.size <= 4 * 1024 ** 3, `${name}: file missing or exceeds size limit`);
  return {file:real,bytes:st.size};
}
function validateDimensions(width, height, fps, aspectRatio) {
  assert(Number.isInteger(width) && width>=64 && width<=1920 && width%2===0, 'width must be even, 64..1920');
  assert(Number.isInteger(height) && height>=64 && height<=1920 && height%2===0, 'height must be even, 64..1920');
  assert([24,25,30].includes(fps), 'fps must be 24, 25 or 30');
  assert(['9:16','16:9','1:1'].includes(aspectRatio), 'Unsupported aspectRatio');
  const ratio = aspectRatio==='9:16'?9/16:aspectRatio==='16:9'?16/9:1;
  assert(Math.abs(width/height-ratio)<0.005, `Output dimensions must match ${aspectRatio}`);
}
const milliseconds = seconds => Math.round(seconds*1000);
function srtTimestamp(seconds) {
  const m = milliseconds(seconds),h=Math.floor(m/3600000),min=Math.floor(m/60000)%60,s=Math.floor(m/1000)%60,ms=m%1000;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}
function makeSrt(subtitles) {
  return subtitles.map((s,i)=>`${i+1}\n${srtTimestamp(s.startSeconds)} --> ${srtTimestamp(s.endSeconds)}\n${s.text}\n`).join('\n');
}
async function inspectRenderConfig(manifestPath) {
  const manifest = await fs.realpath(path.resolve(manifestPath));
  const base = await fs.realpath(path.dirname(manifest));
  const self = await within(base,path.basename(manifest),'renderManifest');
  const spec = JSON.parse(await fs.readFile(self.file,'utf8'));
  assert(spec?.schemaVersion===1,'render schemaVersion must be 1');
  const productionId = safeId(spec.productionId,'productionId');
  const productionFile=await within(base,'production.json','production manifest');
  const production=JSON.parse(await fs.readFile(productionFile.file,'utf8'));
  assert(production.id===productionId,'Render productionId does not match canonical production.json');
  const fps = spec.fps ?? 24;
  assert(Number.isInteger(spec.width)&&Number.isInteger(spec.height), 'Render width and height required');
  assert(Array.isArray(spec.shots)&&spec.shots.length>=1&&spec.shots.length<=250,'shots must contain 1..250 items');
  const editPath = spec.editManifest || 'EDIT_MANIFEST.json';
  const editFile = await within(base,editPath,'editManifest');
  const edit = JSON.parse(await fs.readFile(editFile.file,'utf8'));
  assert(typeof edit.sourceSha256==='string'&&HASH.test(edit.sourceSha256),'Expected canonical story source hash');
  assert(Array.isArray(edit.scenes)&&edit.scenes.length,'EDIT_MANIFEST requires scenes');
  assert(Array.isArray(production.shots),'production.json must declare shots');
  if(production.source?.sha256)assert(production.source.sha256===edit.sourceSha256,'Canonical source hash mismatch between manifests');
  const canonicalShots=new Map(production.shots.map(shot=>[shot.id,shot]));
  validateDimensions(spec.width,spec.height,fps,edit.aspectRatio);
  const expected = edit.scenes.flatMap(scene=>{
    safeId(scene.sceneId,'sceneId');
    assert(Array.isArray(scene.shots)&&scene.shots.length,'Scene shots must be a nonempty list');
    return scene.shots.map(stepId=>({sceneId:scene.sceneId,stepId:safeId(stepId,'stepId')}));
  });
  assert(expected.length===spec.shots.length,'Every canonical shot must have exactly one render source');
  const ids=new Set(expected.map(x=>x.stepId));assert(ids.size===expected.length,'Canonical shot IDs duplicated');
  let totalFrames=0;
  const shots=[];
  const seen=new Set();
  for(let i=0;i<spec.shots.length;i++){
    const v=spec.shots[i];
    assert(v && typeof v==='object',`shot ${i} invalid`);
    assert(v.stepId===expected[i].stepId,`Shot order mismatch at index ${i}: expected ${expected[i].stepId}`);
    assert(!seen.has(v.stepId),`Duplicate shot ${v.stepId}`);seen.add(v.stepId);
    assert(['image','video'].includes(v.kind),`${v.stepId}: kind must be image or video`);
    const duration=Number(v.durationSeconds);
    assert(Number.isInteger(duration)&&duration>=1&&duration<=15,`${v.stepId}: durationSeconds must be 1..15`);
    const canonical=canonicalShots.get(v.stepId.replace(/^video-/,''));
    assert(canonical && canonical.durationSeconds===duration,`${v.stepId}: not the approved canonical duration`);
    const frames=duration*fps;totalFrames+=frames;
    assert(totalFrames<=fps*900,'Total duration exceeds 15 minutes');
    const motion = v.kind==='image'?(v.motion||'static'):'static';
    assert(MOTIONS.has(motion) && (v.kind!=='video' || !v.motion || v.motion==='static'),`${v.stepId}: unsupported motion`);
    const relative = safeRelative(v.file,`${v.stepId}.file`);
    assert(EXT[v.kind].has(path.extname(relative).toLowerCase()),`${v.stepId}: extension does not match kind`);
    const item = await within(base,relative,`${v.stepId}.file`);
    const digest=await sha256(item.file);
    if(v.sha256!==undefined)assert(v.sha256===digest,`${v.stepId}: SHA-256 mismatch`);
    const tech=await probe(item.file);
    assert(tech.video && Number(tech.video.width)>0 && Number(tech.video.height)>0,`${v.stepId}: unreadable image/video`);
    if(v.kind==='video')assert(tech.durationSeconds + 0.08 >= duration,`${v.stepId}: clip shorter than storyboard; trimming cannot add missing action`);
    shots.push({stepId:v.stepId,sceneId:expected[i].sceneId,kind:v.kind,file:item.file,path:relative,sha256:digest,bytes:item.bytes,durationSeconds:duration,frames,motion});
  }
  const durationSeconds=totalFrames/fps;
  const subs=spec.subtitles??[];
  assert(Array.isArray(subs)&&subs.length<=1000,'subtitles must be an array <=1000');
  let end=0;
  const subtitles=subs.map((s,i)=>{
    assert(s && Number.isFinite(s.startSeconds)&&Number.isFinite(s.endSeconds) && s.startSeconds>=0 && s.endSeconds>s.startSeconds && s.endSeconds<=durationSeconds+0.001,`subtitle ${i}: invalid timing`);
    assert(s.startSeconds>=end,`subtitle ${i}: overlap not supported`);
    assert(typeof s.text==='string'&&s.text.trim()&&s.text.length<=500&& !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s.text),`subtitle ${i}: invalid text`);
    end=s.endSeconds;
    return {startSeconds:s.startSeconds,endSeconds:s.endSeconds,text:s.text.trim()};
  });
  let audio=null;
  if(spec.audio!==undefined && spec.audio!==null){
    assert(spec.audio && typeof spec.audio==='object','audio must be null or an object');
    const rel=safeRelative(spec.audio.file,'audio.file');
    assert(['.wav','.mp3','.m4a','.flac','.ogg'].includes(path.extname(rel).toLowerCase()),'Unsupported audio extension');
    const entry=await within(base,rel,'audio.file');
    const inspected=await probe(entry.file);
    assert(inspected.audio,'Audio file has no readable audio stream');
    audio={file:entry.file,path:rel,sha256:await sha256(entry.file),bytes:entry.bytes};
    if(spec.audio.sha256!==undefined)assert(spec.audio.sha256===audio.sha256,'audio SHA-256 mismatch');
  }
  const fingerprint=stableHash({renderSchemaVersion:1,productionId,sourceSha256:edit.sourceSha256,editSha256:await sha256(editFile.file),productionSha256:await sha256(productionFile.file),width:spec.width,height:spec.height,fps,shots:shots.map(({stepId,sceneId,kind,path,sha256,durationSeconds,motion})=>({stepId,sceneId,kind,path,sha256,durationSeconds,motion})),audio:audio&&{path:audio.path,sha256:audio.sha256},subtitles});
  return {base,manifest,productionId,width:spec.width,height:spec.height,fps,aspectRatio:edit.aspectRatio,sourceSha256:edit.sourceSha256,durationSeconds,totalFrames,shots,audio,subtitles,fingerprint};
}

export async function renderPlan(manifestPath) {
  const p=await inspectRenderConfig(manifestPath);
  return {status:'READY_TO_RENDER',productionId:p.productionId,sourceSha256:p.sourceSha256,aspectRatio:p.aspectRatio,width:p.width,height:p.height,fps:p.fps,durationSeconds:p.durationSeconds,shots:p.shots.map(({file,...s})=>s),audio:p.audio&&{path:p.audio.path,sha256:p.audio.sha256},subtitles:p.subtitles.length,renderFingerprint:p.fingerprint,outputFolder:`rendered/${p.fingerprint.slice(0,20)}`,note:'Technical render only; no provider generation, no creative approval and no credits spent'};
}

/** Plan an account-free animatic from an approved StoryGuide source. No Flow account, no workflow. */
export async function offlineStoryPlan(studio, storyId) {
  safeId(storyId,'storyId');
  const state=await studio.store.read();
  const story=state.stories?.[storyId];
  assert(story?.cast && story?.storyboard && story?.approvedAt, 'Offline rendering requires an editor-approved cast and storyboard');
  const home=await fs.realpath(studio.store.home);
  const source=await within(home,story.sourcePath,'story source');
  assert(await sha256(source.file)===story.sha256, 'Approved story source integrity check failed');
  const scenes=story.storyboard.scenes.map(scene=>({sceneId:scene.id,title:scene.title,sourceExcerpt:scene.sourceExcerpt,shots:scene.shots.map(shot=>`video-${shot.id}`)}));
  const shots=story.storyboard.scenes.flatMap(scene=>scene.shots.map(shot=>({id:shot.id,sceneId:scene.id,prompt:shot.motionPrompt,visualPrompt:shot.visualPrompt,sourceExcerpt:shot.sourceExcerpt,aspectRatio:story.aspectRatio,durationSeconds:shot.durationSeconds,characterIds:shot.characterIds||[]})));
  const production={schemaVersion:1,id:storyId,title:story.title,source:{type:'local-story',sha256:story.sha256},assets:[],characters:[],shots};
  const edit={sourceSha256:story.sha256,storyId,aspectRatio:story.aspectRatio,scenes};
  return {storyId,title:story.title,approvedAt:story.approvedAt,packageDir:path.join(home,'stories',storyId,'offline-render'),shotCount:shots.length,durationSeconds:shots.reduce((n,x)=>n+x.durationSeconds,0),production,edit};
}
/** Explicit operator-only export; fixed location and no overwrite of modified source manifests. */
export async function exportOfflineStory(studio,storyId) {
  const planned=await offlineStoryPlan(studio,storyId);
  await fs.mkdir(planned.packageDir,{recursive:true,mode:0o700});
  for(const [name,data] of [['production.json',planned.production],['EDIT_MANIFEST.json',planned.edit]]){
    const file=path.join(planned.packageDir,name),contents=JSON.stringify(data,null,2)+'\n';
    try {await fs.writeFile(file,contents,{flag:'wx',mode:0o600});}
    catch(e){if(e.code!=='EEXIST')throw e;assert(await fs.readFile(file,'utf8')===contents,`Offline export ${name} was modified; refusing overwrite`);}
  }
  const {production,edit,...publicResult}=planned;
  return {...publicResult,files:['production.json','EDIT_MANIFEST.json'],next:'render-init <packageDir>; add local media; render-plan; render',note:'Offline animatic package. No Flow account, images, videos, or credits are generated.'};
}

/** Build a starter manifest from the StoryGuide EDIT_MANIFEST/production.json without modifying either. */
export async function renderTemplate(packageDir,{width,height,fps=24}={}) {
  const base=await fs.realpath(path.resolve(packageDir));
  const edit=JSON.parse(await fs.readFile((await within(base,'EDIT_MANIFEST.json','edit manifest')).file,'utf8'));
  const prod=JSON.parse(await fs.readFile((await within(base,'production.json','production manifest')).file,'utf8'));
  assert(Array.isArray(prod.shots)&&Array.isArray(edit.scenes),'Expected StoryGuide production package');
  const [w,h]=edit.aspectRatio==='9:16'?[720,1280]:edit.aspectRatio==='16:9'?[1280,720]:[720,720];
  width??=w;height??=h;validateDimensions(width,height,fps,edit.aspectRatio);
  const shotById=new Map(prod.shots.map(x=>[x.id,x]));
  const shots=edit.scenes.flatMap(scene=>scene.shots.map(stepId=>{
    safeId(stepId,'stepId');assert(stepId.startsWith('video-'),'Expected generated video step from story compiler');
    const shot=shotById.get(stepId.slice(6));assert(shot,`No canonical shot metadata for ${stepId}`);
    return {stepId,kind:'image',file:`media/${stepId}.png`,durationSeconds:shot.durationSeconds,motion:'slow_zoom_in'};
  }));
  return {schemaVersion:1,productionId:safeId(prod.id,'productionId'),editManifest:'EDIT_MANIFEST.json',fps,width,height,shots,audio:null,subtitles:[]};
}

function filterForShot(p,shot) {
  const normalize=`scale=${p.width}:${p.height}:force_original_aspect_ratio=increase,crop=${p.width}:${p.height},setsar=1`;
  if(shot.kind==='video'||shot.motion==='static')return `${normalize},fps=${p.fps},format=yuv420p`;
  const frames=shot.frames;
  let z='1.1',x='iw/2-(iw/zoom/2)',y='ih/2-(ih/zoom/2)';
  if(shot.motion==='slow_zoom_in')z=`min(zoom+${(0.12/frames).toFixed(8)},1.12)`;
  if(shot.motion==='slow_zoom_out')z=`if(eq(on,0),1.12,max(zoom-${(0.12/frames).toFixed(8)},1.0))`;
  if(shot.motion==='slow_pan_left')x=`(iw-iw/zoom)*(1-on/${Math.max(1,frames-1)})`;
  if(shot.motion==='slow_pan_right')x=`(iw-iw/zoom)*(on/${Math.max(1,frames-1)})`;
  return `${normalize},zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${p.width}x${p.height}:fps=${p.fps},setsar=1,format=yuv420p`;
}
function concatLine(file) { return `file '${file.replaceAll("'", "'\\''")}'`; }
async function renderShot(p,shot,out) {
  const args=['-hide_banner','-nostdin','-loglevel','error','-y'];
  if(shot.kind==='image')args.push('-loop','1','-framerate',String(p.fps));
  args.push('-i',shot.file,'-an','-vf',filterForShot(p,shot),'-frames:v',String(shot.frames),'-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart',out);
  await binary('ffmpeg',args,180000);
  const result=await probe(out);
  assert(result.video && result.video.width===p.width&&result.video.height===p.height,`${shot.stepId}: render dimensions invalid`);
  assert(Math.abs(result.durationSeconds-shot.durationSeconds)<=0.08,`${shot.stepId}: rendered duration mismatch`);
}
async function assertStoredRender(dir,fingerprint) {
  try {
    const receipt=JSON.parse(await fs.readFile(path.join(dir,'QC_REPORT.json'),'utf8'));
    assert(receipt.renderFingerprint===fingerprint,'Existing render has a different fingerprint');
    for(const file of [receipt.output,receipt.subtitles].filter(Boolean)){
      const fileName=path.basename(file.path);
      assert(fileName===file.path, 'Invalid file entry in QC receipt');
      const existing=path.join(dir,fileName);
      assert(await sha256(existing)===file.sha256,`Existing render is modified: ${fileName}`);
    }
    return receipt;
  }catch(e){if(e.code==='ENOENT')return null;throw e;}
}
/** Render each immutable shot independently, then concatenate and optionally mux audio/SRT. */
export async function renderMedia(manifestPath) {
  const p=await inspectRenderConfig(manifestPath);
  const root=path.join(p.base,'rendered');await fs.mkdir(root,{recursive:true,mode:0o700});
  assert((await fs.realpath(root))===root, 'rendered output directory must not be a symlink');
  const target=path.join(root,p.fingerprint.slice(0,20));
  const destInfo=await fs.lstat(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(destInfo)assert(destInfo.isDirectory()&&!destInfo.isSymbolicLink(),'Existing render target must be a real directory');
  const existing=await assertStoredRender(target,p.fingerprint);
  if(existing)return {status:'PREVIEW_RENDERED',alreadyRendered:true,outputDir:target,...existing};
  if(await fs.stat(target).then(()=>true,e=>e.code==='ENOENT'?false:Promise.reject(e)))throw Error('Existing render directory incomplete. Inspect it; never overwrite an uncertain render.');
  const working=await fs.mkdtemp(path.join(root,'.render-'+p.fingerprint.slice(0,12)+'-'));
  let published=false;
  try {
    const segments=[];
    for(let i=0;i<p.shots.length;i++){
      assert(await sha256(p.shots[i].file)===p.shots[i].sha256,`${p.shots[i].stepId}: file changed after render preflight`);
      const filename=`shot-${String(i+1).padStart(4,'0')}.mp4`;
      await renderShot(p,p.shots[i],path.join(working,filename));
      segments.push(filename);
    }
    await fs.writeFile(path.join(working,'concat.txt'),segments.map(x=>concatLine(x)).join('\n')+'\n',{mode:0o600});
    if(p.subtitles.length)await fs.writeFile(path.join(working,'subtitles.srt'),makeSrt(p.subtitles),{mode:0o600});
    if(p.audio)assert(await sha256(p.audio.file)===p.audio.sha256,'Audio changed after render preflight');
    const args=['-hide_banner','-nostdin','-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(working,'concat.txt')];
    if(p.audio)args.push('-i',p.audio.file);
    if(p.subtitles.length)args.push('-i',path.join(working,'subtitles.srt'));
    args.push('-map','0:v:0');
    if(p.audio)args.push('-map','1:a:0');
    if(p.subtitles.length)args.push('-map',`${p.audio?2:1}:s:0`);
    args.push('-c:v','libx264','-preset','veryfast','-crf','23','-r',String(p.fps),'-pix_fmt','yuv420p','-threads','2');
    if(p.audio)args.push('-af','aresample=async=1:first_pts=0,apad','-c:a','aac','-b:a','128k');
    else args.push('-an');
    if(p.subtitles.length)args.push('-c:s','mov_text');
    args.push('-t',String(p.durationSeconds),'-movflags','+faststart',path.join(working,'final.mp4'));
    await binary('ffmpeg',args,240000);
    const out=path.join(working,'final.mp4');
    const tech=await probe(out);
    assert(tech.video?.width===p.width && tech.video.height===p.height,'Final video dimensions mismatch');
    assert(Math.abs(tech.durationSeconds-p.durationSeconds)<=0.15,'Final video duration mismatch');
    assert(Boolean(tech.audio)===Boolean(p.audio),'Final audio-track mismatch');
    assert(Boolean(tech.subtitles)===Boolean(p.subtitles.length),'Final subtitle-track mismatch');
    const result={schemaVersion:1,status:'PREVIEW_RENDERED',productionId:p.productionId,sourceSha256:p.sourceSha256,renderFingerprint:p.fingerprint,verifiedAt:new Date().toISOString(),technical:{durationSeconds:tech.durationSeconds,width:tech.video.width,height:tech.video.height,fps:p.fps,codec:tech.video.codec_name,hasAudio:!!tech.audio,hasEmbeddedSubtitles:!!tech.subtitles},inputs:p.shots.map(s=>({stepId:s.stepId,sceneId:s.sceneId,sha256:s.sha256,durationSeconds:s.durationSeconds,kind:s.kind,motion:s.motion})),output:{path:'final.mp4',sha256:await sha256(out),bytes:(await fs.stat(out)).size},subtitles:p.subtitles.length?{path:'subtitles.srt',sha256:await sha256(path.join(working,'subtitles.srt'))}:null,notes:['Local technical preview only; no editorial approval or real Flow generation is implied','Generation costs are not measured by the Media Composer']};
    await fs.writeFile(path.join(working,'QC_REPORT.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
    await fs.writeFile(path.join(working,'RENDER_MANIFEST.json'),JSON.stringify({productionId:p.productionId,renderFingerprint:p.fingerprint,sourceSha256:p.sourceSha256,inputs:result.inputs,audio:p.audio&&{sha256:p.audio.sha256,path:p.audio.path},subtitles:p.subtitles},null,2)+'\n',{mode:0o600});
    await fs.rename(working,target);
    published=true;
    return {status:'PREVIEW_RENDERED',alreadyRendered:false,outputDir:target,...result};
  }finally{if(!published)await fs.rm(working,{recursive:true,force:true});}
}

/** Operator writes a template only when explicitly requested. Never overwrites an existing mapping. */
export async function writeRenderTemplate(packageDir,options={}) {
  const template=await renderTemplate(packageDir,options);
  const target=path.join(await fs.realpath(path.resolve(packageDir)),'RENDER_INPUTS.json');
  await fs.writeFile(target,JSON.stringify(template,null,2)+'\n',{flag:'wx',mode:0o600});
  return {path:target,shots:template.shots.length,mediaDirectory:'media',note:'Place/edit shot files explicitly; render-plan will fail closed until every file is present.'};
}
