/**
 * Local-first visual continuity registry.
 * Library versions and shot variants are immutable; operator decisions are explicit.
 * No Google Flow login, paid generation, image quality or identity guarantee is implied.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const LIB_ID = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,159}$/;
const LOCAL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const SHA = /^[a-f0-9]{64}$/;
const KINDS = new Set(['character', 'location', 'style', 'prop']);
const MAX_IMAGE = 25 * 1024 * 1024;
const IMG_MIMES = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp' };
const assert = (condition, reason) => { if (!condition) throw new Error(reason); };
const hash = value => createHash('sha256').update(value).digest('hex');
const timestamp = () => new Date().toISOString();
const cleanId = (value, field, pattern=LOCAL_ID) => {
  assert(typeof value === 'string' && pattern.test(value) && !value.split('/').some(x => ['__proto__','prototype','constructor','.','..',''].includes(x)), `${field}: invalid identifier`);
  return value;
};
const cleanText = (value, field, limit = 8000) => {
  assert(typeof value === 'string' && !!value.trim() && value.length <= limit, `${field}: non-empty text required (max ${limit})`);
  return value;
};
function attrs(value) {
  if (value === undefined) return {};
  assert(value && typeof value === 'object' && !Array.isArray(value), 'attributes must be an object');
  assert(Object.keys(value).length <= 30, 'attributes: maximum 30 keys');
  const output = {};
  for (const [k,v] of Object.entries(value)) {
    assert(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(k) && !['constructor','prototype'].includes(k),'Invalid attribute name');
    assert(typeof v === 'string' && v.length <= 500, 'Attribute values must be short strings');
    output[k] = v;
  }
  return output;
}
function sniff(bytes, ext) {
  const png = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  const jpg = bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  const webp = bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
  const actual = png?'png':jpg?'jpg':webp?'webp':null;
  assert(actual, 'File is not a supported PNG, JPEG or WebP image');
  assert(ext===actual || (actual==='jpg' && ext==='jpeg'), 'Image extension does not match file signature');
  return { extension: actual, mimeType: IMG_MIMES[ext] };
}
async function ingestImage(studio, filePath) {
  cleanText(filePath,'filePath',4096);
  const source=path.resolve(filePath);
  const st=await fs.lstat(source);
  assert(st.isFile() && !st.isSymbolicLink(), 'Reference must be a regular non-symlink local file');
  assert(st.size > 0 && st.size <= MAX_IMAGE, 'Image must be 1 byte to 25 MiB');
  const extension=path.extname(source).slice(1).toLowerCase();
  assert(IMG_MIMES[extension], 'Unsupported reference image extension');
  const fd=await fs.open(source,'r');let signature;
  try {const b=Buffer.alloc(12);const {bytesRead}=await fd.read(b,0,12,0);signature=b.subarray(0,bytesRead);}finally{await fd.close();}
  const imageType=sniff(signature,extension);
  const staging=path.join(studio.store.home,'assets',`.incoming-${randomUUID()}`);
  await fs.mkdir(path.dirname(staging),{recursive:true,mode:0o700});
  try {
    await fs.copyFile(source,staging);
    const bytes=await fs.readFile(staging);
    const digest=hash(bytes);
    assert(bytes.length===st.size, 'Image changed during import; try again');
    sniff(bytes.subarray(0,12),extension);
    const storedPath=`assets/${digest}.${imageType.extension}`;
    const target=path.join(studio.store.home,storedPath);
    try {const old=await fs.readFile(target);assert(hash(old)===digest, 'Content-addressed asset is corrupted');}
    catch(e){if(e.code!=='ENOENT')throw e;await fs.rename(staging,target);await fs.chmod(target,0o600);}
    return {sha256:digest,storedPath,mimeType:imageType.mimeType,bytes:bytes.length};
  } finally {await fs.rm(staging,{force:true});}
}
async function verifyReference(studio,ref) {
  assert(SHA.test(ref.sha256),'Invalid stored image hash');
  assert(/^assets\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(ref.storedPath),'Invalid stored image path');
  const file=path.resolve(studio.store.home,ref.storedPath);
  const base=path.resolve(studio.store.home,'assets');
  assert(path.dirname(file)===base,'Image path escapes asset store');
  const stat=await fs.lstat(file);
  assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size===ref.bytes, 'Reference image missing or changed');
  const bytes=await fs.readFile(file);
  assert(hash(bytes)===ref.sha256,'Reference image integrity mismatch');
}
function registry(state) {
  state.visualLibrary ??= {schemaVersion:1, entities:{}, shotVariants:{}};
  state.visualLibrary.entities ??= {};
  state.visualLibrary.shotVariants ??= {};
  return state.visualLibrary;
}
function versions(item) {return Object.values(item.versions||{}).sort((a,b)=>a.version-b.version);}
function summary(item) {const revisions=versions(item);return {libraryId:item.libraryId,kind:item.kind,versions:revisions.map(r=>({version:r.version,status:r.status,fingerprint:r.fingerprint,referenceCount:r.references.length})),latestVersion:revisions.at(-1)?.version||null,latestApprovedVersion:revisions.filter(r=>r.status==='approved').at(-1)?.version||null};}
function getItem(state,libraryId) {const item=state.visualLibrary?.entities?.[libraryId];assert(item,`Unknown visual library ID: ${libraryId}`);return item;}
function getRevision(state,libraryId,version) {const item=getItem(state,libraryId);assert(Number.isInteger(version)&&version>=1,'version must be a positive integer');const rev=item.versions[String(version)];assert(rev,`Unknown revision ${libraryId}@${version}`);return rev;}
function checkProjectShot(state, projectId, shotId) {
  cleanId(projectId,'projectId');cleanId(shotId,'shotId');
  const project=state.projects?.[projectId]?.manifest;
  assert(project,`Unknown canonical project ${projectId}`);
  assert(project.shots.some(s=>s.id===shotId),`Unknown shot ${shotId}`);
  return project;
}

function notifyStories(state,predicate,type,payload) {
  for(const story of Object.values(state.stories||{})) {
    if(!predicate(story))continue;
    const guide=state.productionGuides?.[story.id];
    if(!guide)continue; // A first status call will initialize its own snapshot and cursor.
    guide.cursor++;
    guide.events.push({seq:guide.cursor,type,at:timestamp(),...payload});
    if(guide.events.length>1000)guide.events.splice(0,guide.events.length-1000);
  }
}
function refsFromStory(story, libraryId) {
  const matches=[];
  for(const c of story.cast?.characters||[]){
    if((c.libraryId||`${story.id}/${c.id}`)!==libraryId)continue;
    for(const scene of story.storyboard?.scenes||[])for(const shot of scene.shots||[])
      if((shot.characterIds||[]).includes(c.id))matches.push({sceneId:scene.id,shotId:shot.id,reason:`character:${c.id}`});
  }
  for(const location of story.cast?.locations||[]){
    if((location.libraryId||`${story.id}/${location.id}`)!==libraryId)continue;
    for(const scene of story.storyboard?.scenes||[])if(scene.locationId===location.id)
      for(const shot of scene.shots||[])matches.push({sceneId:scene.id,shotId:shot.id,reason:`location:${location.id}`});
  }
  if(story.cast?.styleLibraryId===libraryId)for(const scene of story.storyboard?.scenes||[])for(const shot of scene.shots||[])matches.push({sceneId:scene.id,shotId:shot.id,reason:'visual-style'});
  return matches;
}

export class VisualLibrary {
  constructor(studio) {this.studio=studio;}
  async propose({libraryId,kind,name,description,referencePaths=[],attributes,originNotes=''}={}) {
    cleanId(libraryId,'libraryId',LIB_ID);assert(KINDS.has(kind),'kind must be character, location, style or prop');
    cleanText(name,'name',200);cleanText(description,'description');
    assert(Array.isArray(referencePaths)&&referencePaths.length<=12,'referencePaths must contain 0..12 files');
    if(originNotes)cleanText(originNotes,'originNotes',1200);
    const normalizedAttributes=attrs(attributes);
    const references=[];
    for(const filePath of referencePaths) references.push(await ingestImage(this.studio,filePath));
    const uniqueRefs=[...new Map(references.map(x=>[x.sha256,x])).values()].sort((a,b)=>a.sha256.localeCompare(b.sha256));
    const spec={kind,name,description,attributes:normalizedAttributes,originNotes,referenceHashes:uniqueRefs.map(x=>x.sha256)};
    const fingerprint=hash(JSON.stringify(spec));
    return this.studio.store.mutate(state=>{
      const cat=registry(state);
      let item=cat.entities[libraryId];
      if(item)assert(item.kind===kind,`Kind cannot change for ${libraryId}`);
      else item={libraryId,kind,versions:{}};
      const found=versions(item).find(x=>x.fingerprint===fingerprint);
      if(found)return {libraryId,version:found.version,status:found.status,fingerprint,alreadyExists:true};
      const version=versions(item).at(-1)?.version+1||1;
      item.versions[String(version)]={libraryId,version,kind,name,description,attributes:normalizedAttributes,originNotes,references:uniqueRefs,fingerprint,status:'proposed',proposedAt:timestamp(),decision:null};
      cat.entities[libraryId]=item;
      notifyStories(state,story=>refsFromStory(story,libraryId).length>0,'visual_revision_proposed',{libraryId,version,fingerprint});
      return {libraryId,version,fingerprint,status:'proposed',referenceCount:uniqueRefs.length,requiresApproval:true};
    });
  }
  async list({kind,approvedOnly=false}={}) {
    if(kind!==undefined)assert(KINDS.has(kind),'Unknown kind');
    const state=await this.studio.store.read();
    const values=Object.values(state.visualLibrary?.entities||{}).filter(x=>!kind||x.kind===kind).map(summary);
    return {items:approvedOnly?values.filter(x=>x.latestApprovedVersion!==null):values,count:values.length};
  }
  async get({libraryId,version}={}) {
    cleanId(libraryId,'libraryId',LIB_ID);
    const state=await this.studio.store.read();const item=getItem(state,libraryId);
    return version===undefined?structuredClone(item):structuredClone(getRevision(state,libraryId,version));
  }
  /** CLI-only decision, never an MCP approval tool. */
  async decide({libraryId,version,expectedFingerprint,decision,note=''}={}) {
    cleanId(libraryId,'libraryId',LIB_ID);
    assert(['approve','reject'].includes(decision),'decision must be approve or reject');
    assert(typeof expectedFingerprint==='string'&&SHA.test(expectedFingerprint),'Expected SHA-256 fingerprint required');
    assert(typeof note==='string'&&note.length<=2000,'note too long');
    if(decision==='reject')cleanText(note,'rejection note',2000);
    return this.studio.store.mutate(async state=>{
      const rev=getRevision(state,libraryId,version);
      assert(rev.status==='proposed',`Revision already ${rev.status}; propose a new version`);
      assert(rev.fingerprint===expectedFingerprint,'STALE_REVIEW: proposal fingerprint changed');
      if(decision==='approve'&&rev.kind!=='style')assert(rev.references.length>0,'Visual reference image is required to approve character/location/prop');
      for(const ref of rev.references)await verifyReference(this.studio,ref);
      rev.status=decision==='approve'?'approved':'rejected';
      rev.decision={actor:'local-operator',decision,at:timestamp(),note,fingerprint:rev.fingerprint};
      notifyStories(state,story=>refsFromStory(story,libraryId).length>0,'visual_revision_decision',{libraryId,version,decision,fingerprint:rev.fingerprint});
      return {libraryId,version,status:rev.status,fingerprint:rev.fingerprint,decision:rev.decision};
    });
  }
  async verify({libraryId,version}={}) {
    cleanId(libraryId,'libraryId',LIB_ID);
    const state=await this.studio.store.read();const r=getRevision(state,libraryId,version);
    for(const ref of r.references)await verifyReference(this.studio,ref);
    return {libraryId,version,status:r.status,referenceCount:r.references.length,verifiedHashes:r.references.map(x=>x.sha256),source:'local-files-only'};
  }
  async impact({libraryId,version}={}) {
    cleanId(libraryId,'libraryId',LIB_ID);
    const state=await this.studio.store.read();getRevision(state,libraryId,version);
    const projects=[];const stories=[];
    for(const p of Object.values(state.projects||{})){
      const characters=p.manifest.characters.filter(x=>(x.libraryId||`${p.manifest.id}/${x.id}`)===libraryId);
      if(!characters.length)continue;
      const impacted=p.manifest.shots.filter(shot=>characters.some(c=>(shot.characterIds||[]).includes(c.id))).map(shot=>({shotId:shot.id,reason:'character-reference'}));
      if(impacted.length)projects.push({projectId:p.manifest.id,pinnedVersions:[...new Set(characters.map(x=>x.version))],shots:impacted});
    }
    for(const story of Object.values(state.stories||{})){
      const shots=refsFromStory(story,libraryId);if(shots.length)stories.push({storyId:story.id,shots});
    }
    return {libraryId,version,projects,stories,impactMode:'read-only; existing projects and workflows remain pinned and are NEVER silently regenerated',note:'Style changes affect only stories explicitly linked by styleLibraryId; existing workflows are not changed.'};
  }
  async projectReadiness({projectId}={}) {
    cleanId(projectId,'projectId');const state=await this.studio.store.read();
    const project=state.projects[projectId]?.manifest;assert(project,`Unknown canonical project ${projectId}`);
    const items=project.characters.map(c=>{
      const libraryId=c.libraryId||`${projectId}/${c.id}`;
      const rev=state.visualLibrary?.entities?.[libraryId]?.versions?.[String(c.version)];
      const status=!rev?'MISSING_VERSION':rev.status!=='approved'?'UNAPPROVED':rev.references.length===0?'NO_VISUAL_REFERENCE':rev.description!==c.description?'DESCRIPTION_MISMATCH':'READY_TO_REVIEW_REFERENCES';
      return {characterId:c.id,libraryId,version:c.version,status,referenceHashes:rev?.references?.map(x=>x.sha256)||[]};
    });
    return {projectId,characters:items,readyForContinuity:items.every(x=>x.status==='READY_TO_REVIEW_REFERENCES'),note:'Provider upload and identity consistency are not verified by this local check; pinned manifests are never changed automatically.'};
  }
  async submitShot({projectId,shotId,variant,filePath,note=''}={}) {
    cleanId(projectId,'projectId');cleanId(shotId,'shotId');cleanId(variant,'variant');
    if(note)cleanText(note,'note',1200);
    const state=await this.studio.store.read();checkProjectShot(state,projectId,shotId);
    const reference=await ingestImage(this.studio,filePath);
    return this.studio.store.mutate(s=>{
      checkProjectShot(s,projectId,shotId);
      const cat=registry(s);const key=`${projectId}::${shotId}`;
      const shot=cat.shotVariants[key]??={projectId,shotId,variants:{},selectedVariant:null};
      const existing=shot.variants[variant];
      if(existing){assert(existing.reference.sha256===reference.sha256,'Variant ID already refers to a different image; choose a new variant');return {projectId,shotId,variant,status:existing.status,sha256:existing.reference.sha256,alreadyExists:true};}
      shot.variants[variant]={variant,reference,note,status:'proposed',createdAt:timestamp(),decision:null};
      notifyStories(s,story=>story.prepared?.productionId===projectId,'visual_shot_proposed',{projectId,shotId,variant,sha256:reference.sha256});
      return {projectId,shotId,variant,sha256:reference.sha256,status:'proposed',requiresApproval:true};
    });
  }
  async shotList({projectId,shotId}={}) {
    cleanId(projectId,'projectId');cleanId(shotId,'shotId');const state=await this.studio.store.read();checkProjectShot(state,projectId,shotId);
    const item=state.visualLibrary?.shotVariants?.[`${projectId}::${shotId}`];
    return item?structuredClone(item):{projectId,shotId,variants:{},selectedVariant:null};
  }
  /** CLI-only per-shot image review, not a tool for AI agents. */
  async decideShot({projectId,shotId,variant,expectedSha256,decision,note=''}={}) {
    cleanId(projectId,'projectId');cleanId(shotId,'shotId');cleanId(variant,'variant');
    assert(['approve','reject'].includes(decision),'decision must be approve or reject');
    assert(SHA.test(expectedSha256||''),'expectedSha256 required');
    assert(typeof note==='string'&&note.length<=2000,'note too long');
    if(decision==='reject')cleanText(note,'rejection note',2000);
    return this.studio.store.mutate(async state=>{
      checkProjectShot(state,projectId,shotId);
      const candidate=state.visualLibrary?.shotVariants?.[`${projectId}::${shotId}`];
      const record=candidate?.variants?.[variant];assert(record,`Unknown shot candidate ${variant}`);
      assert(record.status==='proposed','Already reviewed; use another variant');
      assert(record.reference.sha256===expectedSha256,'STALE_REVIEW: shot image does not match expected hash');
      await verifyReference(this.studio,record.reference);
      record.status=decision==='approve'?'approved':'rejected';
      record.decision={actor:'local-operator',decision,at:timestamp(),note,sha256:record.reference.sha256};
      if(decision==='approve')candidate.selectedVariant=variant;
      notifyStories(state,story=>story.prepared?.productionId===projectId,'visual_shot_decision',{projectId,shotId,variant,decision,sha256:record.reference.sha256});
      return {projectId,shotId,variant,status:record.status,selectedVariant:candidate.selectedVariant,sha256:record.reference.sha256,decision:record.decision};
    });
  }
}
