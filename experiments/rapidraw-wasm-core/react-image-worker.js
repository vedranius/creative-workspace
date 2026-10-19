// Persistent, private-to-document Quality image owner. No paths/network/writes.
import init,{develop_pixels,read_as_shot,resize_preview_rgb32f,resize_interactive_rgb32f,orient_preview_rgb32f,resize_uncropped_rgb32f,fine_preview_rgb32f,crop_preview_rgb32f,preview_dimensions} from './cw_rapidraw_wasm_probe.js';
let ready,image=null,base=null,geometry=null,uncropped=null;
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
self.onmessage=async({data})=>{
 const {id,command,bytes,previewDim,interactive=false,liveQuality='high',orientationSteps=0,flipHorizontal=false,flipVertical=false,rotation=0,crop=null}=data??{};
 if(!Number.isSafeInteger(id)){self.postMessage({id,ok:false,error:'Expected request id'});return;}
 try{
  if(!ready)ready=init();await ready;
  if(command==='load'){
   image=null;base=null;geometry=null;uncropped=null;
   if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<1||bytes.byteLength>128*1024*1024)throw Error('RAW input must be1byte..128MiB');
   const input=new Uint8Array(bytes),asShot=JSON.parse(read_as_shot(input));
   const developed=develop_pixels(input,false,'default');
   if(developed.components!==3)throw Error('Original React Quality slice requires RGB');
   image=developed;
   self.postMessage({id,ok:true,width:image.width,height:image.height,asShot,developmentMode:'native-quality',rgbSha256:await hash(image.data)});
  }else if(command==='uncropped'){
   if(!image)throw Error('No Quality image loaded');
   if(!Number.isSafeInteger(previewDim)||previewDim<1||previewDim>32768)throw Error('Invalid uncropped preview target');
   const key=JSON.stringify([previewDim,orientationSteps,flipHorizontal,flipVertical]);
   if(uncropped?.key!==key){
    const resized=resize_uncropped_rgb32f(image.width,image.height,image.data,previewDim);
    const scaleForGpu=Math.fround(resized.width/image.width);
    uncropped={...orient_preview_rgb32f(resized.width,resized.height,resized.data,orientationSteps,flipHorizontal,flipVertical),scaleForGpu,key};
   }
   const preview={...uncropped,data:uncropped.data.slice(),cropOffsetX:0,cropOffsetY:0};
   self.postMessage({id,ok:true,...preview,rgbSha256:await hash(preview.data)},[preview.data.buffer]);
  }else if(command==='preview'){
   if(typeof rotation!=='number'||!Number.isFinite(rotation)||rotation < -45||rotation > 45)throw Error('Invalid original fine rotation');
   if(!image)throw Error('No Quality image loaded');
   if(!Number.isSafeInteger(previewDim)||previewDim<1||previewDim>32768)throw Error('Invalid preview target');
   const key=JSON.stringify([previewDim,orientationSteps,flipHorizontal,flipVertical,crop,rotation]);
   if(geometry?.key!==key){
    if(rotation!==0){
     geometry={...fine_preview_rgb32f(image.width,image.height,image.data,previewDim,orientationSteps,flipHorizontal,flipVertical,JSON.stringify(crop),rotation),key};base=null;
    }else if(crop!==null){
     geometry={...crop_preview_rgb32f(image.width,image.height,image.data,previewDim,orientationSteps,flipHorizontal,flipVertical,JSON.stringify(crop)),key};
     base=null;
    }else{
     const dimensions=preview_dimensions(image.width,image.height,previewDim);
     if(dimensions.width*dimensions.height*76+132>64*1024*1024)throw Error('Preview exceeds bounded64MiB texture payload capacity');
     if(base?.target!==previewDim)base={...resize_preview_rgb32f(image.width,image.height,image.data,previewDim),target:previewDim};
     geometry={...orient_preview_rgb32f(base.width,base.height,base.data,orientationSteps,flipHorizontal,flipVertical),key};
     geometry.scaleForGpu=Math.fround(geometry.width/(orientationSteps%2?image.height:image.width));geometry.cropOffsetX=0;geometry.cropOffsetY=0;
    }
   }
   if(interactive&&rotation!==0)throw Error("Fine rotation interactive sizing remains unsupported");
   const scaleForGpu=geometry.scaleForGpu;
   const preview=interactive?resize_interactive_rgb32f(geometry.width,geometry.height,geometry.data,previewDim,liveQuality):{...geometry,data:geometry.data.slice(),quality:94,divisor:1};
   if(geometry.alphaWords)preview.alphaWords=geometry.alphaWords.slice();
   preview.cropOffsetX=geometry.cropOffsetX;preview.cropOffsetY=geometry.cropOffsetY;
   preview.scaleForGpu=Math.fround(scaleForGpu*Math.fround(preview.width/geometry.width));
   self.postMessage({id,ok:true,...preview,rgbSha256:await hash(preview.data)},[preview.data.buffer,...(preview.alphaWords?[preview.alphaWords.buffer]:[])]);
  }else throw Error('Unsupported image worker command');
 }catch(error){self.postMessage({id,ok:false,error:String(error?.message??error)});}
};
