// One experimental full export job at a time. No file paths, writes or save ACK.
let nextId=0,busy=false;
export function exportRawInWorker(bytes,{adjustments={},settings={jpegQuality:90},signal,timeoutMs=120000,onStatus}={}) {
 if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<1||bytes.byteLength>128*1024*1024)return Promise.resolve({ok:false,reason:'input-limit'});
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000)return Promise.resolve({ok:false,reason:'invalid-timeout'});
 if(signal&&(typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))return Promise.resolve({ok:false,reason:'invalid-signal'});
 if(signal?.aborted)return Promise.resolve({ok:false,reason:'aborted',started:false});
 if(busy)return Promise.resolve({ok:false,reason:'busy'});
 let worker;try{worker=new Worker(new URL('./export-worker.js',import.meta.url),{type:'module'});}catch(e){return Promise.resolve({ok:false,reason:'worker-error',error:String(e)});}
 busy=true;const id=++nextId;
 return new Promise(resolve=>{
  let settled=false,interrupted=null,grace;
  const finish=result=>{
   if(settled)return;settled=true;clearTimeout(timer);clearTimeout(grace);signal?.removeEventListener('abort',abort);
   worker.terminate();busy=false;resolve(result);
  };
  const interrupt=reason=>{
   if(settled||interrupted)return;interrupted=reason;clearTimeout(timer);
   grace=setTimeout(()=>finish({id,ok:false,reason,forcedTermination:true}),2000);
   try{worker.postMessage({id,command:'cancel'});}catch{finish({id,ok:false,reason,forcedTermination:true});}
  };
  const abort=()=>interrupt('aborted');
  const timer=setTimeout(()=>interrupt('timeout'),timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});
  worker.onmessage=({data})=>{
   if(data?.id!==id||settled)return;
   if(data.status){if(!interrupted)try{onStatus?.(data);}catch{interrupt('status-handler-error');}return;}
   finish(interrupted?{id,ok:false,reason:interrupted,forcedTermination:false,deviceDestroyed:!!data.deviceDestroyed}:data);
  };
  worker.onerror=e=>{e.preventDefault();finish({id,ok:false,reason:interrupted??'worker-error',error:e.message,forcedTermination:!!interrupted});};
  worker.onmessageerror=()=>finish({id,ok:false,reason:interrupted??'worker-error'});
  if(signal?.aborted){abort();return;}
  try{worker.postMessage({id,command:'start',bytes,adjustments,settings},[bytes]);}catch(e){finish({id,ok:false,reason:'worker-error',error:String(e)});}
 });
}
