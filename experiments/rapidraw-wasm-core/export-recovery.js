// Explicit recovery copy, never an export replay or permission to an old destination.
const LIMIT=64*1024*1024;
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
function admitted(r,preset=false){
 if(!r||r.schema!==1||!uuid.test(r.id)||!['uncertain','acknowledged','complete'].includes(r.state)||r.destination!=='laptop'||!['until-ack','keep'].includes(r.retention)||!Number.isSafeInteger(r.bytes)||r.bytes<(preset?1:4)||r.bytes>(preset?(64*1024):LIMIT)||!Number.isFinite(r.createdAt)||r.createdAt<=0||!/^[a-f0-9]{64}$/.test(r.sha256)||typeof r.name!=='string'||r.name.length>240||/[\\/\x00-\x1f\x7f]/.test(r.name)||!(preset?/\.rrpreset$/i:/\.jpe?g$/i).test(r.name))throw Error('Recovery record is unavailable or incomplete');
 return {schema:r.schema,id:r.id,state:r.state,name:r.name,sha256:r.sha256,bytes:r.bytes,destination:r.destination,retention:r.retention,createdAt:r.createdAt,...(r.coordination?{coordination:r.coordination}:{})};
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function createRecoverySession({journal,destination,format='jpeg',verifyPresetBytes,allowPresetDiscard=false}){
 const preset=format==='rrpreset';if(!preset&&format!=='jpeg'||preset&&typeof verifyPresetBytes!=='function')throw Error('Unsupported recovery format');
 const admit=r=>admitted(r,preset),limit=preset?(64*1024):LIMIT;
 const validate=async(bytes,record)=>{
  if(!(bytes instanceof Uint8Array)||bytes.length!==record.bytes||bytes.length>limit||await hash(bytes)!==record.sha256)throw Error('Recovery bytes did not match the verified copy');
  if(!preset){if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('Recovery bytes did not match the verified JPEG');return;}
  await verifyPresetBytes(bytes);
 };
 let inventory=new Map(),prepared=null,version=0,closed=false,busy=false;
 const check=expected=>{if(closed||expected!==version)throw Error('Recovery action closed or superseded');};
 const current=async record=>{
  const records=await journal.listRecovery();
  if(!Array.isArray(records)||records.length>64)throw Error('Recovery inventory exceeds limit');
  const matches=records.filter(r=>r?.id===record.id);
  if(matches.length!==1)throw Error('Recovery identity changed; refresh the list');
  const found=matches[0];
  if(!same(admit(found),record))throw Error('Recovery record changed; refresh the list');
 };
 return {
  async list(){
   if(closed||busy)throw Error('Recovery action unavailable or busy');
   const expected=version,records=await journal.listRecovery();check(expected);
   if(!Array.isArray(records)||records.length>64)throw Error('Recovery inventory exceeds limit');
   const next=new Map(),rows=records.map((value,index)=>{
    try{const record=admit(value);if(records.filter(r=>r?.id===record.id).length!==1)throw Error('Duplicate recovery ID');next.set(record.id,record);return {...record,recoverable:true};}
    catch{return {id:uuid.test(value?.id)?value.id:'unavailable-'+index,name:'Unavailable recovery record',state:'unavailable',recoverable:false};}
   });
   inventory=next;return rows;
  },
  async prepare(id){
   if(closed||busy)throw Error('Recovery action unavailable or busy');
   const record=inventory.get(id);if(!record)throw Error('Refresh and choose an available recovery record');
   prepared=null;const expected=++version;busy=true;
   try{
    await current(record);check(expected);
    const bytes=await journal.readRecovery(id);check(expected);
    await validate(bytes,record);
    check(expected);await current(record);check(expected);
    // The File contains the verified output; no RAW source or old destination authority is restored.
    prepared={record,bytes,document:{path:'browser-recovery:'+id,generation:expected,ready:true,file:new File([bytes],record.name,{type:preset?'application/json':'image/jpeg'})}};
    return {id:record.id,name:record.name,bytes:record.bytes,sha256:record.sha256,canDiscard:(!preset||allowPresetDiscard)&&record.coordination==='web-lock-v1'};
   }finally{busy=false;}
  },
  async savePrepared(){
   if(closed||busy||!prepared)throw Error('Verify a recovery copy before choosing its destination');
   busy=true;const selected=prepared,expected=version;prepared=null;
   const ensure=()=>check(expected);
   try{
    // Invoke the chooser directly from the second user gesture, before any I/O await.
    const token=await destination.choose({defaultPath:selected.record.name.replace(preset?/\.rrpreset$/i:/\.jpe?g$/i,'').slice(0,220)+(preset?'-recovered.rrpreset':'-recovered.jpg')},selected.document);ensure();
    if(!token)return {cancelled:true};
    await current(selected.record);ensure();
    if(preset){const fresh=await journal.readRecovery(selected.record.id);ensure();await validate(fresh,selected.record);ensure();await current(selected.record);ensure();}
    const lease=destination.take(token,selected.document);
    const ack=await destination.write(lease,selected.bytes,ensure);ensure();
    if(ack?.writeAcknowledged!==true||ack.sha256!==selected.record.sha256||ack.bytes!==selected.record.bytes)throw Error('Recovery copy was not acknowledged');
    const result=await destination.complete(ack);ensure();
    return {writeAcknowledged:true,sha256:ack.sha256,bytes:ack.bytes,retention:result.retention,recoveryId:result.recoveryId};
   }finally{busy=false;}
  },
  async discardPrepared(confirmation){
   if(preset&&!allowPresetDiscard)throw Error('Preset recovery removal is unavailable; keep the original entry');
   if(closed||busy||!prepared)throw Error('Verify a recovery copy before confirming discard');
   if(confirmation!==prepared.record.id)throw Error('Explicit recovery confirmation is required');
   busy=true;const selected=prepared,expected=version;prepared=null;
   try{
    await current(selected.record);check(expected);
    const result=await journal.discardRecovery(selected.record,()=>check(expected));check(expected);
    if(result?.discardAcknowledged!==true||result.id!==selected.record.id)throw Error('Recovery removal was not acknowledged');
    inventory.delete(selected.record.id);return result;
   }finally{busy=false;}
  },
  cancelPrepared(){if(busy)throw Error('Wait for the current recovery action');prepared=null;version++;},
  status:()=>({closed,busy,prepared:!!prepared}),
  close(){closed=true;version++;prepared=null;inventory.clear();},
 };
}
