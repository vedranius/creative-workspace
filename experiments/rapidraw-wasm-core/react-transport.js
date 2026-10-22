// Experimental native React command bridge. AGPL-3.0-only.
// Only browser-selected File objects enter this session; no filesystem paths,
// sidecars, fetch-to-server, analytics or unsupported effect claims. Optional export
// uses a separate host with acknowledged destination writes and recovery.
import {isRawInputSizeAllowed} from './decoder-client.js';
import {createNeutralRendererResources,packRgb32fRendererInput,packGlobalRendererFixture,
 renderOriginalFrame,encodePreviewResponse} from './webgpu-renderer.js';
export class UnavailableCommandError extends Error {
 constructor(command){super(`Browser experiment does not support ${command}`);this.name='UnavailableCommandError';this.code='unavailable-command';}
}
export function createReactTransport({wasm,device,shaderSource,defaults,getPreviewSettings=()=>({editorPreviewResolution:1920,livePreviewQuality:'high'}),workerUrl=new URL('./react-image-worker.js',import.meta.url),exportFactory}) {
 let file=null,path=null,current=null,generation=0,imageWorker=null,queue=Promise.resolve(),closed=false;
 const trace=[],listeners=new Map();
 const emit=(event,payload)=>{trace.push({command:'event',event,payload});for(const callback of [...(listeners.get(event)||[])])callback({event,payload});};
 const exportHost=exportFactory?.({getDocument:()=>({file,path,generation,ready:!closed&&current?.version===generation}),emit});
 const nativeError=error=>String(error?.message??error);

 const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const supported=new Set(['exposure','brightness','contrast','highlights','shadows','whites','blacks','toneMapper']);
 const check=version=>{if(closed||version!==generation)throw Error('Superseded or worker failed');};
 function createImageWorker(){
  const worker=new Worker(workerUrl,{type:'module'});let request=0,pending=null,terminated=false;
  const finish=(error,value)=>{if(!pending)return;const p=pending;pending=null;clearTimeout(p.timer);error?p.reject(error):p.resolve(value);};
  const close=(error=Error('Superseded or worker failed'))=>{if(terminated)return;terminated=true;worker.terminate();finish(error);};
  worker.onmessage=({data})=>{if(data.id!==pending?.id)return;data.ok?finish(null,data):finish(Error(data.error));};
  worker.onerror=e=>{e.preventDefault();close(Error(e.message));};worker.onmessageerror=()=>close(Error('RAW worker message could not be read'));
  return {close,call(command,args={},transfer=[]){
   if(terminated)return Promise.reject(Error('Superseded or worker failed'));
   if(pending)return Promise.reject(Error('Image worker request already active'));
   return new Promise((resolve,reject)=>{
    const id=++request,timer=setTimeout(()=>close(Error('RAW worker timed out')),30000);pending={id,timer,resolve,reject};
    try{worker.postMessage({id,command,...args},transfer);}catch(error){close(error);}
   });
  }};
 }
 async function clear(){
  exportHost?.cancel();generation++;imageWorker?.close();imageWorker=null;
  const prior=current;current=null;
  await device.queue.onSubmittedWorkDone();prior?.resources?.ownedTextures.forEach(t=>t.destroy());
 }
 function requirePath(value){if(closed||!file||value!==path)throw Error('Unknown browser document');}
 async function execute(command,args={}){
  if(closed)throw Error('Browser session closed');
  trace.push({command});
  if(command==='clear_session_caches'){await clear();return;}
  if(command==='load_settings')return structuredClone(getPreviewSettings());
  if(command==='get_image_dimensions'){requirePath(args.path);if(!current||current.version!==generation)throw Error('Browser RAW is not ready');return {width:current.width,height:current.height};}
  if(command==='load_metadata'){requirePath(args.path);return {adjustments:null};}
  if(command==='load_image'){
   requirePath(args.path);await clear();const version=generation,selected=file;
   const client=createImageWorker();imageWorker=client;
   const bytes=await selected.arrayBuffer();check(version);
   const image=await client.call('load',{bytes},[bytes]);check(version);
   current={version,width:image.width,height:image.height,asShot:image.asShot,client,resources:null,preview:null};
   trace.push({command:'load-result',width:image.width,height:image.height,developmentMode:image.developmentMode,rgbSha256:image.rgbSha256});
   return {width:image.width,height:image.height,is_raw:true,as_shot_white_balance:image.asShot.whiteBalance,
    metadata:{adjustments:null},exif:{},development_mode:image.developmentMode};
  }
  if(command==='apply_adjustments'||command==='generate_uncropped_preview'){
   const uncropped=command==='generate_uncropped_preview';
   const image=current;if(!image)throw Error('No browser RAW image loaded');check(image.version);
   if(args.roi!=null||args.computeWaveform)throw new UnavailableCommandError('ROI/waveform');
   const settings=getPreviewSettings(),liveQuality=settings?.livePreviewQuality??'high';
   const interactive=uncropped?false:!!args.isInteractive,previewDim=args.targetResolution??settings?.editorPreviewResolution??1920;
   if(typeof liveQuality!=='string'||liveQuality.length>128)throw TypeError('Invalid live preview quality');

   if(!Number.isSafeInteger(previewDim)||previewDim<1||previewDim>32768)throw TypeError('Invalid original preview target');
   const adjustments=args.jsAdjustments;
   if(!adjustments||typeof adjustments!=='object'||Array.isArray(adjustments))throw TypeError('Expected original adjustments');
   const orientationSteps=adjustments.orientationSteps??0,flipHorizontal=adjustments.flipHorizontal??false,flipVertical=adjustments.flipVertical??false;
   if(!Number.isSafeInteger(orientationSteps)||orientationSteps<0||orientationSteps>3||typeof flipHorizontal!=='boolean'||typeof flipVertical!=='boolean')throw TypeError('Invalid original rotation/flip');
   const rotation=uncropped?0:adjustments.rotation??0;
   if(typeof rotation!=='number'||!Number.isFinite(rotation)||rotation < -45||rotation > 45)throw TypeError('Expected fine rotation -45..45 degrees');
   const crop=uncropped?null:adjustments.crop??null;
   if(crop!==null){
    if(typeof crop!=='object'||Array.isArray(crop)||Object.keys(crop).some(k=>!['x','y','width','height','unit'].includes(k))||crop.unit!==undefined&&crop.unit!=='px'||!['x','y','width','height'].every(k=>Number.isSafeInteger(crop[k]))||crop.x<0||crop.y<0||crop.width<1||crop.height<1||crop.width>32768||crop.height>32768)throw TypeError('Expected bounded integer full-image crop');
   }
   const geometry={orientationSteps,flipHorizontal,flipVertical,rotation,crop:crop===null?null:{x:crop.x,y:crop.y,width:crop.width,height:crop.height}};
   const key=JSON.stringify([uncropped,previewDim,geometry,interactive?liveQuality:'final']);
   for(const [key,value] of Object.entries(adjustments)){
    if(uncropped&&key==='showClipping')continue;
    if(supported.has(key)||['rotation','orientationSteps','flipHorizontal','flipVertical','crop','aspectRatio'].includes(key))continue;
    if(JSON.stringify(value)!==JSON.stringify(defaults[key]))throw new UnavailableCommandError(`adjustment ${key}`);
   }
   for(const key of supported){if(key==='toneMapper'){if(!['basic','agx'].includes(adjustments[key]??'basic'))throw TypeError('Invalid tone mapper');}
    else if(typeof adjustments[key]!=='number'||!Number.isFinite(adjustments[key]))throw TypeError('Expected finite original Basic value');}
   if(image.preview?.key!==key){
    const preview=await image.client.call(uncropped?'uncropped':'preview',{previewDim,interactive,liveQuality,...geometry});check(image.version);
    const inputRgbaF16=packRgb32fRendererInput(wasm,preview.width,preview.height,preview.data);
    if(preview.alphaWords){
     if(!(preview.alphaWords instanceof Uint16Array)||preview.alphaWords.length!==preview.width*preview.height||preview.alphaWords.some(a=>a>0x3c00))throw TypeError('Invalid original rotation alpha');
     for(let i=0;i<preview.alphaWords.length;i++)inputRgbaF16[i*4+3]=preview.alphaWords[i];
    }
    await device.queue.onSubmittedWorkDone();check(image.version);
    image.resources?.ownedTextures.forEach(t=>t.destroy());image.resources=null;image.preview=null;
    image.resources=createNeutralRendererResources(device,{width:preview.width,height:preview.height,inputRgbaF16});
    image.preview={width:preview.width,height:preview.height,target:previewDim,key,quality:preview.quality,divisor:preview.divisor,scaleForGpu:preview.scaleForGpu,cropOffset:[preview.cropOffsetX??0,preview.cropOffsetY??0]};
    trace.push({command:uncropped?'uncropped-preview-result':'preview-result',geometry,target:previewDim,interactive,liveQuality,quality:preview.quality,divisor:preview.divisor,width:preview.width,height:preview.height,originalWidth:image.width,originalHeight:image.height,scaleForGpu:preview.scaleForGpu,cropOffset:[preview.cropOffsetX??0,preview.cropOffsetY??0],rgbSha256:preview.rgbSha256,uploadSha256:await hash(inputRgbaF16)});
   }
   const packed=packGlobalRendererFixture(wasm,JSON.stringify(uncropped?{...adjustments,showClipping:false}:adjustments),image.asShot,{baselineExposure:0,compensateHighlightPreservation:true});
   const frame=await renderOriginalFrame({device,width:image.preview.width,height:image.preview.height,shaderSource,
    inputTexture:image.resources.inputTexture,adjustments:packed,resources:image.resources.resources,outputPrecision:'eight'});
   check(image.version);
   if(uncropped){
    const bytes=wasm.encode_uncropped_preview(frame.width,frame.height,frame.pixels);
    const reader=new FileReader();const dataUrl=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(new Blob([bytes],{type:'image/jpeg'}));});check(image.version);
    trace.push({command:'uncropped-result',geometry,width:frame.width,height:frame.height,quality:80,bytes:bytes.byteLength,rgbSha256:trace.findLast(t=>t.command==='uncropped-preview-result')?.rgbSha256,scaleForGpu:image.preview.scaleForGpu,cropOffset:image.preview.cropOffset,adjustmentSha256:await hash(packed.bytes),rgbaSha256:await hash(frame.pixels),jpegSha256:await hash(bytes)});
    check(image.version);return dataUrl;
   }
   const response=encodePreviewResponse(wasm,frame,{interactive,quality:image.preview.quality});
   const hashes={adjustmentSha256:await hash(packed.bytes),rgbaSha256:await hash(frame.pixels),responseSha256:await hash(response),jpegSha256:await hash(interactive?response.slice(24):response)};check(image.version);
   trace.push({...hashes,command:'render-result',geometry,exposure:adjustments.exposure,width:frame.width,height:frame.height,
    interactive,liveQuality,quality:image.preview.quality,divisor:image.preview.divisor,rect:interactive?Array.from({length:6},(_,i)=>new DataView(response).getUint32(i*4,true)):null,bytes:response.byteLength,analytics:'unavailable',adjustments:structuredClone(adjustments)});
   return response;
  }
  throw new UnavailableCommandError(command);
 }
 return {
  trace,
  selectFile(selected){if(!(selected instanceof File)||!isRawInputSizeAllowed(selected.size))throw TypeError('Select a bounded RAW File');if(closed)throw Error('Browser session closed');exportHost?.cancel();imageWorker?.close();generation++;file=selected;const name=selected.name.replace(/[\\/\x00-\x1f\x7f]/g,'_').slice(0,180)||'input.raw';path=`browser-document:${crypto.randomUUID()}/${name}`;return path;},
  listen(event,callback){
   if(closed||typeof event!=='string'||event.length>128||typeof callback!=='function')return Promise.reject(Error('Invalid event subscription'));
   if([...listeners.values()].reduce((n,set)=>n+set.size,0)>=128)return Promise.reject(Error('Listener limit'));
   if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(callback);
   return Promise.resolve(()=>{listeners.get(event)?.delete(callback);if(!listeners.get(event)?.size)listeners.delete(event);});
  },
  async pickExport(options){if(!exportHost||closed)throw nativeError(new UnavailableCommandError('save dialog'));try{return await exportHost.pick(options);}catch(error){throw nativeError(error);}},
  invoke(command,args){
   if(command==='export_images'||command==='cancel_export'){
    trace.push({command});if(!exportHost||closed)return Promise.reject(nativeError(new UnavailableCommandError(command)));
    // Export and cancellation never wait behind a preview or a pending export.
    try{return Promise.resolve(command==='cancel_export'?exportHost.cancel():exportHost.execute(args)).catch(error=>{throw nativeError(error);});}catch(error){return Promise.reject(nativeError(error));}
   }
   if(command==='clear_session_caches')exportHost?.cancel();
   const result=queue.then(()=>execute(command,args));queue=result.catch(()=>{});return result;
  },
  async close(){closed=true;await clear();await exportHost?.close();file=null;path=null;await queue;listeners.clear();},
 };
}
