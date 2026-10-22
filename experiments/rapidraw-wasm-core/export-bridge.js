import {exportRawInWorker} from './export-client.js';
// Native single-file export argument shape; original ExportPanel composition is separate.
export function createExportBridge({getDocument,emit,destination,runExport=exportRawInWorker}){
 let active=null,closed=false;
 const allowed=new Set(['filenameTemplate','jpegQuality','tiffBitDepth','keepMetadata','preserveTimestamps','preserveFolders','destinationType','subfolder','resize','border','pad','stripGps','exportMasks','watermark','dpi']);
 const fields=new Set(['paths','outputFolderOrFile','isExplicitFilePath','baseOriginFolders','exportSettings','outputFormat','currentEditPath','currentEditAdjustments']);
 const errorText=e=>String(e?.message??e);
 return {
  pick(options){if(closed)throw Error('Export host closed');return destination.choose(options,getDocument());},
  cancel(){if(active&&!active.controller.signal.aborted){active.controller.abort();emit('export-cancelling');}},
  async execute(input){
   if(closed||active)throw Error(closed?'Export host closed':'Export already active');
   let args;try{const json=JSON.stringify(input);if(!json||json.length>131072)throw Error('Export arguments exceed limit');args=JSON.parse(json);}catch{throw Error('Invalid bounded export arguments');}
   const document=getDocument(),file=document?.file,path=document?.path,generation=document?.generation,s=args?.exportSettings;
   if(!file||!document.ready||!Number.isSafeInteger(file.size)||file.size<1||file.size>128*1024*1024)throw Error('Load a bounded browser RAW first');
   if(!args||Array.isArray(args)||Object.keys(args).some(k=>!fields.has(k))||!Array.isArray(args.paths)||args.paths.length!==1||args.paths[0]!==path||args.currentEditPath!==path||args.isExplicitFilePath!==true||!['jpg','jpeg'].includes(args.outputFormat)||!Array.isArray(args.baseOriginFolders)||args.baseOriginFolders.length)throw Error('Only the current single-file JPEG export is available');
   if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!allowed.has(k))||s.keepMetadata!==false||s.preserveTimestamps!==false||s.preserveFolders!==false||s.exportMasks!==false||s.destinationType!=='customFolder'||s.subfolder!==''||s.border!==null||s.pad!==null||s.watermark!==null)throw Error('Export requires JPEG without metadata, folder preservation, border, pad, watermark or masks');
   if(!Number.isInteger(s.jpegQuality)||s.jpegQuality<1||s.jpegQuality>100||s.dpi!==null&&s.dpi!==undefined&&(!Number.isInteger(s.dpi)||s.dpi<1||s.dpi>65535))throw Error('Invalid JPEG quality or DPI');
   const lease=destination.take(args.outputFolderOrFile,{path,generation}),controller=new AbortController();
   let finished;const job={controller,done:new Promise(resolve=>{finished=resolve;})};active=job;let destinationStarted=false;
   const check=()=>{const now=getDocument();if(closed||controller.signal.aborted||now?.path!==path||now.generation!==generation||now.file!==file||!now.ready)throw Error('Export cancelled or document changed');};
   const read=async()=>{
    let timer,onAbort;
    try{return await Promise.race([file.arrayBuffer(),new Promise((_,reject)=>{onAbort=()=>reject(Error('Export cancelled while reading RAW'));controller.signal.addEventListener('abort',onAbort,{once:true});if(controller.signal.aborted)onAbort();timer=setTimeout(()=>reject(Error('RAW read timed out')),30000);})]);}
    finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);}
   };
   try{
    const bytes=await read();check();
    const result=await runExport(bytes,{adjustments:args.currentEditAdjustments,settings:{jpegQuality:s.jpegQuality,dpi:s.dpi,resize:s.resize},signal:controller.signal});
    if(!result.ok){if(result.reason==='aborted'){emit('export-cancelled');return null;}throw Error(result.error||result.reason);}
    check();destinationStarted=true;const ack=await destination.write(lease,result.bytes,check);check();
    if(ack?.writeAcknowledged!==true)throw Error('Destination did not acknowledge output');
    // No await between generation check and host success acceptance.
    emit('batch-export-progress',{current:1,total:1});check();emit('export-complete');
    try{return await destination.complete(ack);}catch{return {...ack,retentionCleanupPending:true};}
   }catch(e){
    if(controller.signal.aborted&&!destinationStarted){emit('export-cancelled');return null;}
    emit('export-error',errorText(e));throw errorText(e);
   }finally{if(active===job)active=null;finished();}
  },
  async close(){closed=true;const job=active;job?.controller.abort();await job?.done;},
 };
}
