// Experimental native React command bridge. AGPL-3.0-only.
// Only browser-selected File objects enter this session; no filesystem paths,
// writes, sidecars, fetch-to-server, analytics or unsupported effect claims.
import {isRawInputSizeAllowed} from './decoder-client.js';
import {createNeutralRendererResources,packRgb32fRendererInput,packGlobalRendererFixture,
 renderOriginalFrame,encodePreviewResponse} from './webgpu-renderer.js';
export class UnavailableCommandError extends Error {
 constructor(command){super(`Browser experiment does not support ${command}`);this.name='UnavailableCommandError';this.code='unavailable-command';}
}
export function createReactTransport({wasm,device,shaderSource,defaults,workerUrl=new URL('./worker.js',import.meta.url)}) {
 let file=null,path=null,current=null,generation=0,controller=null,queue=Promise.resolve(),closed=false;
 const trace=[];
 const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const supported=new Set(['exposure','brightness','contrast','highlights','shadows','whites','blacks','toneMapper']);
 const check=version=>{if(closed||version!==generation)throw Error('Superseded or worker failed');};
 function worker(bytes,output,signal){
  return new Promise((resolve,reject)=>{
   const w=new Worker(workerUrl,{type:'module'});let settled=false;
   const done=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);w.terminate();err?reject(err):resolve(value);};
   const abort=()=>done(Error('Superseded or worker failed'));
   const timer=setTimeout(()=>done(Error('RAW worker timed out')),30000);
   signal.addEventListener('abort',abort,{once:true});
   w.onmessage=({data})=>{if(data.id!==1||data.status==='developing')return;data.ok?done(null,data):done(Error(data.error));};
   w.onerror=e=>{e.preventDefault();done(Error(e.message));};w.onmessageerror=()=>done(Error('RAW worker message could not be read'));
   if(signal.aborted){abort();return;}
   w.postMessage({id:1,bytes,output,fastDemosaic:true},[bytes]);
  });
 }
 async function clear(){
  generation++;controller?.abort();controller=null;
  const prior=current;current=null;
  await device.queue.onSubmittedWorkDone();prior?.resources.ownedTextures.forEach(t=>t.destroy());
 }
 function requirePath(value){if(closed||!file||value!==path)throw Error('Unknown browser document');}
 async function execute(command,args={}){
  if(closed)throw Error('Browser session closed');
  trace.push({command});
  if(command==='clear_session_caches'){await clear();return;}
  if(command==='load_metadata'){requirePath(args.path);return {adjustments:null};}
  if(command==='load_image'){
   requirePath(args.path);await clear();const version=generation,selected=file;
   const abort=new AbortController();controller=abort;
   const shot=await worker(await selected.arrayBuffer(),'as-shot',abort.signal);check(version);
   const image=await worker(await selected.arrayBuffer(),'pixels',abort.signal);check(version);
   if(image.components!==3)throw Error('This original React slice requires RGB development');
   const inputRgbaF16=packRgb32fRendererInput(wasm,image.width,image.height,image.data);
   const resources=createNeutralRendererResources(device,{width:image.width,height:image.height,inputRgbaF16});
   current={version,width:image.width,height:image.height,asShot:shot.asShot,resources};
   return {width:image.width,height:image.height,is_raw:true,as_shot_white_balance:shot.asShot.whiteBalance,
    metadata:{adjustments:null},exif:{},development_mode:'native-speed'};
  }
  if(command==='apply_adjustments'){
   const image=current;if(!image)throw Error('No browser RAW image loaded');check(image.version);
   if(args.roi!=null||args.computeWaveform|| (args.targetResolution!=null&&args.targetResolution!==Math.max(image.width,image.height)))throw new UnavailableCommandError('ROI/waveform/preview resizing');
   const adjustments=args.jsAdjustments;
   if(!adjustments||typeof adjustments!=='object'||Array.isArray(adjustments))throw TypeError('Expected original adjustments');
   for(const [key,value] of Object.entries(adjustments)){
    if(supported.has(key))continue;
    if(JSON.stringify(value)!==JSON.stringify(defaults[key]))throw new UnavailableCommandError(`adjustment ${key}`);
   }
   for(const key of supported){if(key==='toneMapper'){if(!['basic','agx'].includes(adjustments[key]??'basic'))throw TypeError('Invalid tone mapper');}
    else if(typeof adjustments[key]!=='number'||!Number.isFinite(adjustments[key]))throw TypeError('Expected finite original Basic value');}
   const packed=packGlobalRendererFixture(wasm,JSON.stringify(adjustments),image.asShot,{baselineExposure:0,compensateHighlightPreservation:true});
   const frame=await renderOriginalFrame({device,width:image.width,height:image.height,shaderSource,
    inputTexture:image.resources.inputTexture,adjustments:packed,resources:image.resources.resources,outputPrecision:'eight'});
   check(image.version);
   const response=encodePreviewResponse(wasm,frame,{interactive:!!args.isInteractive});
   const hashes={adjustmentSha256:await hash(packed.bytes),rgbaSha256:await hash(frame.pixels),jpegSha256:await hash(response)};check(image.version);
   trace.push({...hashes,command:'render-result',exposure:adjustments.exposure,width:frame.width,height:frame.height,
    interactive:!!args.isInteractive,bytes:response.byteLength,analytics:'unavailable',adjustments:structuredClone(adjustments)});
   return response;
  }
  throw new UnavailableCommandError(command);
 }
 return {
  trace,
  selectFile(selected){if(!(selected instanceof File)||!isRawInputSizeAllowed(selected.size))throw TypeError('Select a bounded RAW File');controller?.abort();generation++;file=selected;path=`browser-document:${crypto.randomUUID()}`;return path;},
  invoke(command,args){const result=queue.then(()=>execute(command,args));queue=result.catch(()=>{});return result;},
  async close(){closed=true;await clear();file=null;path=null;await queue;},
 };
}
