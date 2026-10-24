// Experimental AGPL-3.0-only Exposure metadata. Private, browser-local, no file authority.
import {isRawInputSizeAllowed} from './decoder-client.js';
export const METADATA_LIMIT=4*1024*1024,THUMBNAIL_LIMIT=128*1024;
const fail=m=>{throw Error(m);},equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const validId=id=>typeof id==='string'&&/^[a-f0-9]{64}:[1-9][0-9]{0,9}$/.test(id)&&isRawInputSizeAllowed(Number(id.split(':')[1]));
const exposure=v=>typeof v==='number'&&Number.isFinite(v)&&v>=-5&&v<=5;
function record(value){
 if(value==null)return {schema:1,revision:0,documents:[]};
 if(!value||Object.keys(value).sort().join(',')!=='documents,revision,schema'||value.schema!==1||!Number.isSafeInteger(value.revision)||value.revision<1||!Array.isArray(value.documents)||value.documents.length>32)fail('Corrupt metadata preserved');
 if(new TextEncoder().encode(JSON.stringify(value)).length>METADATA_LIMIT)fail('Metadata exceeds 4 MiB');
 const ids=new Set();for(const d of value.documents){
  if(!d||Object.keys(d).sort().join(',')!=='exposure,id,thumbnail'||!validId(d.id)||ids.has(d.id)||!exposure(d.exposure)||typeof d.thumbnail!=='string'||d.thumbnail.length>THUMBNAIL_LIMIT||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(d.thumbnail))fail('Corrupt metadata preserved');ids.add(d.id);
 }
 return structuredClone(value);
}
export function createMetadataStorage({defaults,backend=createMetadataDatabase(),timeoutMs=10000}={}){
 if(!defaults||!Number.isSafeInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)fail('Invalid metadata configuration');
 const neutral=structuredClone(defaults),identities=new WeakMap();let current=null,id=null,selected=null,draft=null,invalid=false,busy=false,uncertain=false,closed=false,pending=null;
 function validate(adjustments){
  if(!adjustments||typeof adjustments!=='object'||Array.isArray(adjustments)||new TextEncoder().encode(JSON.stringify(adjustments)).length>65536||!exposure(adjustments.exposure))fail('Only bounded Exposure -5..5 metadata is supported');
  for(const key of new Set([...Object.keys(neutral),...Object.keys(adjustments)]))if(key!=='exposure'&&!equal(neutral[key],adjustments[key]))fail('Unsupported metadata adjustment '+key);
  return adjustments.exposure;
 }
 const io=async fn=>{if(pending)fail('Previous metadata IO still pending');const p=Promise.resolve().then(fn);pending=p;p.then(()=>{if(pending===p)pending=null;},()=>{if(pending===p)pending=null;});let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Metadata IO timed out; reload after IO settles')),timeoutMs);})]);}finally{clearTimeout(timer);}};
 const check=()=>{if(closed)fail('Metadata session closed');};
 const identity=async file=>{
  if(!(file instanceof File)||!isRawInputSizeAllowed(file.size))fail('Select a bounded RAW File');
  let p=identities.get(file);if(!p){p=(async()=>{const bytes=await file.arrayBuffer();if(bytes.byteLength!==file.size)fail('Selected file read mismatch');const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');return hash+':'+file.size;})();identities.set(file,p);}return io(()=>p);
 };
 const entry=()=>current?.documents.find(d=>d.id===id);
 return {
  validate,
  snapshot(file){check();if(!current||selected!==file||uncertain||busy)fail('Load metadata before image');return {adjustments:entry()?{...structuredClone(neutral),exposure:entry().exposure}:null};},
  observe(file,adjustments){if(file!==selected||!current||closed)return;try{draft=validate(adjustments);invalid=false;}catch{invalid=true;}},
  async load(file){check();if(busy)fail('Metadata busy');busy=true;uncertain=true;try{const nextId=await identity(file);check();const next=record(await io(()=>backend.read()));check();current=next;id=nextId;selected=file;draft=entry()?.exposure??0;invalid=false;uncertain=false;return {adjustments:entry()?{...structuredClone(neutral),exposure:entry().exposure}:null};}finally{busy=false;}},
  async save(file,adjustments,thumbnail){
   check();const value=validate(adjustments);
   if(busy||uncertain||!current||selected!==file||pending)fail('Reload metadata before saving');
   if(typeof thumbnail!=='string'||thumbnail.length>THUMBNAIL_LIMIT||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(thumbnail))fail('Thumbnail exceeds bounded JPEG metadata');
   const documents=structuredClone(current.documents),index=documents.findIndex(d=>d.id===id),item={id,exposure:value,thumbnail};
   if(index<0)documents.push(item);else documents[index]=item;
   const next=record({schema:1,revision:current.revision+1,documents});busy=true;
   try{await io(()=>backend.commit(current.revision,next));check();const actual=record(await io(()=>backend.read()));check();if(!equal(actual,next))fail('Metadata readback did not acknowledge this write');current=next;return null;}catch(error){uncertain=true;throw error;}finally{busy=false;}
  },
  status:()=>({revision:current?.revision??null,dirty:invalid||draft!==(entry()?.exposure??0),busy,uncertain,closed,pendingIO:!!pending,exposure:entry()?.exposure??0}),
  thumbnail:()=>entry()?.thumbnail??null,
  async close(){closed=true;selected=null;await backend.close?.();},
 };
}
export function createMetadataDatabase({indexedDB=globalThis.indexedDB}={}){
 let opened,connection,closed=false;
 const db=()=>closed?Promise.reject(Error('Metadata database closed')):opened??=new Promise((resolve,reject)=>{
  if(!indexedDB){reject(Error('Metadata storage unavailable'));return;}const r=indexedDB.open('cw-rapidraw-metadata-v1',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('metadata');r.onerror=()=>reject(Error('Metadata storage unavailable'));r.onblocked=()=>{closed=true;reject(Error('Close other metadata sessions before upgrading'));};
  r.onsuccess=()=>{connection=r.result;connection.onversionchange=()=>connection.close();if(closed){connection.close();reject(Error('Metadata database closed'));}else resolve(connection);};
 });
 return {
  async read(){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('metadata','readonly'),r=tx.objectStore('metadata').get('documents');let v;r.onsuccess=()=>v=r.result;tx.oncomplete=()=>resolve(v??null);tx.onabort=tx.onerror=()=>reject(Error('Cannot read metadata'));});},
  async commit(expected,next){const checked=record(next);if(checked.revision!==expected+1)fail('Invalid metadata revision');const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('metadata','readwrite'),s=tx.objectStore('metadata'),r=s.get('documents');let conflict=false;r.onsuccess=()=>{try{if(record(r.result??null).revision!==expected){conflict=true;tx.abort();return;}s.put(checked,'documents');}catch{tx.abort();}};tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(Error(conflict?'Metadata changed in another tab; reload':'Metadata write was not acknowledged'));});},
  async close(){closed=true;connection?.close();},
 };
}
