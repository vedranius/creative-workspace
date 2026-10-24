// Experimental native-shaped development library. No JPEG settings or file authority persists.
import {serializePresetFile,PRESET_FILE_LIMIT} from './preset-file.js';
const fail=m=>{throw Error(m);};
export const boundedLibrary=value=>Array.isArray(value)&&value.length===0?[]:JSON.parse(new TextDecoder().decode(serializePresetFile(value))).presets;
export function mergePresetItems(current,imported,newId=()=>crypto.randomUUID()){
 const result=boundedLibrary(current),names=new Set(result.map(i=>(i.preset??i.folder).name));
 const ids=new Set(result.flatMap(i=>i.preset?[i.preset.id]:[i.folder.id,...i.folder.children.map(p=>p.id)]));
 const fresh=()=>{for(let n=0;n<16;n++){const id=newId();if(typeof id==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id)&&!ids.has(id)){ids.add(id);return id;}}fail('Cannot allocate a fresh preset ID');};
 for(const item of boundedLibrary(imported)){
  const value=item.preset??item.folder;value.id=fresh();if(item.folder)for(const child of value.children)child.id=fresh();
  const original=value.name;let name=original,n=1;while(names.has(name))name=original+' ('+(n++)+')';value.name=name;names.add(name);result.push(item);
 }
 return boundedLibrary(result);
}
function record(value){
 if(value==null)return {schema:1,revision:0,presets:[]};
 if(!value||Object.keys(value).sort().join(',')!=='presets,revision,schema'||value.schema!==1||!Number.isSafeInteger(value.revision)||value.revision<1)fail('Corrupt preset library preserved');
 const presets=boundedLibrary(value.presets);if(JSON.stringify(presets)!==JSON.stringify(value.presets))fail('Noncanonical preset library preserved');return {...value,presets};
}
export function createPresetLibrary({backend=createPresetLibraryDatabase(),pickFiles=o=>globalThis.showOpenFilePicker(o),timeoutMs=10000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)fail('Invalid library deadline');
 let current=null,busy=false,uncertain=false,closed=false,pending=null;const leases=new Map();
 const io=async fn=>{if(pending)fail('Previous library IO still pending');const p=Promise.resolve().then(fn);pending=p;p.then(()=>{if(pending===p)pending=null;},()=>{if(pending===p)pending=null;});let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Preset library IO timed out; reload after IO settles')),timeoutMs);})]);}finally{clearTimeout(timer);}};
 const ready=()=>{if(closed||busy||!current||uncertain)fail('Reload preset library before importing');};
 const check=()=>{if(closed)fail('Preset library session closed');};
 return {
  async load(){if(closed||busy)fail('Preset library busy or closed');uncertain=true;current=record(await io(()=>backend.read()));check();uncertain=false;return structuredClone(current.presets);},
  async choose(){
   ready();for(const [key,l]of leases)if(l.expires<Date.now())leases.delete(key);if(leases.size>=16)fail('Too many preset input choices');
   let handles;try{handles=await pickFiles({multiple:true,types:[{description:'RapidRAW presets',accept:{'application/json':['.rrpreset']}}]});}catch(e){if(e.name==='AbortError')return null;throw e;}
   check();if(!Array.isArray(handles)||handles.length<1||handles.length>8||leases.size+handles.length>16)fail('Choose 1..8 preset files');
   const selected=[];for(const h of handles){
    if(h?.kind!=='file'||typeof h.name!=='string'||h.name.length>180||!(/\.rrpreset$/i).test(h.name)||/[\\/\x00-\x1f\x7f]/.test(h.name))fail('Choose a .rrpreset file');
    if(await io(()=>h.queryPermission({mode:'read'}))!=='granted')fail('Preset read permission not granted');const file=await io(()=>h.getFile());check();if(file.size<1||file.size>PRESET_FILE_LIMIT)fail('Preset file exceeds 64 KiB');selected.push({handle:h,file,revision:current.revision,expires:Date.now()+300000});
   }
   return selected.map(l=>{const token='browser-preset-input:'+crypto.randomUUID();leases.set(token,l);return token;});
  },
  async importFiles(tokens){
   ready();if(!Array.isArray(tokens)||tokens.length<1||tokens.length>8||new Set(tokens).size!==tokens.length)fail('Invalid preset input choices');
   const selected=tokens.map(t=>{const l=leases.get(t);leases.delete(t);return l;});if(selected.some(l=>!l||l.revision!==current.revision||l.expires<Date.now()))fail('Preset input expired or library changed');
   busy=true;let committing=false,total=0,presets=structuredClone(current.presets);const failures=[];
   try{
    for(const l of selected){try{
     check();if(await io(()=>l.handle.queryPermission({mode:'read'}))!=='granted')fail('Preset read permission revoked');const file=await io(()=>l.handle.getFile());check();
     if(file.size!==l.file.size||file.lastModified!==l.file.lastModified)fail('Preset changed after selection');total+=file.size;if(total>PRESET_FILE_LIMIT)fail('Selected preset bytes exceed 64 KiB');
     const bytes=await io(()=>file.arrayBuffer());check();if(bytes.byteLength!==file.size)fail('Preset read length mismatch');const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
     if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['creator','presets'].includes(k)))fail('Unsupported preset file');
     presets=mergePresetItems(presets,value.presets);
    }catch(error){if(closed||pending)throw error;failures.push({fileName:l.handle.name,error:String(error.message??error)});}}
    if(JSON.stringify(presets)!==JSON.stringify(current.presets)){
     const next={schema:1,revision:current.revision+1,presets};if(!Number.isSafeInteger(next.revision))fail('Preset revision limit reached');committing=true;
     await io(()=>backend.commit(current.revision,next));check();const actual=record(await io(()=>backend.read()));check();if(JSON.stringify(actual)!==JSON.stringify(next))fail('Preset library readback did not acknowledge this write');current=next;
    }
    return {presets:structuredClone(current.presets),failures};
   }catch(error){if(committing||pending)uncertain=true;throw error;}finally{busy=false;}
  },
  status:()=>({revision:current?.revision??null,busy,uncertain,closed,pendingIO:!!pending}),
  async close(){closed=true;leases.clear();await backend.close?.();},
 };
}
export function createPresetLibraryDatabase({indexedDB=globalThis.indexedDB}={}){
 let opened,connection,closed=false;
 const db=()=>closed?Promise.reject(Error('Preset database closed')):opened??=new Promise((resolve,reject)=>{
  if(!indexedDB){reject(Error('Preset storage unavailable'));return;}const request=indexedDB.open('cw-rapidraw-preset-library-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('library');request.onerror=()=>reject(Error('Preset storage unavailable'));request.onblocked=()=>reject(Error('Close other preset sessions before upgrading'));
  request.onsuccess=()=>{connection=request.result;connection.onversionchange=()=>connection.close();if(closed){connection.close();reject(Error('Preset database closed'));}else resolve(connection);};
 });
 return {
  async read(){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('library','readonly'),r=tx.objectStore('library').get('presets');let value;r.onsuccess=()=>value=r.result;tx.oncomplete=()=>resolve(value??null);tx.onabort=tx.onerror=()=>reject(Error('Cannot read preset library'));});},
  async commit(expected,next){record(next);if(next.revision!==expected+1)fail('Invalid preset revision');const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('library','readwrite'),store=tx.objectStore('library'),r=store.get('presets');let conflict=false;r.onsuccess=()=>{try{if(record(r.result??null).revision!==expected){conflict=true;tx.abort();return;}store.put(next,'presets');}catch{tx.abort();}};tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(Error(conflict?'Preset library changed in another tab; reload':'Preset library write was not acknowledged'));});},
  async close(){closed=true;connection?.close();},
 };
}
