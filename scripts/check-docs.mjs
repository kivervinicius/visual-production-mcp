import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dirs=['docs','skills'];
const sources=['README.md','AGENTS.md','CONTRIBUTING.md'];
const walk=(directory)=>{
  if(!fs.existsSync(directory))return;
  for(const e of fs.readdirSync(directory,{withFileTypes:true})){
    const absolute=path.join(directory,e.name);
    if(e.isDirectory())walk(absolute);
    else if(e.name.endsWith('.md'))sources.push(path.relative(root,absolute));
  }
};
for(const d of dirs)walk(path.join(root,d));
const broken=[];
for(const f of sources){
  const absolute=path.join(root,f);
  const content=fs.readFileSync(absolute,'utf8');
  if(content.includes('The requested file reference is not currently visible'))broken.push(`${f}: invalid transfer placeholder`);
  // Ignore fenced code, external URLs, fragment-only links and mailto links.
  const prose=content.replace(/^```[\s\S]*?^```/gm,'');
  for(const m of prose.matchAll(/\[[^\]]+\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)){
    let target=m[1];
    if(/^(?:https?:|mailto:|data:|sandbox:|#)/i.test(target))continue;
    target=target.split('#')[0].split('?')[0];
    if(!target)continue;
    try{target=decodeURIComponent(target);}catch{}
    const resolved=path.resolve(path.dirname(absolute),target);
    if(!resolved.startsWith(root+path.sep) && resolved!==root){broken.push(`${f}: link outside repo: ${m[1]}`);continue;}
    if(!fs.existsSync(resolved))broken.push(`${f}: broken link: ${m[1]}`);
  }
}
const skill=fs.readFileSync(path.join(root,'skills/visual-production-director/SKILL.md'),'utf8');
if(!skill.startsWith('---\nname: visual-production-director\n'))broken.push('Skill missing expected frontmatter');
if(broken.length){console.error(broken.join('\n'));process.exitCode=1;}
else console.log(`Documentation links OK: ${sources.length} Markdown files`);
