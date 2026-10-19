// Dedicated original RAW Quality -> full geometry -> EightBit -> export codec.
// Restricted experimental Basic/quarter-turn slice; no original ExportPanel command.
import init,*as wasm from './cw_rapidraw_wasm_probe.js';
import {fullExportPlan,createFullExportResources,packRgb32fRendererInput,packGlobalRendererFixture,renderOriginalFrame} from './webgpu-renderer.js';
let active=null,ready;
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const basic=new Set(['exposure','brightness','contrast','highlights','shadows','whites','blacks','toneMapper','orientationSteps','flipHorizontal','flipVertical','showClipping']);
self.onmessage=async({data:d})=>{
 if(!Number.isSafeInteger(d?.id))return;
 if(d.command==='cancel'){
  if(active?.id===d.id){
   active.cancelled=true;
   active.resources?.ownedTextures.forEach(t=>t.destroy());active.device?.destroy();
   // Acknowledge explicit API destruction without waiting for a pending readback.
   // The client terminates this worker; no cancelled JPEG can be published.
   self.postMessage({id:d.id,ok:false,reason:'aborted',deviceDestroyed:!!active.device});
  }
  return;
 }
 if(d.command!=='start'||active){self.postMessage({id:d.id,ok:false,reason:'busy-or-command'});return;}
 const job={id:d.id,cancelled:false,device:null};active=job;let resources,result;
 const check=()=>{if(job.cancelled)throw Error('Export cancelled');};
 const stage=async(status,detail={})=>{self.postMessage({id:d.id,status,...detail});await tick();check();};
 try{
  if(!(d.bytes instanceof ArrayBuffer)||d.bytes.byteLength<1||d.bytes.byteLength>128*1024*1024)throw Error('RAW input must be1byte..128MiB');
  if(!d.adjustments||typeof d.adjustments!=='object'||Array.isArray(d.adjustments)||JSON.stringify(d.adjustments).length>65536)throw Error('Invalid bounded adjustments');
  if(!d.settings||typeof d.settings!=='object'||Array.isArray(d.settings)||JSON.stringify(d.settings).length>4096)throw Error('Invalid bounded codec settings');
  ready??=init();await ready;check();
  const defaults=await(await fetch(new URL('./defaultAdjustments.json',import.meta.url))).json();check();
  for(const[k,v]of Object.entries(d.adjustments)){
   if(!Object.hasOwn(defaults,k)||!basic.has(k)&&JSON.stringify(v)!==JSON.stringify(defaults[k]))throw Error(`Unsupported full export adjustment ${k}`);
  }
  const adjustments={...defaults,...d.adjustments,showClipping:false};
  for(const key of ['exposure','brightness','contrast','highlights','shadows','whites','blacks'])if(typeof adjustments[key]!=='number'||!Number.isFinite(adjustments[key]))throw Error('Expected finite original Basic values');
  if(!['basic','agx'].includes(adjustments.toneMapper))throw Error('Invalid original tone mapper');
  const steps=adjustments.orientationSteps,h=adjustments.flipHorizontal,v=adjustments.flipVertical;
  if(!Number.isInteger(steps)||steps<0||steps>3||typeof h!=='boolean'||typeof v!=='boolean')throw Error('Invalid original orientation/flip');
  wasm.preflight_jpeg_export(1,1,JSON.stringify(d.settings));
  const input=new Uint8Array(d.bytes),sensor=JSON.parse(wasm.inspect_sensor(input));
  if(sensor.width>4096||sensor.height>4096||sensor.sampleCount>4*1024*1024)throw Error('Full export sensor exceeds dedicated4M sample preflight');
  await stage('sensor-preflight',{sensor});
  const asShot=JSON.parse(wasm.read_as_shot(input));
  const developed=wasm.develop_pixels(input,false,'default');check();
  if(developed.components!==3)throw Error('Full export requires native Quality RGB');
  fullExportPlan(developed.width,developed.height);
  const developedSha256=await hash(developed.data);
  await stage('developed',{width:developed.width,height:developed.height,rgbSha256:developedSha256});
  // No preview resampling: source orientation/flip applies directly to full RGB.
  const image=wasm.orient_preview_rgb32f(developed.width,developed.height,developed.data,steps,h,v);
  wasm.preflight_jpeg_export(image.width,image.height,JSON.stringify(d.settings));
  const plan=fullExportPlan(image.width,image.height),rgbSha256=await hash(image.data);
  const upload=packRgb32fRendererInput(wasm,image.width,image.height,image.data),uploadSha256=await hash(upload);
  const packed=packGlobalRendererFixture(wasm,JSON.stringify(adjustments),asShot,{baselineExposure:0,compensateHighlightPreservation:true});
  const adjustmentSha256=await hash(packed.bytes);
  await stage('prepared',{...plan,rgbSha256,uploadSha256,adjustmentSha256});
  const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw Error('No WebGPU export adapter');
  check();job.device=await adapter.requestDevice();check();
  const gpuErrors=[];job.device.addEventListener('uncapturederror',e=>gpuErrors.push(e.error.message));
  const shaderSource=await(await fetch(new URL('./shader.wgsl',import.meta.url))).text();check();
  resources=createFullExportResources(job.device,{width:image.width,height:image.height,inputRgbaF16:upload});
  job.resources=resources;
  const frame=await renderOriginalFrame({device:job.device,width:image.width,height:image.height,inputTexture:resources.inputTexture,resources:resources.resources,
   adjustments:packed,shaderSource,outputPrecision:'eight',onSubmitted:()=>self.postMessage({id:d.id,status:'gpu-submitted'})});
  check();if(gpuErrors.length)throw Error(gpuErrors.join(';'));
  const rgbaSha256=await hash(frame.pixels);await stage('rendered',{width:frame.width,height:frame.height,rgbaSha256});
  const bytes=wasm.encode_rendered_rgba8_jpeg(frame.width,frame.height,frame.pixels,JSON.stringify(d.settings));check();
  result={id:d.id,ok:true,width:frame.width,height:frame.height,bytes,developedSha256,rgbSha256,uploadSha256,adjustmentSha256,rgbaSha256,jpegSha256:await hash(bytes),plan,gpuErrors};
 }catch(e){result={id:d.id,ok:false,reason:job.cancelled?'aborted':'export-error',error:String(e?.message??e)};}
 finally{
  resources?.ownedTextures.forEach(t=>t.destroy());job.device?.destroy();active=null;
 }
 if(job.cancelled)result={id:d.id,ok:false,reason:'aborted',deviceDestroyed:!!job.device};
 else result.deviceDestroyed=!!job.device;
 self.postMessage(result,result.bytes?[result.bytes.buffer]:[]);
};
