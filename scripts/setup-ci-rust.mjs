import {spawn} from 'node:child_process';
import {appendFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';

const pins=new Set(['1.95.0','1.99.0']);
const target='wasm32-unknown-unknown';
function rustup(args){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.platform==='win32'?'rustup.exe':'rustup',args,{stdio:['ignore','pipe','inherit'],timeout:5*60*1000,killSignal:'SIGTERM'});
    let output='';child.stdout.on('data',chunk=>{output+=chunk;});
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve(output):reject(new Error(`rustup ${args.join(' ')} failed (${code})`)));
  });
}

// Uses the runner's official rustup, without downloading a setup action from codeload.
// Never activate a fallback compiler or change the user's global default toolchain.
export async function setupCiRust({version,wasm=false,run=rustup,sleep=delay,activate,log=console.log}){
  if(!pins.has(version)||typeof wasm!=='boolean'||typeof activate!=='function')throw new Error('Unsupported CI Rust configuration');
  async function download(args){
    for(let attempt=1;attempt<=3;attempt++){
      try{return await run(args);}catch(error){
        if(attempt===3)throw error;
        log(`Rust download attempt ${attempt}/3 failed; retrying the same pinned request`);
        await sleep(attempt*2000);
      }
    }
  }
  const installed=(await run(['toolchain','list'])).split(/\r?\n/);
  if(!installed.some(line=>line===version||line.startsWith(version+'-')||line.startsWith(version+' '))){
    await download(['toolchain','install',version,'--profile','minimal','--no-self-update']);
  }
  const compiler=(await run(['run',version,'rustc','--version'])).trim();
  if(!compiler.startsWith(`rustc ${version} `))throw new Error(`Requested Rust ${version} was not verified`);
  if(wasm){
    const args=['target','list','--installed','--toolchain',version];
    const hasTarget=output=>output.split(/\r?\n/).some(line=>line.trim()===target);
    if(!hasTarget(await run(args)))await download(['target','add',target,'--toolchain',version]);
    if(!hasTarget(await run(args)))throw new Error(`Rust ${version} WebAssembly target was not verified`);
  }
  await activate(version);
  log(`Verified ${compiler}${wasm?' with '+target:''}`);
  return {version,wasm};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [version,...flags]=process.argv.slice(2);
  if(flags.length>1||flags.some(flag=>flag!=='--wasm')||!process.env.GITHUB_ENV)throw new Error('Usage in Actions: node scripts/setup-ci-rust.mjs <1.95.0|1.99.0> [--wasm]');
  await setupCiRust({version,wasm:flags.includes('--wasm'),activate:version=>appendFile(process.env.GITHUB_ENV,`RUSTUP_TOOLCHAIN=${version}\n`)});
}
