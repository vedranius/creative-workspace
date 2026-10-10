import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,access,symlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(project,'engines/rapidraw/manifest.json'),'utf8'));
const runtime=path.resolve(process.env.CW_RUNTIME_DIR||path.join(project,'data/engines/rapidraw'));
const source=path.resolve(process.env.CW_RAPIDRAW_SOURCE||path.join(runtime,'source'));
const build=path.join(runtime,'build');
const fuseBuild=path.join(runtime,'fuse-build');
const photos=path.resolve(process.env.CW_RAPIDRAW_WORKSPACE||path.join(project,'workspaces/rapidraw'));
const run=(command,args,options={})=>new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:source,stdio:'inherit',...options});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${command} failed (${code})`)));});
if(process.platform!=='linux')throw new Error('The managed engine installer currently targets Linux. Other platform packaging is pending.');
const buildEnv={...process.env,CARGO_TARGET_DIR:build,CARGO_BUILD_JOBS:process.env.CARGO_BUILD_JOBS||'4',VITE_CW_MANAGED:'1',VITE_RR_RELAY:`ws://127.0.0.1:${manifest.port}/bridge`};
const action=process.argv[2]||'help';
if(action==='install'){
  await mkdir(runtime,{recursive:true});
  try{await access(path.join(source,'.git'));}catch{await run('git',['clone','--no-checkout',manifest.source,source],{cwd:runtime});}
  // Refuse to silently reset an unrelated or modified source checkout.
  await run('git',['checkout','--detach',manifest.commit]);
  const configFile=path.join(source,'rrweb/tauri.bridge.json');
  const config=JSON.parse(await readFile(configFile,'utf8'));
  Object.assign(config,{productName:'Creative Workspace RapidRAW Engine',mainBinaryName:manifest.binary,identifier:manifest.identifier});
  await writeFile(configFile,JSON.stringify(config,null,2));
  const relayFile=path.join(source,'rrweb/relay/relay.mjs');
  let relay=await readFile(relayFile,'utf8');
  if(!relay.includes('__cw_runtime_identity'))relay=relay.replace('const LOCAL = {',`const LOCAL = { __cw_runtime_identity: () => ({ runtimeId: '${manifest.runtimeId}' }),`);
  await writeFile(relayFile,relay);
  const cloudFile=path.join(source,'src/store/useCloudStore.ts');
  let cloud=await readFile(cloudFile,'utf8');
  if(!cloud.includes('VITE_CW_MANAGED'))cloud=cloud.replace('  initAuth: async () => {', "  initAuth: async () => {\n    if (import.meta.env.VITE_CW_MANAGED === '1') { set({ authStatus: 'unsupported' }); return; }");
  await writeFile(cloudFile,cloud);
  const libraryFile=path.join(source,'src/components/panel/MainLibrary.tsx');
  let library=await readFile(libraryFile,'utf8');
  if(!library.includes('VITE_CW_MANAGED'))library=library.replace('        setAppVersion(currentVersion);', "        setAppVersion(currentVersion);\n        if (import.meta.env.VITE_CW_MANAGED === '1') return;");
  await writeFile(libraryFile,library);
  const htmlFile=path.join(source,'index.html');
  const html=await readFile(htmlFile,'utf8');
  await writeFile(htmlFile,html.split('\n').filter(line=>!line.includes('fonts.googleapis.com')&&!line.includes('fonts.gstatic.com')).join('\n'));
  await run('npm',['ci','--no-audit','--no-fund']);
  await run(process.execPath,['rrweb/check-shims.mjs']);
  await run('npx',['vite','build','--config','rrweb/vite.web.config.mjs'],{env:buildEnv});
  await run('npm',['ci','--omit=dev','--no-audit','--no-fund'],{cwd:path.join(source,'rrweb/relay')});
  await run('cargo',['build','--release','--manifest-path','rrweb/fuse/Cargo.toml'],{env:{...buildEnv,CARGO_TARGET_DIR:fuseBuild}});
  await run('npx',['tauri','build','--no-bundle','--config','rrweb/tauri.bridge.json'],{env:buildEnv});
  await writeFile(path.join(runtime,'installed.json'),JSON.stringify({...manifest,source,build,fuseBuild},null,2));
  console.log(`Workspace-owned engine installed in ${runtime}`);
}else if(action==='start'){
  const binary=path.join(build,'release',manifest.binary);await access(binary);
  const resourceRoot=path.join(build,'lib','Creative Workspace RapidRAW Engine');
  await mkdir(resourceRoot,{recursive:true});
  for(const name of ['resources','lensfun_db']){try{await access(path.join(build,'release',name));await symlink(path.join(build,'release',name),path.join(resourceRoot,name),'dir');}catch(error){if(error.code!=='EEXIST'&&error.code!=='ENOENT')throw error;}}
  const portCheck=net.createServer();
  await new Promise((resolve,reject)=>{portCheck.once('error',()=>reject(new Error(`Port ${manifest.port} is already occupied; refusing to attach to another service`)));portCheck.listen(manifest.port,'127.0.0.1',resolve);});
  await new Promise(resolve=>portCheck.close(resolve));
  for(const directory of ['data','config','cache'])await mkdir(path.join(runtime,directory),{recursive:true});
  await mkdir(photos,{recursive:true});
  const config=path.join(runtime,'relay.json');
  await writeFile(config,JSON.stringify({library:photos},null,2));
  const inherited={...process.env};for(const key of Object.keys(inherited))if(key.startsWith('RR_'))delete inherited[key];
  const env={...inherited,RR_AUTH:'',RR_LOG:path.join(runtime,'relay.log'),RR_PORT:String(manifest.port),RR_BRIDGE_PORT:String(manifest.port),RR_HOST:'127.0.0.1',RR_PHOTOS:photos,RR_ROOTS:[photos,path.join(runtime,'data'),path.join(runtime,'cache')].join(path.delimiter),RR_CONFIG:config,RR_WORK:path.join(runtime,'cache/remote'),RR_NO_BROWSER:'1',RR_DIST:path.join(source,'rrweb/dist-web'),RR_FUSE_BIN:path.join(fuseBuild,'release/rrweb-fuse'),XDG_DATA_HOME:path.join(runtime,'data'),XDG_CONFIG_HOME:path.join(runtime,'config'),XDG_CACHE_HOME:path.join(runtime,'cache')};
  // Two owned children. Stop only these PIDs; never look up or kill an existing installation.
  const relay=spawn(process.execPath,[path.join(source,'rrweb/relay/relay.mjs')],{env,stdio:'inherit'});
  const engine=spawn('xvfb-run',['-a',binary],{env,stdio:'inherit'});
  let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;relay.kill('SIGTERM');engine.kill('SIGTERM');};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  for(const child of [relay,engine]){child.on('error',error=>{console.error(error.message);process.exitCode=1;stop();});child.on('exit',code=>{if(!stopping&&code!==0)process.exitCode=1;stop();});}
  console.log(`Workspace-owned RapidRAW: http://127.0.0.1:${manifest.port}; workspace ${photos}`);
}else{console.log('Usage: node scripts/manage-rapidraw.mjs install|start\nOptional: CW_RUNTIME_DIR, CW_RAPIDRAW_SOURCE, CW_RAPIDRAW_WORKSPACE');}
