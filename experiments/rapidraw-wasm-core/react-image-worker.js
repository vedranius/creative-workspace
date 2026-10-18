// Persistent, private-to-document Quality image owner. No paths/network/writes.
import init,{develop_pixels,read_as_shot,resize_preview_rgb32f,resize_interactive_rgb32f,preview_dimensions} from './cw_rapidraw_wasm_probe.js';
let ready,image=null,base=null;
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
self.onmessage=async({data})=>{
 const {id,command,bytes,previewDim,interactive=false,liveQuality='high'}=data??{};
 if(!Number.isSafeInteger(id)){self.postMessage({id,ok:false,error:'Expected request id'});return;}
 try{
  if(!ready)ready=init();await ready;
  if(command==='load'){
   image=null;base=null;
   if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<1||bytes.byteLength>128*1024*1024)throw Error('RAW input must be1byte..128MiB');
   const input=new Uint8Array(bytes),asShot=JSON.parse(read_as_shot(input));
   const developed=develop_pixels(input,false,'default');
   if(developed.components!==3)throw Error('Original React Quality slice requires RGB');
   image=developed;
   self.postMessage({id,ok:true,width:image.width,height:image.height,asShot,developmentMode:'native-quality',rgbSha256:await hash(image.data)});
  }else if(command==='preview'){
   if(!image)throw Error('No Quality image loaded');
   if(!Number.isSafeInteger(previewDim)||previewDim<1||previewDim>32768)throw Error('Invalid preview target');
   const dimensions=preview_dimensions(image.width,image.height,previewDim);
   if(dimensions.width*dimensions.height*76+132>64*1024*1024)throw Error('Preview exceeds bounded64MiB texture payload capacity');
   if(base?.target!==previewDim)base={...resize_preview_rgb32f(image.width,image.height,image.data,previewDim),target:previewDim};
   const preview=interactive?resize_interactive_rgb32f(base.width,base.height,base.data,previewDim,liveQuality):{...base,data:base.data.slice(),quality:94,divisor:1};
   preview.scaleForGpu=Math.fround(base.scaleForGpu*Math.fround(preview.width/base.width));
   self.postMessage({id,ok:true,...preview,rgbSha256:await hash(preview.data)},[preview.data.buffer]);
  }else throw Error('Unsupported image worker command');
 }catch(error){self.postMessage({id,ok:false,error:String(error?.message??error)});}
};
