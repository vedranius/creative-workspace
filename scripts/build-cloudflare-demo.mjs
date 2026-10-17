import {readFile,writeFile,mkdir,readdir,lstat,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalog} from '../src/catalog.js';
import {originalUiPins,originalUiPatches,originalUiPackageId} from '../src/original-ui.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function safePath(base,relative){
 if(typeof relative!=='string'||relative.includes('\\')||relative.startsWith('/')||relative.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Unsafe package path');
 const resolved=path.resolve(base,relative);if(!resolved.startsWith(path.resolve(base)+path.sep))throw Error('Unsafe package path');return resolved;
}
export async function buildDemo(source,destination){
 const output=path.resolve(destination);await mkdir(output,{recursive:true});
 if((await readdir(output)).length)throw Error('Demo destination must be empty; never mix private data into a deployment');
 await cp(path.join(root,'cloudflare/demo'),output,{recursive:true});
 for(const [from,to] of [['docs/brand/logo.svg','logo.svg'],['LICENSE.md','LICENSE.md'],['LICENSE','LICENSE']])await cp(path.join(root,from),path.join(output,to));
 const version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
 const apps=[];const wasmRoutes={};
 for(const app of catalog.filter(a=>!['rapidraw','designcraft'].includes(a.id))){
  const sourceRoot=path.join(source,app.id,originalUiPackageId(app.id));const manifest=JSON.parse(await readFile(path.join(sourceRoot,'creative-workspace-ui.json'),'utf8'));
  if(manifest.app!==app.id||manifest.repo!==app.repo||manifest.commit!==originalUiPins[app.id]||manifest.processing!=='browser')throw Error('Demo accepts only pinned original browser-processing packages');
  const patch=originalUiPatches[app.id];if(patch&&(manifest.sourcePatch?.id!==patch.id||manifest.sourcePatch?.sha256!==patch.sha256))throw Error('Unverified source patch');
  if(!patch&&manifest.sourcePatch)throw Error('Unexpected source patch');
  const prefix=`/original/${app.id}/${originalUiPackageId(app.id)}`;
  if(!manifest.files.some(f=>f.path==='index.html')||!manifest.files.some(f=>f.path.endsWith('.wasm')))throw Error('Incomplete original application');
  for(const file of manifest.files){
   const input=safePath(sourceRoot,file.path);for(let current=input;current!==sourceRoot;current=path.dirname(current))if((await lstat(current)).isSymbolicLink())throw Error('Package symlink rejected');
   const bytes=await readFile(input);
   if(bytes.length!==file.size||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error(`Package integrity failed: ${app.id}/${file.path}`);
   const isWasm=file.path.endsWith('.wasm');const target=safePath(output,prefix.slice(1)+'/'+file.path+(isWasm?'.gz':''));await mkdir(path.dirname(target),{recursive:true});
   const stored=file.path.endsWith('.wasm')?gzipSync(bytes,{level:6}):bytes;
   if(stored.length>25*1024*1024)throw Error(`Pages 25 MiB asset limit: ${file.path}`);
   await writeFile(target,stored);if(isWasm)wasmRoutes[prefix+'/'+file.path]=prefix+'/'+file.path+'.gz';
  }
  await writeFile(safePath(output,prefix.slice(1)+'/creative-workspace-ui.json'),JSON.stringify(manifest,null,2)+'\n');
  await mkdir(path.join(output,'apps',app.id),{recursive:true});await cp(path.join(root,'cloudflare/demo/index.html'),path.join(output,'apps',app.id,'index.html'));
  apps.push({...app,url:prefix+'/',commit:manifest.commit,processing:'browser',serverIntegrated:false});
 }
 await writeFile(path.join(output,'ATTRIBUTION.md'),'# Original projects and authors\n\nCreative Workspace is an independent project by vedranius, under AGPL-3.0-only. It is not endorsed by the ArtCraft team. Original application licenses and brand terms remain their authors’ terms. Every original package includes its licenses and provenance. Application names identify the corresponding upstream software.\n\n'+apps.map(a=>`- ${a.name} by the ArtCraft team and contributors: https://github.com/${a.repo}/tree/${a.commit} — package provenance: ${a.url}creative-workspace-ui.json`).join('\n')+'\n');
 await writeFile(path.join(output,'404.html'),'<!doctype html><title>Not found</title><h1>Not found</h1><a href="/">Creative Workspace demo</a>');
 await writeFile(path.join(output,'_headers'),"/*\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self' blob:; worker-src 'self' blob:; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'\n\n/original/*.gz\n  Content-Type: application/gzip\n\n/wasm-transport.js\n  Cache-Control: no-cache\n");
 const transport=await readFile(path.join(root,'cloudflare/demo/wasm-transport.js'),'utf8');
 await writeFile(path.join(output,'wasm-transport.js'),'const wasmRoutes='+JSON.stringify(wasmRoutes)+';\n'+transport);
 await writeFile(path.join(output,'demo-manifest.json'),JSON.stringify({schemaVersion:1,version,mode:'browser',documentBackend:false,source:'https://github.com/vedranius/creative-workspace',apps},null,2)+'\n');
 return {version,apps:apps.length,output};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2]||!process.argv[3])throw Error('Usage: node scripts/build-cloudflare-demo.mjs VERIFIED_UI_ROOT EMPTY_OUTPUT_DIR');
 console.log(JSON.stringify(await buildDemo(path.resolve(process.argv[2]),process.argv[3])));
}
