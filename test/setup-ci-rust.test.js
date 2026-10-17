import test from 'node:test';
import assert from 'node:assert/strict';
import {setupCiRust} from '../scripts/setup-ci-rust.mjs';

test('CI Rust reuses an exact cached compiler without changing the global default',async()=>{
  const calls=[],activated=[];
  await setupCiRust({version:'1.95.0',run:async args=>{calls.push(args);return args[0]==='toolchain'?'stable-x86_64\n1.95.0-x86_64 (default)\n':'rustc 1.95.0 (verified)';},activate:async v=>activated.push(v),log:()=>{}});
  assert.deepEqual(activated,['1.95.0']);assert.equal(calls.length,2);
  assert.ok(!calls.some(args=>args.includes('install')||args.includes('default')));
});
test('transient setup failures retry the same exact pin and verify its WASM target before activation',async()=>{
  const calls=[],activated=[],waits=[];let installs=0,targetReady=false;
  await setupCiRust({version:'1.99.0',wasm:true,run:async args=>{
    calls.push(args);
    if(args[0]==='toolchain'&&args[1]==='list')return 'stable-x86_64\n1.95.0-x86_64\n';
    if(args[1]==='install'){if(++installs<3)throw new Error('temporary DNS failure');return '';}
    if(args[0]==='run')return 'rustc 1.99.0 (verified)';
    if(args[1]==='add'){targetReady=true;return '';}
    return targetReady?'wasm32-unknown-unknown\nx86_64-unknown-linux-gnu\n':'x86_64-unknown-linux-gnu\n';
  },sleep:async ms=>waits.push(ms),activate:async v=>{assert.equal(targetReady,true);activated.push(v);},log:()=>{}});
  assert.equal(installs,3);assert.deepEqual(waits,[2000,4000]);assert.deepEqual(activated,['1.99.0']);
  assert.ok(calls.filter(args=>args[1]==='install').every(args=>args[2]==='1.99.0'&&args.includes('--no-self-update')));
  assert.ok(calls.some(args=>args.join(' ')==='target add wasm32-unknown-unknown --toolchain 1.99.0'));
});
test('exhausted setup retries stop without activating a default or reporting success',async()=>{
  let installs=0,activated=false;
  await assert.rejects(setupCiRust({version:'1.95.0',run:async args=>{if(args[1]==='list')return '';installs++;throw new Error('offline');},sleep:async()=>{},activate:async()=>{activated=true;},log:()=>{}}),/offline/);
  assert.equal(installs,3);assert.equal(activated,false);
});
test('cached version mismatch and absent WASM libraries fail closed',async()=>{
  let activated=false;
  const options={version:'1.99.0',activate:async()=>{activated=true;},log:()=>{},sleep:async()=>{}};
  await assert.rejects(setupCiRust({...options,run:async args=>args[1]==='list'?'1.99.0-x86_64':'rustc 1.95.0 (wrong)'}),/not verified/);
  await assert.rejects(setupCiRust({...options,wasm:true,run:async args=>args[0]==='toolchain'?'1.99.0-x86_64':args[0]==='run'?'rustc 1.99.0 (verified)':''}),/WebAssembly target was not verified/);
  assert.equal(activated,false);
});
test('unreviewed Rust channels and malformed targets do not run setup commands',async()=>{
  let ran=false;
  for(const input of [{version:'stable'},{version:'1.99.0\nEVIL=yes'},{version:'1.99.0',wasm:'other-target'}]){
    await assert.rejects(setupCiRust({...input,run:async()=>{ran=true;},activate:async()=>{}}),/Unsupported/);
  }
  assert.equal(ran,false);
});
