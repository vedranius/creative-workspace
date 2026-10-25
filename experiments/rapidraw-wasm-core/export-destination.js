// Experimental browser-only capability; no common provider/server availability claim.
// Never replay: each empty-file lease is single-use and tied to its document generation.
const MAX_BYTES=64*1024*1024;
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
export function createExportDestination({pickFile=o=>globalThis.showSaveFilePicker(o),getRetention=()=> 'until-ack',getRoot=()=>navigator.storage.getDirectory(),ioTimeoutMs=30000,format='jpeg',coordinateRecovery=false,getLocks=()=>globalThis.navigator?.locks}={}){
 const preset=format==='rrpreset';if(!preset&&format!=='jpeg')throw Error('Unsupported output format');
 const maxBytes=preset?64*1024:MAX_BYTES,recoveryName=preset?'output.rrpreset':'output.jpg';
 if(!Number.isSafeInteger(ioTimeoutMs)||ioTimeoutMs<1||ioTimeoutMs>30000)throw Error('Invalid output deadline');
 const leases=new Map(),taken=new WeakSet(),receipts=new WeakMap(),pending=new Set();let busy=false;
 const track=promise=>{pending.add(promise);promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;};
 const abort=writer=>track(Promise.resolve().then(()=>writer.abort())).catch(()=>{});
 const budget=()=>{
  const end=Date.now()+ioTimeoutMs;
  return async(operation,label,onLate)=>{
   const remaining=end-Date.now();if(remaining<=0)throw Error('Output deadline exceeded');
   const promise=track(Promise.resolve().then(operation));let expired=false,timer;
   promise.then(value=>{if(expired&&onLate)Promise.resolve().then(()=>onLate(value)).catch(()=>{});},()=>{});
   try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error(label+' timed out'));},remaining);})]);}finally{clearTimeout(timer);}
  };
 };
 // Opt-in protocol: old uncoordinated entries are copyable, never discardable.
 // Return a timed-out result promptly, but retain the origin-wide lock until late I/O drains.
 const guarded=operation=>{
  if(!coordinateRecovery)return operation();
  const locks=getLocks();if(typeof locks?.request!=='function')throw Error('Coordinated recovery requires Web Locks');
  return new Promise((resolve,reject)=>{
   const settle=result=>result.ok?resolve(result.value):reject(result.error);
   Promise.resolve(locks.request('cw-rapidraw-journal:'+(preset?'preset':'jpeg'),{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock)return {ok:false,error:Error('Recovery journal busy; wait for active output I/O')};
    let result;try{result={ok:true,value:await operation()};}catch(error){result={ok:false,error};}
    if(pending.size){settle(result);while(pending.size)await Promise.allSettled([...pending]);}
    return result;
   })).then(settle,reject);
  });
 };
 const journal=async run=>(await run(getRoot,'Open recovery storage')).getDirectoryHandle(preset?'cw-rapidraw-preset-recovery':'cw-rapidraw-export-recovery',{create:true});
 async function metadata(run,dir,value){
  const handle=await run(()=>dir.getFileHandle('record.json',{create:true}),'Open recovery record');
  const writer=await run(()=>handle.createWritable(),'Open recovery record stream',w=>abort(w));
  try{await run(()=>writer.write(JSON.stringify(value)),'Write recovery record');await run(()=>writer.close(),'Close recovery record');}
  catch(e){abort(writer);throw e;}
 }
 async function records(run){
  const root=await run(()=>journal(run),'Open recovery journal'),items=[];
  await run(async()=>{for await(const [id,dir]of root.entries()){
   if(items.length>=64)throw Error('Recovery inventory limit reached');
   if(dir.kind==='directory')items.push([id,dir]);
  }},'List recovery journal');
  return {root,items};
 }
 return {
  async choose(options,document){
   if(!document?.file||!document.ready)throw Error('Load an export source first');
   for(const [token,lease]of leases)if(lease.expires<Date.now())leases.delete(token);
   if(leases.size>=16)throw Error('Too many pending output choices');
   const binding={path:document.path,generation:document.generation,sourceName:document.file.name};
   const retention=getRetention();if(!['until-ack','keep'].includes(retention))throw Error('Choose output retention separately');
   const suggestedName=String(options?.defaultPath??(preset?'all_presets.rrpreset':'edited.jpg')).split(/[\\/]/).at(-1);
   if(!suggestedName||suggestedName.length>240||/[\x00-\x1f]/.test(suggestedName))throw Error('Invalid output name');
   let handle;try{handle=await pickFile({suggestedName,types:preset?[{description:'RapidRAW preset',accept:{'application/json':['.rrpreset']}}]:[{description:'JPEG',accept:{'image/jpeg':['.jpg','.jpeg']}}]});}catch(e){if(e.name==='AbortError')return null;throw e;}
   if(handle?.kind!=='file'||typeof handle.createWritable!=='function'||!(preset?/\.rrpreset$/i:/\.jpe?g$/i).test(handle.name)||handle.name===binding.sourceName)throw Error(preset?'Choose a new preset output file':'Choose a new JPEG output file');
   const run=budget();
   if(await run(()=>handle.queryPermission({mode:'readwrite'}),'Check output permission')!=='granted')throw Error('Output write permission not granted');
   const before=await run(()=>handle.getFile(),'Inspect output');if(before.size!==0)throw Error('Output already exists; choose a new empty file');
   if(leases.size>=16)throw Error('Too many pending output choices');
   const token='browser-export:'+crypto.randomUUID();leases.set(token,{handle,before,retention,...binding,expires:Date.now()+300000});return token;
  },
  take(token,document){
   const lease=leases.get(token);leases.delete(token);
   if(!lease||lease.path!==document?.path||lease.generation!==document?.generation||Date.now()>lease.expires)throw Error('Output capability expired or belongs to another document');
   taken.add(lease);return lease;
  },
  async write(lease,bytes,check){
   if(!taken.delete(lease))throw Error('Invalid or consumed output capability');
   if(busy||pending.size)throw Error('Previous output I/O still active');
   if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>maxBytes)throw Error('Invalid bounded output');
   return guarded(async()=>{
   busy=true;const run=budget();let writer,dir,root,record,durable=false;
   try{
    check();const inventory=await records(run);root=inventory.root;
    if(inventory.items.length>=63)throw Error('Recovery inventory full; review retained outputs');
    const id=crypto.randomUUID();dir=await run(()=>root.getDirectoryHandle(id,{create:true}),'Create recovery entry');
    record={schema:1,id,state:'preparing',name:lease.handle.name,sha256:await run(()=>hash(bytes),'Hash JPEG'),bytes:bytes.length,destination:'laptop',retention:lease.retention,createdAt:Date.now(),...(coordinateRecovery?{coordination:'web-lock-v1'}:{})};
    await metadata(run,dir,record);
    const copy=await run(()=>dir.getFileHandle(recoveryName,{create:true}),'Open recovery JPEG');
    const copyWriter=await run(()=>copy.createWritable(),'Open recovery stream',w=>abort(w));
    try{await run(()=>copyWriter.write(bytes),'Write recovery JPEG');await run(()=>copyWriter.close(),'Close recovery JPEG');}
    catch(e){abort(copyWriter);throw e;}
    const saved=await run(()=>copy.getFile(),'Read recovery JPEG');
    if(saved.size!==bytes.length||await run(async()=>hash(await saved.arrayBuffer()),'Verify recovery JPEG')!==record.sha256)throw Error('Recovery JPEG did not match');
    durable=true;record.state='uncertain';await metadata(run,dir,record);
    const fresh=async()=>{
     check();if(await run(()=>lease.handle.queryPermission({mode:'readwrite'}),'Check write permission')!=='granted')throw Error('Output permission revoked');
     const file=await run(()=>lease.handle.getFile(),'Check current output');check();
     if(file.size!==lease.before.size||file.lastModified!==lease.before.lastModified)throw Error('Output changed since selection; refusing overwrite');
    };
    await fresh();writer=await run(()=>lease.handle.createWritable({keepExistingData:false,mode:'exclusive'}),'Open output',w=>abort(w));
    await fresh();await run(()=>writer.write(bytes),'Write output');await fresh();
    await run(()=>writer.close(),'Close output');writer=null;check();
    const actual=await run(()=>lease.handle.getFile(),'Read output ACK');
    if(actual.size!==bytes.length||await run(async()=>hash(await actual.arrayBuffer()),'Verify output ACK')!==record.sha256)throw Error('Output ACK readback mismatch');
    check();record.state='acknowledged';await metadata(run,dir,record);check();
    const ack=Object.freeze({writeAcknowledged:true,sha256:record.sha256,bytes:bytes.length,retention:lease.retention,recoveryId:record.id});
    receipts.set(ack,{dir,root,record});return ack;
   }catch(e){
    if(writer){const cleanup=abort(writer);await run(()=>cleanup,'Abort output').catch(()=>{});}
    const error=Error((durable?'Export output retained for recovery ('+record.id+'): ':'Recovery journal incomplete; destination untouched: ')+(e.message??e));
    error.recoveryId=record?.id??null;error.outputRetained=durable;throw error;
   }finally{busy=false;}
   });
  },
  // Only after the host synchronously accepts the ACK for this generation.
  // Cleanup failure retains a complete record and cannot undo a true write ACK.
  async complete(ack){
   const receipt=receipts.get(ack);if(!receipt)throw Error('Unknown output receipt');receipts.delete(ack);
   const run=budget(),{dir,root,record}=receipt;
   try{return await guarded(async()=>{await metadata(run,dir,{...record,state:'complete'});if(record.retention==='until-ack'){await run(()=>root.removeEntry(record.id,{recursive:true}),'Release acknowledged recovery');return {...ack,recoveryId:null};}return ack;});}
   catch{return {...ack,retentionCleanupPending:true};}
  },
  async discardRecovery(expected,check){
   if(!coordinateRecovery||preset||expected?.coordination!=='web-lock-v1')throw Error('Older recovery copies can be saved; discard requires a coordinated record');
   if(expected.schema!==1||!['uncertain','acknowledged','complete'].includes(expected.state)||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(expected.id)||!Number.isSafeInteger(expected.bytes)||expected.bytes<4||expected.bytes>MAX_BYTES||!/^[a-f0-9]{64}$/.test(expected.sha256)||typeof check!=='function')throw Error('Invalid recovery discard identity');
   return guarded(async()=>{
    if(busy||pending.size)throw Error('Recovery journal has active I/O');
    const run=budget();check();const root=await journal(run),dir=await run(()=>root.getDirectoryHandle(expected.id),'Find discard entry');
    const matches=async()=>{
     const file=await run(async()=>(await dir.getFileHandle('record.json')).getFile(),'Read discard identity');
     if(file.size>4096)throw Error('Oversize discard identity');
     const record=JSON.parse(await run(()=>file.text(),'Decode discard identity'));
     if(JSON.stringify(record)!==JSON.stringify(expected))throw Error('Recovery record changed; verify again');
    };
    await matches();check();
    const file=await run(async()=>(await dir.getFileHandle(recoveryName)).getFile(),'Read discard JPEG');
    if(file.size!==expected.bytes||file.size>MAX_BYTES)throw Error('Recovery bytes changed; verify again');
    const bytes=new Uint8Array(await run(()=>file.arrayBuffer(),'Verify discard bytes'));
    if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217||await run(()=>hash(bytes),'Hash discard JPEG')!==expected.sha256)throw Error('Recovery bytes changed; verify again');
    await matches();check();
    await run(()=>root.removeEntry(expected.id,{recursive:true}),'Discard recovery copy');check();
    try{await run(()=>root.getDirectoryHandle(expected.id),'Confirm discard');}catch(error){if(error.name==='NotFoundError'){check();return {discardAcknowledged:true,id:expected.id};}throw error;}
    throw Error('Recovery removal was not acknowledged; refresh to reconcile');
   });
  },
  async listRecovery(){
   const run=budget(),{items}=await records(run),result=[];
   for(const[id,dir]of items){
    try{const file=await run(async()=>(await dir.getFileHandle('record.json')).getFile(),'Read recovery metadata');if(file.size>4096)throw Error('Oversize metadata');const value=JSON.parse(await run(()=>file.text(),'Decode recovery metadata'));if(value.id!==id)throw Error('Recovery identity mismatch');result.push(value);}
    catch{result.push({id,state:'unreadable'});}
   }
   return result;
  },
  async readRecovery(id){
   if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id))throw Error('Invalid recovery id');
   const run=budget(),root=await run(()=>journal(run),'Open recovery journal');
   const dir=await run(()=>root.getDirectoryHandle(id),'Find recovery entry');
   const file=await run(async()=>(await dir.getFileHandle(recoveryName)).getFile(),'Read recovery output');
   if(file.size<1||file.size>maxBytes)throw Error('Invalid recovery output size');
   const meta=await run(async()=>(await dir.getFileHandle('record.json')).getFile(),'Read recovery record');
   if(meta.size>4096)throw Error('Oversize recovery metadata');
   const record=JSON.parse(await run(()=>meta.text(),'Decode recovery record'));
   const bytes=new Uint8Array(await run(()=>file.arrayBuffer(),'Read recovery bytes'));
   if(record.id!==id||record.bytes!==bytes.length||await run(()=>hash(bytes),'Verify retained JPEG')!==record.sha256)throw Error('Recovery bytes did not match');
   return bytes;
  },
 };
}
