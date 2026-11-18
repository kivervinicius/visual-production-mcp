/** Guided story-to-production planning. This module never uses paid provider operations.
 * Narrative interpretation is performed by a connected human/AI agent; the MCP
 * validates provenance and persists its explicitly reviewed decisions.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { WorkflowStudio } from './workflows.mjs';

const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const LIBRARY_ID = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,159}$/;
const validLibraryId = value => LIBRARY_ID.test(value) && !value.split('/').some(x => ['__proto__','prototype','constructor','.','..',''].includes(x));
const SHA = text => createHash('sha256').update(text, 'utf8').digest('hex');
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const validId = (v, key) => { assert(typeof v === 'string' && ID.test(v) && !['__proto__','constructor','prototype','.','..'].includes(v), `${key}: invalid identifier`); return v; };
const text = (v, key, limit=20000) => { assert(typeof v === 'string' && v.trim() && v.length <= limit, `${key}: nonempty text <= ${limit} required`); return v.trim(); };
const list = (v, key) => { assert(Array.isArray(v), `${key} must be an array`); return v; };
const unique = (rows,key) => { const keys=rows.map(r=>validId(r?.id,key));assert(new Set(keys).size===keys.length,`${key}: duplicate identifier`); };
const idref = (source, quote, key) => { text(quote,key,20000); assert(source.includes(quote), `${key}: excerpt is not an exact quotation from the original story`); };
const atomic = async (file, contents) => { const tmp=`${file}.${randomUUID()}.tmp`;await fs.writeFile(tmp,contents,{mode:0o600});await fs.rename(tmp,file); };
const now = () => new Date().toISOString();
const dirs = (home,id) => path.join(home,'stories',validId(id,'storyId'));
const safeName = id => id.replace(/[^A-Za-z0-9._-]/g,'-');
function coverage(source,excerpts) {
  const used=new Uint8Array(source.length);
  for(const excerpt of excerpts){let start=source.indexOf(excerpt);if(start>=0)used.fill(1,start,start+excerpt.length);}
  const nonspace=Array.from(source).filter(c=>!(/\s/.test(c))).length;
  let hit=0; for(let i=0;i<source.length;i++)if(used[i]&&!/\s/.test(source[i]))hit++;
  return Math.round(100*hit/Math.max(1,nonspace));
}
const instructions={
  cast:'Leia a história original por completo com studio_story_source. Extraia personagens e cenários ancorados em trechos literais. Defina visualStyle e descreva propostas de aparência; liste como assumptions tudo que não está explícito. Envie a studio_story_submit_cast. Não gere mídia.',
  storyboard:'Divida a história inteira em cenas ordenadas e planos de 4-10s apropriados ao modelo selecionado (a duração real será validada pelo provedor). Cada cena e plano exige sourceExcerpt exato do texto original, personagens conhecidos, visualPrompt e motionPrompt. Envie studio_story_submit_storyboard. Não gere mídia.',
  approval:'Mostre o elenco, as hipóteses criativas, o storyboard e a cobertura do texto. Peça ao operador que revise e aprove: npm run operator -- story-approve <storyId>. Não presuma aprovação da IA.',
  account:'Cadastre uma sessão autorizada com studio_register_account (ou escolha uma já registrada). Orçamento e disponibilidade do Flow são estimativas; nenhum crédito será usado nesta fase.',
  prepare:'Use studio_story_prepare para compilar production.json, workflow.json, a bíblia de personagens, storyboard e ordem de edição. Isso não cria nada no Google Flow.',
  production:'Verifique studio_workflow_plan, associe o projeto remoto, configure adapters.json e teste studio_workflow_inspect_step. Submeta só etapas autorizadas; cada etapa remota requer aprovação explícita. Faça revisão humana dos resultados e montagem final.'
};
function validateCast(cast,source) {
  assert(cast && typeof cast==='object' && !Array.isArray(cast),'cast must be an object');
  const visualStyle=text(cast.visualStyle,'visualStyle',8000);
  const characters=list(cast.characters,'characters');const locations=list(cast.locations,'locations');
  assert(characters.length<=100&&locations.length<=100,'Maximum 100 characters and 100 locations');
  unique(characters,'character'); unique(locations,'location');
  for(const c of characters){text(c.name,'character name',200);text(c.designPrompt,'character designPrompt');idref(source,c.sourceExcerpt,`${c.id}.sourceExcerpt`);if(c.libraryId!==undefined)assert(validLibraryId(c.libraryId),'Invalid character libraryId');if(c.libraryVersion!==undefined)assert(Number.isInteger(c.libraryVersion)&&c.libraryVersion>0&&c.libraryId,'Invalid character libraryVersion');}
  for(const l of locations){text(l.name,'location name',200);text(l.designPrompt,'location designPrompt');idref(source,l.sourceExcerpt,`${l.id}.sourceExcerpt`);if(l.libraryId!==undefined)assert(validLibraryId(l.libraryId),'Invalid location libraryId');if(l.libraryVersion!==undefined)assert(Number.isInteger(l.libraryVersion)&&l.libraryVersion>0&&l.libraryId,'Invalid location libraryVersion');}
  if(cast.styleLibraryId!==undefined)assert(validLibraryId(cast.styleLibraryId),'Invalid styleLibraryId');
  const assumptions=list(cast.assumptions||[],'assumptions');assert(assumptions.length<=100,'Too many assumptions');assumptions.forEach((a,i)=>text(a,`assumption ${i}`,2000));
  return structuredClone({visualStyle,characters,locations,assumptions,...(cast.styleLibraryId?{styleLibraryId:cast.styleLibraryId}:{})});
}
function validateStoryboard(board,source,cast) {
  assert(board && typeof board==='object' && !Array.isArray(board),'storyboard must be an object');
  const scenes=list(board.scenes,'scenes');assert(scenes.length>=1&&scenes.length<=100,'storyboard: 1..100 scenes');unique(scenes,'scene');
  const knownCharacters=new Set(cast.characters.map(x=>x.id));const knownLocations=new Set(cast.locations.map(x=>x.id));
  let count=0; const shotIds=new Set();
  for(const s of scenes){
    text(s.title,'scene title',200);idref(source,s.sourceExcerpt,`${s.id}.sourceExcerpt`);
    if(s.locationId!==undefined&&s.locationId!==null)assert(knownLocations.has(s.locationId),`${s.id}: unknown location`);
    const shots=list(s.shots,`${s.id}.shots`);assert(shots.length>=1&&shots.length<=80,`${s.id}: 1..80 shots`);
    unique(shots,`${s.id}.shots`);
    for(const shot of shots){
      count++;validId(shot.id,'shot.id');assert(!shotIds.has(shot.id),`Shot ID repeated across scenes: ${shot.id}`);shotIds.add(shot.id);
      idref(source,shot.sourceExcerpt,`${shot.id}.sourceExcerpt`);
      text(shot.visualPrompt,`${shot.id}.visualPrompt`);text(shot.motionPrompt,`${shot.id}.motionPrompt`);
      assert(Number.isInteger(shot.durationSeconds)&&shot.durationSeconds>=1&&shot.durationSeconds<=15,`${shot.id}: durationSeconds must be 1..15; live model may be stricter`);
      list(shot.characterIds||[],`${shot.id}.characterIds`).forEach(id=>assert(knownCharacters.has(id),`${shot.id}: unknown character ${id}`));
      if(shot.camera!==undefined)text(shot.camera,`${shot.id}.camera`,1500);
      if(shot.audio!==undefined)text(shot.audio,`${shot.id}.audio`,1500);
    }
  }
  assert(count<=250,'Maximum 250 shots per production');
  const normalized=structuredClone({scenes});
  for(const scene of normalized.scenes)for(const shot of scene.shots)shot.characterIds??=[];
  return normalized;
}
function next(story,state) {
  if(!story.cast)return {stage:'cast',instruction:instructions.cast,tool:'studio_story_submit_cast'};
  if(!story.storyboard)return {stage:'storyboard',instruction:instructions.storyboard,tool:'studio_story_submit_storyboard'};
  if(!story.approvedAt)return {stage:'approval',instruction:instructions.approval.replace('<storyId>',story.id),tool:'operator:story-approve'};
  if(!story.prepared)return {stage:'account',instruction:instructions.account+' '+instructions.prepare,tool:'studio_story_prepare'};
  return {stage:'production',instruction:instructions.production,tool:'studio_workflow_plan',workflowId:story.prepared.workflowId};
}
export class StoryGuide {
  constructor(studio){this.studio=studio;this.workflows=new WorkflowStudio(studio);}
  async create({id,title,storyText,storyPath,aspectRatio='9:16',language='pt-BR'}) {
    validId(id,'storyId');text(title,'title',200);
    assert(Boolean(storyText)!==Boolean(storyPath),'Supply exactly one of storyText or storyPath');
    assert(['9:16','16:9'].includes(aspectRatio),'aspectRatio must be 9:16 or 16:9');
    text(language,'language',40);
    let source=storyText;
    if(storyPath){const p=path.resolve(storyPath);const stat=await fs.stat(p);assert(stat.size<=200000,'Story file too large (200KB maximum)');source=await fs.readFile(p,'utf8');}
    text(source,'story',200000);assert(!source.includes('\0'),'Binary stories are not supported');
    const digest=SHA(source);
    return this.studio.store.mutate(async state=>{
      state.stories??={};const existing=state.stories[id];
      if(existing){assert(existing.sha256===digest,'Story ID already exists with different source; use a new ID for a changed version');return {id,alreadyExists:true,sha256:digest,next:next(existing,state)};}
      const folder=dirs(this.studio.store.home,id);await fs.mkdir(folder,{recursive:true,mode:0o700});
      await atomic(path.join(folder,'source.md'),source);
      const entry={id,title,sha256:digest,aspectRatio,language,sourcePath:path.relative(this.studio.store.home,path.join(folder,'source.md')),createdAt:now(),cast:null,storyboard:null,approvedAt:null,prepared:null};
      state.stories[id]=entry;
      return {id,sha256:digest,storyLength:source.length,next:next(entry,state)};
    });
  }
  async source(id,{offset=0,length=8000}={}){
    const state=await this.studio.store.read(),story=state.stories?.[validId(id,'storyId')];assert(story,'Story not found');
    assert(Number.isInteger(offset)&&offset>=0,'offset must be a nonnegative integer');assert(Number.isInteger(length)&&length>=1&&length<=12000,'length must be 1..12000');
    const source=await fs.readFile(path.join(this.studio.store.home,story.sourcePath),'utf8');
    assert(SHA(source)===story.sha256,'Story source integrity check failed');
    return {id,sha256:story.sha256,offset,length:Math.min(length,Math.max(0,source.length-offset)),totalLength:source.length,content:source.slice(offset,offset+length),hasMore:offset+length<source.length};
  }
  async submitCast(id,cast){
    const state=await this.studio.store.read(),story=state.stories?.[id];assert(story,'Story not found');
    const full=await fs.readFile(path.join(this.studio.store.home,story.sourcePath),'utf8');assert(SHA(full)===story.sha256,'Story source changed');
    const normalized=validateCast(cast,full);
    return this.studio.store.mutate(state=>{
      const s=state.stories[id];assert(!s.approvedAt && !s.storyboard,'Cast is frozen after storyboard submission; create a new story version to revise it');
      s.cast=normalized;s.updatedAt=now();return {id,characters:normalized.characters.length,locations:normalized.locations.length,assumptions:normalized.assumptions,next:next(s,state)};
    });
  }
  async submitStoryboard(id,board){
    const state=await this.studio.store.read(),story=state.stories?.[validId(id,'storyId')];assert(story?.cast,'Submit cast before storyboard');
    const full=await fs.readFile(path.join(this.studio.store.home,story.sourcePath),'utf8');assert(SHA(full)===story.sha256,'Story source changed');
    const normalized=validateStoryboard(board,full,story.cast);
    const percent=coverage(full,normalized.scenes.map(s=>s.sourceExcerpt));
    return this.studio.store.mutate(state=>{
      const s=state.stories[id];assert(!s.approvedAt,'Storyboard already approved; create a new story version');
      assert(JSON.stringify(s.cast)===JSON.stringify(story.cast),'Cast changed during preparation, retry');
      s.storyboard=normalized;s.storyCoveragePercent=percent;s.updatedAt=now();
      return {id,scenes:normalized.scenes.length,shots:normalized.scenes.reduce((n,s)=>n+s.shots.length,0),sourceCoveragePercent:percent,
        warnings:percent<70?['Less than 70% of the original story text is covered by scene excerpts; check for omitted passages before approving.']:[],next:next(s,state)};
    });
  }
  async approve(id){
    return this.studio.store.mutate(state=>{
      const s=state.stories?.[validId(id,'storyId')];assert(s?.cast&&s.storyboard,'Cast and storyboard are required');
      if(s.approvedAt)return {id,alreadyApproved:true,approvedAt:s.approvedAt};
      const rejected=state.productionGuides?.[id]?.review;
      const currentRevision=SHA(JSON.stringify({sourceSha256:s.sha256,cast:s.cast,storyboard:s.storyboard}));
      assert(!(rejected?.decision==='request_changes'&&rejected.revision===currentRevision),'Rejected draft must change before editorial approval');
      s.approvedAt=now();return {id,approvedAt:s.approvedAt,sourceCoveragePercent:s.storyCoveragePercent,assumptions:s.cast.assumptions,next:next(s,state)};
    });
  }
  async status(id){
    const state=await this.studio.store.read(),s=state.stories?.[validId(id,'storyId')];assert(s,'Story not found');
    const n=next(s,state);
    return {id,title:s.title,sha256:s.sha256,aspectRatio:s.aspectRatio,language:s.language,
      completed:{story:true,cast:!!s.cast,storyboard:!!s.storyboard,editorialApproval:!!s.approvedAt,productionPackage:!!s.prepared},
      characters:s.cast?.characters.length||0,locations:s.cast?.locations.length||0,scenes:s.storyboard?.scenes.length||0,
      shots:s.storyboard?.scenes.reduce((n,x)=>n+x.shots.length,0)||0,sourceCoveragePercent:s.storyCoveragePercent??null,
      assumptions:s.cast?.assumptions||[],prepared:s.prepared,next:n};
  }
  async draft(id){
    const state=await this.studio.store.read(),s=state.stories?.[validId(id,'storyId')];assert(s,'Story not found');
    return {id,sha256:s.sha256,aspectRatio:s.aspectRatio,cast:structuredClone(s.cast),storyboard:structuredClone(s.storyboard),
      sourceCoveragePercent:s.storyCoveragePercent??null,approvedAt:s.approvedAt,next:next(s,state)};
  }
  async list(){const state=await this.studio.store.read();return Object.keys(state.stories||{}).sort().map(id=>({id,title:state.stories[id].title,stage:next(state.stories[id],state).stage}));}
  async prepare({storyId,accountId,videoEstimatedCredits,imageEstimatedCredits=0,includeCharacterCreation=false,includeSceneCompose=false}){
    validId(storyId,'storyId');validId(accountId,'accountId');
    assert(Number.isInteger(videoEstimatedCredits)&&videoEstimatedCredits>0,'videoEstimatedCredits must be positive, based on operator estimate');
    assert(Number.isInteger(imageEstimatedCredits)&&imageEstimatedCredits>=0,'imageEstimatedCredits must be nonnegative');
    const state=await this.studio.store.read(),s=state.stories?.[storyId];
    assert(s?.approvedAt,'Story needs operator-approved cast and storyboard');
    const source=await fs.readFile(path.join(this.studio.store.home,s.sourcePath),'utf8');
    assert(SHA(source)===s.sha256,'Story source integrity check failed before compilation');
    const account=state.accounts[accountId];assert(account?.provider==='google-flow'&&account.authorized&&account.enabled,'An authorized Google Flow account is required');
    if(s.prepared){assert(s.prepared.accountId===accountId && s.prepared.videoEstimatedCredits===videoEstimatedCredits && s.prepared.imageEstimatedCredits===imageEstimatedCredits && s.prepared.includeCharacterCreation===includeCharacterCreation && s.prepared.includeSceneCompose===includeSceneCompose,'Production package is immutable; create a new story version to change compilation options');return {...s.prepared,alreadyPrepared:true};}
    const prodId=`${storyId}-production`,workflowId=`${storyId}-${accountId}-flow`;
    assert(prodId.length<=100 && workflowId.length<=100,'Story and account identifiers too long for production/workflow IDs');
    const {cast,storyboard}=s;
    const approvedRevision=(kind,item,defaultId)=>{
      const libraryId=item.libraryId||defaultId;
      const entry=state.visualLibrary?.entities?.[libraryId];
      if(entry)assert(entry.kind===kind,`Library kind mismatch for ${libraryId}`);
      const revisions=Object.values(entry?.versions||{}).filter(r=>r.status==='approved').sort((a,b)=>b.version-a.version);
      assert(!(item.libraryId && revisions.length>0 && item.libraryVersion===undefined),`Approved library ${libraryId} exists: pin libraryVersion in the reviewed cast to prevent an unapproved visual change`);
      const found=item.libraryVersion!==undefined?revisions.find(r=>r.version===item.libraryVersion):null;
      if(item.libraryVersion!==undefined)assert(found,`Approved pinned visual library version missing: ${libraryId}@${item.libraryVersion}`);
      if(found)assert(found.description===item.designPrompt,`Visual description mismatch for ${libraryId}@${found.version}; use a new story revision, never silently substitute`);
      return found||null;
    };
    const approvedChars=new Map(cast.characters.map(c=>[c.id,approvedRevision('character',c,`${storyId}/${c.id}`)]));
    const approvedLocations=new Map(cast.locations.map(l=>[l.id,approvedRevision('location',l,`${storyId}/${l.id}`)]));
    const manifest={schemaVersion:1,id:prodId,title:s.title,source:{type:'local-story',sha256:s.sha256,localRelativePath:'../source.md'},
      assets:[],characters:cast.characters.map(c=>({id:c.id,libraryId:c.libraryId||`${storyId}/${c.id}`,version:approvedChars.get(c.id)?.version||1,description:c.designPrompt,referenceAssetIds:[],name:c.name,sourceExcerpt:c.sourceExcerpt})),shots:[]};
    const steps=[];const videoSteps=[];const sceneSequence=[];
    const step=(id,operation,inputs,dependsOn=[],estimatedCredits=0)=>{
      assert(id.length<=100,'Compiled step identifier too long');
      steps.push({id,operation,accountId,inputs,dependsOn,estimatedCredits});return id;
    };
    const assetByHash=new Map();
    const useApprovedReference=ref=>{
      if(assetByHash.has(ref.sha256))return assetByHash.get(ref.sha256);
      assert(/^[a-f0-9]{64}$/.test(ref.sha256)&&/^assets\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(ref.storedPath),'Invalid approved library asset');
      const assetId=`ref-${ref.sha256.slice(0,32)}`;
      manifest.assets.push({id:assetId,path:ref.storedPath,sha256:ref.sha256});
      const uploadId=step(`upload-${assetId}`,'asset.upload',{assetId},[],0);
      const used={assetId,token:`asset:${assetId}`,dependsOn:uploadId,ref};assetByHash.set(ref.sha256,used);
      return used;
    };
    const charRefs=new Map(), locationRefs=new Map();
    for(const c of cast.characters){
      const approved=approvedChars.get(c.id);
      let refs;
      if(approved){
        assert(approved.references.length>0,`Approved character ${c.id} needs an image reference`);
        refs=approved.references.map(useApprovedReference);
        manifest.characters.find(x=>x.id===c.id).referenceAssetIds=refs.map(r=>r.assetId);
      } else {
        const ref=step(`character-image-${c.id}`,'image.generate',{prompt:`Style reference: ${cast.visualStyle}\nCharacter: ${c.name}. ${c.designPrompt}\nApproved source: ${c.sourceExcerpt}\nSingle clear subject; maintain stable identity across future views.`,aspectRatio:'9:16'},[],imageEstimatedCredits);
        refs=[{token:`step:${ref}`,dependsOn:ref}];
      }
      charRefs.set(c.id,refs);
      if(includeCharacterCreation)step(`character-register-${c.id}`,'character.create',{characterId:c.id,source:refs[0].token},[refs[0].dependsOn],0);
    }
    for(const l of cast.locations){
      const approved=approvedLocations.get(l.id);
      if(approved){assert(approved.references.length>0,`Approved location ${l.id} needs an image reference`);locationRefs.set(l.id,approved.references.map(useApprovedReference));}
      else {const ref=step(`location-image-${l.id}`,'image.generate',{prompt:`Style reference: ${cast.visualStyle}\nEnvironment: ${l.name}. ${l.designPrompt}\nApproved source: ${l.sourceExcerpt}\nClean environment reference, coherent geometry and lighting.`,aspectRatio:s.aspectRatio},[],imageEstimatedCredits);locationRefs.set(l.id,[{token:`step:${ref}`,dependsOn:ref}]);}
    }
    for(const scene of storyboard.scenes){
      const clips=[];
      for(const shot of scene.shots){
        const refs=[...new Map([...shot.characterIds.flatMap(id=>charRefs.get(id)||[]),...(scene.locationId?(locationRefs.get(scene.locationId)||[]):[])].map(x=>[x.token,x])).values()];
        assert(refs.length<=5,`Shot ${shot.id} references ${refs.length} visual images; provider capability must be checked and explicit references selected; no silent truncation`);
        const referenceSteps=[...new Set(refs.map(x=>x.dependsOn))];
        const characterInfo=shot.characterIds.map(id=>cast.characters.find(c=>c.id===id)).map(c=>`${c.name}: ${c.designPrompt}`).join('; ');
        const locationInfo=cast.locations.find(l=>l.id===scene.locationId);
        const frame=step(`frame-${shot.id}`,'image.generate',{
          prompt:`Visual style LOCK: ${cast.visualStyle}\nScene: ${scene.title}\nApproved action: ${shot.sourceExcerpt}\nFrame direction: ${shot.visualPrompt}\nCharacter continuity: ${characterInfo||'No characters'}\nEnvironment: ${locationInfo?.designPrompt||'Follow approved scene'}\nMaintain identity and composition; avoid unapproved text, logos and props.`,
          aspectRatio:s.aspectRatio,...(referenceSteps.length?{referenceImages:refs.map(x=>x.token)}:{})
        },referenceSteps,imageEstimatedCredits);
        const motion=step(`video-${shot.id}`,'video.frames',{
          prompt:`Story: ${shot.sourceExcerpt}\nMotion direction: ${shot.motionPrompt}\nCamera: ${shot.camera||'As described in the approved visual plan'}\nPreserve visual style and character continuity; do not add unapproved events.`,
          startFrame:`step:${frame}`,aspectRatio:s.aspectRatio,durationSeconds:shot.durationSeconds
        },[frame],videoEstimatedCredits);
        clips.push(motion);videoSteps.push(motion);
        manifest.shots.push({id:shot.id,sceneId:scene.id,prompt:shot.motionPrompt,visualPrompt:shot.visualPrompt,sourceExcerpt:shot.sourceExcerpt,
          aspectRatio:s.aspectRatio,durationSeconds:shot.durationSeconds,estimatedCredits:videoEstimatedCredits,characterIds:shot.characterIds,referenceAssetIds:[]});
      }
      if(includeSceneCompose)step(`scene-${scene.id}`,'scene.compose',{clips:clips.map(id=>`step:${id}`)},clips,0);
      sceneSequence.push({sceneId:scene.id,title:scene.title,shots:clips,sourceExcerpt:scene.sourceExcerpt});
    }
    for(const item of steps)if(typeof item.inputs.prompt==='string')assert(item.inputs.prompt.length<=20000,
      `Compiled prompt ${item.id} exceeds 20000 characters. Revise the editorial source in a new version; never truncate silently.`);
    const workflow={schemaVersion:1,id:workflowId,projectId:prodId,title:s.title,steps};
    const folder=path.join(dirs(this.studio.store.home,storyId),'production');await fs.mkdir(folder,{recursive:true,mode:0o700});
    for(const asset of assetByHash.values()){
      const src=path.join(this.studio.store.home,asset.ref.storedPath);
      const dest=path.join(folder,asset.ref.storedPath);
      await fs.mkdir(path.dirname(dest),{recursive:true,mode:0o700});
      const contents=await fs.readFile(src);
      assert(SHA(contents)===asset.ref.sha256,`Approved library asset changed: ${asset.assetId}`);
      await fs.writeFile(dest,contents,{flag:'wx',mode:0o600}).catch(async e=>{
        if(e.code!=='EEXIST')throw e;
        assert(SHA(await fs.readFile(dest))===asset.ref.sha256,`Previously staged reference changed: ${asset.assetId}`);
      });
    }
    const manifestPath=path.join(folder,'production.json'),workflowPath=path.join(folder,'workflow.json');
    const screenplay=['# Storyboard — '+s.title,'','Editorial approval: '+s.approvedAt,'Source SHA-256: '+s.sha256,'','Visual style: '+cast.visualStyle,'','## Creative assumptions',...(cast.assumptions.length?cast.assumptions.map(x=>'- '+x):['- None recorded']),''];
    for(const sc of storyboard.scenes){screenplay.push('## '+sc.id+' — '+sc.title,'Source: '+sc.sourceExcerpt,'');for(const shot of sc.shots)screenplay.push('### '+shot.id+' ('+shot.durationSeconds+'s)','Story quote: '+shot.sourceExcerpt,'Still: '+shot.visualPrompt,'Motion: '+shot.motionPrompt,'Camera: '+(shot.camera||'to be confirmed'),'Audio: '+(shot.audio||'to be confirmed'),'');}
    const bible=['# Character and location bible',`Source SHA-256: ${s.sha256}`,'','## Style',cast.visualStyle,'','## Characters',...cast.characters.flatMap(c=>[`### ${c.name} (${c.id})`,c.designPrompt,'Source: '+c.sourceExcerpt,'Library: '+(c.libraryId||`${storyId}/${c.id}`),'']),'## Locations',...cast.locations.flatMap(l=>[`### ${l.name} (${l.id})`,l.designPrompt,'Source: '+l.sourceExcerpt,''])];
    const guide=[`# Production runbook — ${s.title}`,'','The generated package is a **plan**, not remote media. Do not claim Flow projects or videos were created.','',
      '1. Register an authenticated provider account (already selected: '+accountId+'). Verify session and current Flow model/capabilities in the installed upstream.',
      '2. Import the canonical production and workflow (prepare does this locally).',
      '3. Create/select a remote Flow project and bind with studio_bind_project. Native IDs cannot cross accounts.',
      '4. For each step: studio_workflow_plan → studio_workflow_inspect_step → operator workflow-approve → studio_workflow_execute_step. Check costs and actual capabilities before approving.',
      '5. On submission_unknown, inspect Flow manually; never retry automatically. Reconcile operations and verify generated assets before marking complete.',
      '6. Propose and approve reference sheets with studio_visual_propose + operator visual-approve before locking recurring characters. Reused approved assets become upload steps; operator must verify remote asset IDs and bind them.',
      '7. Review each shot still with studio_visual_shot_submit + operator visual-shot-review, then verify videos and continuity.',
      '8. Download originals and retain hashes, source and provider metadata. Final FFmpeg assembly and audio are not automated in this version.',
      '', '## Summary',`Characters: ${cast.characters.length}`,`Locations: ${cast.locations.length}`,`Scenes: ${storyboard.scenes.length}`,`Shots: ${videoSteps.length}`,`Steps: ${steps.length}`,`Video credit estimate: ${videoSteps.length*videoEstimatedCredits} (manually supplied, not live provider quote)`,
      `Image quota/credit estimate: ${(steps.filter(x=>x.operation==='image.generate').length)*imageEstimatedCredits} (may use separate quotas)`,
      '', '## Editor sequence','The following list is the ordered shot list for eventual montage:',...sceneSequence.flatMap(x=>[x.sceneId+': '+x.shots.join(', ')])];
    await Promise.all([
      atomic(manifestPath,JSON.stringify(manifest,null,2)+'\n'),atomic(workflowPath,JSON.stringify(workflow,null,2)+'\n'),
      atomic(path.join(folder,'STORYBOARD.md'),screenplay.join('\n')+'\n'),atomic(path.join(folder,'CHARACTER_BIBLE.md'),bible.join('\n')+'\n'),
      atomic(path.join(folder,'RUNBOOK.md'),guide.join('\n')+'\n'),
      atomic(path.join(folder,'EDIT_MANIFEST.json'),JSON.stringify({sourceSha256:s.sha256,storyId,aspectRatio:s.aspectRatio,scenes:sceneSequence},null,2)+'\n')
    ]);
    await this.studio.importProject(manifestPath);
    await this.workflows.importFile(workflowPath);
    const prepared={accountId,videoEstimatedCredits,imageEstimatedCredits,includeCharacterCreation,includeSceneCompose,productionId:prodId,workflowId,
      reusedReferenceImages:assetByHash.size,packageDir:folder,files:['production.json','workflow.json','STORYBOARD.md','CHARACTER_BIBLE.md','RUNBOOK.md','EDIT_MANIFEST.json'],
      steps:steps.length,videoShots:videoSteps.length,warning:'No remote project/images/videos were generated. Flow adapter must be configured and live-tested.'};
    await this.studio.store.mutate(state=>{const cur=state.stories[storyId];assert(cur.approvedAt===s.approvedAt,'Story approval changed');cur.prepared??=prepared;return cur.prepared;});
    return prepared;
  }
}
