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
 const ready=()=>{if(closed||busy||!current||uncertain)fail('Reload preset library before writing');};
 const check=()=>{if(closed)fail('Preset library session closed');};
 const persist=async presets=>{
   const next={schema:1,revision:current.revision+1,presets};if(!Number.isSafeInteger(next.revision))fail('Preset revision limit reached');
   busy=true;let committing=false;
   try{
    committing=true;await io(()=>backend.commit(current.revision,next));check();const actual=record(await io(()=>backend.read()));check();
    if(JSON.stringify(actual)!==JSON.stringify(next))fail('Preset library readback did not acknowledge this write');current=next;return null;
   }catch(error){if(committing||pending)uncertain=true;throw error;}finally{busy=false;}
 };
 const saveCreated=async items=>{
   ready();const presets=boundedLibrary(items),prior=current.presets,created=presets.at(-1)?.preset;
   if(presets.length!==prior.length+1||JSON.stringify(presets.slice(0,-1))!==JSON.stringify(prior)||!created||created.presetType!=='tool'||!(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/).test(created.id))fail('Only one new Exposure tool preset can be saved; existing presets must be unchanged');
   return persist(presets);
 };
 const saveRenamed=async items=>{
  ready();const presets=boundedLibrary(items),prior=current.presets;
  if(presets.length!==prior.length)fail('Only an existing Exposure tool preset name can change');
  const changed=presets.flatMap((item,i)=>JSON.stringify(item)!==JSON.stringify(prior[i])?[i]:[]);
  if(changed.length!==1)fail('Change one existing Exposure tool preset name');
  const index=changed[0],before=prior[index]?.preset,after=presets[index]?.preset;
  if(!before||!after||before.presetType!=='tool'||after.presetType!=='tool'||JSON.stringify({...after,name:before.name})!==JSON.stringify(before))fail('Only the name may change; preset IDs, values and other fields must be preserved');
  return persist(presets);
 };
 const childRenameCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length)return false;
  const changed=presets.flatMap((item,i)=>JSON.stringify(item)!==JSON.stringify(prior[i])?[i]:[]);
  if(changed.length!==1)return false;
  const i=changed[0],before=prior[i]?.folder,after=presets[i]?.folder;
  if(!before||!after||before.children.length!==after.children.length||JSON.stringify({...after,children:before.children})!==JSON.stringify(before))return false;
  const children=after.children.flatMap((p,j)=>JSON.stringify(p)!==JSON.stringify(before.children[j])?[j]:[]);
  if(children.length!==1)return false;
  const j=children[0],old=before.children[j],next=after.children[j];
  return old.presetType==='tool'&&next.presetType==='tool'&&old.name!==next.name&&JSON.stringify({...next,name:old.name})===JSON.stringify(old);
 };
 const saveChildRenamed=async items=>{ready();const presets=boundedLibrary(items);if(!childRenameCandidate(presets))fail('Rename only one existing Exposure Tool child; preserve parent, IDs, values, flags, order and siblings');return persist(presets);};
 const childDeleteCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length)return false;
  const changed=presets.flatMap((item,i)=>JSON.stringify(item)!==JSON.stringify(prior[i])?[i]:[]);
  if(changed.length!==1)return false;
  const i=changed[0],before=prior[i]?.folder,after=presets[i]?.folder;
  if(!before||!after||after.children.length!==before.children.length-1||JSON.stringify({...after,children:before.children})!==JSON.stringify(before))return false;
  const removed=before.children.filter(p=>!after.children.some(n=>n.id===p.id));
  return removed.length===1&&removed[0].presetType==='tool'&&JSON.stringify(before.children.filter(p=>p!==removed[0]))===JSON.stringify(after.children);
 };
 const saveChildDeleted=async items=>{ready();const presets=boundedLibrary(items);if(!childDeleteCandidate(presets))fail('Delete exactly one existing Exposure Tool child; preserve parent, IDs, values, flags, order and every sibling');return persist(presets);};
 const moveToolIntoFolderCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length-1)return false;
  const removed=prior.filter(item=>!presets.some(next=>(next.preset??next.folder).id===(item.preset??item.folder).id));
  if(removed.length!==1||removed[0].preset?.presetType!=='tool')return false;
  const remaining=prior.filter(item=>item!==removed[0]);
  return remaining.some((item,i)=>{if(!item.folder||item.folder.children.length!==0)return false;const expected=structuredClone(remaining);expected[i].folder.children=[removed[0].preset];return JSON.stringify(expected)===JSON.stringify(presets);});
 };
 const saveMovedIntoFolder=async items=>{ready();const presets=boundedLibrary(items);if(!moveToolIntoFolderCandidate(presets))fail('Move exactly one existing top-level Exposure Tool into an existing empty folder; preserve IDs, values, flags, siblings and order');return persist(presets);};
 const moveChildToRootCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length+1)return false;
  const topIds=new Set(prior.map(item=>(item.preset??item.folder).id));
  const added=presets.flatMap((item,i)=>!topIds.has((item.preset??item.folder).id)?[i]:[]);
  if(added.length!==1)return false;
  const index=added[0],moved=presets[index]?.preset,target=presets[index+1]?.preset;
  if(!moved||moved.presetType!=='tool'||!target||!prior.some(item=>item.preset?.id===target.id&&item.preset.presetType==='tool'))return false;
  const parent=prior.find(item=>item.folder?.children.some(p=>p.id===moved.id&&p.presetType==='tool'));
  if(!parent)return false;
  const child=parent.folder.children.find(p=>p.id===moved.id),expected=structuredClone(prior);
  expected.find(item=>item.folder?.id===parent.folder.id).folder.children=parent.folder.children.filter(p=>p.id!==moved.id);
  expected.splice(prior.findIndex(item=>item.preset?.id===target.id),0,{preset:child});
  return JSON.stringify(expected)===JSON.stringify(presets);
 };
 const saveChildMovedToRoot=async items=>{ready();const presets=boundedLibrary(items);if(!moveChildToRootCandidate(presets))fail('Move one existing Exposure Tool child before an existing top-level Tool; preserve parent, IDs, values, flags, siblings and order');return persist(presets);};
 const rootToolReorderCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length||JSON.stringify(presets)===JSON.stringify(prior))return false;
  return prior.some((item,from)=>{
   if(item.preset?.presetType!=='tool')return false;
   const to=presets.findIndex(next=>next.preset?.id===item.preset.id);
   if(to<0||to===from||!prior.slice(Math.min(from,to),Math.max(from,to)+1).every(next=>next.preset?.presetType==='tool'))return false;
   const expected=structuredClone(prior);expected.splice(to,0,expected.splice(from,1)[0]);return JSON.stringify(expected)===JSON.stringify(presets);
  });
 };
 const saveRootReordered=async items=>{ready();const presets=boundedLibrary(items);if(!rootToolReorderCandidate(presets))fail('Reorder one existing top-level Exposure Tool within a contiguous Tool block; preserve folders, IDs, values, flags and every other record');return persist(presets);};
 const childToolReorderCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length)return false;
  const changed=presets.flatMap((item,i)=>JSON.stringify(item)!==JSON.stringify(prior[i])?[i]:[]);
  if(changed.length!==1)return false;
  const index=changed[0],before=prior[index]?.folder,after=presets[index]?.folder;
  if(!before||!after||before.children.length!==after.children.length||JSON.stringify({...after,children:before.children})!==JSON.stringify(before))return false;
  return before.children.some((item,from)=>{
   const to=after.children.findIndex(next=>next.id===item.id);
   if(to<0||to===from||!before.children.slice(Math.min(from,to),Math.max(from,to)+1).every(next=>next.presetType==='tool'))return false;
   const expected=structuredClone(before.children);expected.splice(to,0,expected.splice(from,1)[0]);return JSON.stringify(expected)===JSON.stringify(after.children);
  });
 };
 const saveChildReordered=async items=>{ready();const presets=boundedLibrary(items);if(!childToolReorderCandidate(presets))fail('Reorder one existing Exposure Tool child within the same folder; preserve parent, IDs, names, values, flags and every other record');return persist(presets);};
 const saveDeleted=async items=>{
  ready();const presets=boundedLibrary(items),prior=current.presets;
  if(presets.length!==prior.length-1)fail('Remove exactly one existing Exposure Tool preset');
  const removed=prior.filter(item=>!presets.some(next=>(next.preset??next.folder).id===(item.preset??item.folder).id));
  if(removed.length!==1||removed[0].preset?.presetType!=='tool'||JSON.stringify(prior.filter(item=>item!==removed[0]))!==JSON.stringify(presets))fail('Only one existing Exposure Tool preset can be deleted; preserve every other item');
  return persist(presets);
 };
 const duplicateCandidate=presets=>{
  const prior=current.presets,ids=new Set(prior.map(item=>(item.preset??item.folder).id));
  if(presets.length!==prior.length+1)return false;
  const added=presets.flatMap((item,i)=>!ids.has((item.preset??item.folder).id)?[i]:[]);
  if(added.length!==1||added[0]===0)return false;
  const index=added[0],clone=presets[index]?.preset,source=prior[index-1]?.preset;
  return !!source&&source.presetType==='tool'&&!!clone&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(clone.id)&&clone.name===source.name+' Copy'&&JSON.stringify({...clone,id:source.id,name:source.name})===JSON.stringify(source)&&JSON.stringify(presets.filter((_,i)=>i!==index))===JSON.stringify(prior);
 };
 const childDuplicateCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length)return false;
  const changed=presets.flatMap((item,i)=>JSON.stringify(item)!==JSON.stringify(prior[i])?[i]:[]);
  if(changed.length!==1)return false;
  const i=changed[0],before=prior[i]?.folder,after=presets[i]?.folder;
  if(!before||!after||after.children.length!==before.children.length+1||JSON.stringify({...after,children:before.children})!==JSON.stringify(before))return false;
  const ids=new Set(before.children.map(p=>p.id)),added=after.children.flatMap((p,j)=>!ids.has(p.id)?[j]:[]);
  if(added.length!==1||added[0]===0)return false;
  const j=added[0],source=before.children[j-1],clone=after.children[j];
  return !!source&&source.presetType==='tool'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(clone.id)&&clone.name===source.name+' Copy'&&JSON.stringify({...clone,id:source.id,name:source.name})===JSON.stringify(source)&&JSON.stringify(after.children.filter((_,k)=>k!==j))===JSON.stringify(before.children);
 };
 const saveChildDuplicated=async items=>{ready();const presets=boundedLibrary(items);if(!childDuplicateCandidate(presets))fail('Duplicate one existing Exposure Tool child with fresh UUID and original Copy name immediately after it; preserve parent, values, flags, order and siblings');return persist(presets);};
 const saveDuplicated=async items=>{ready();const presets=boundedLibrary(items);if(!duplicateCandidate(presets))fail('Duplicate one existing top-level Exposure Tool with a fresh ID, original Copy name and unchanged siblings');return persist(presets);};
 const childOverwriteCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length)return false;
  const changed=presets.flatMap((item,i)=>JSON.stringify(item)!==JSON.stringify(prior[i])?[i]:[]);
  if(changed.length!==1)return false;
  const i=changed[0],before=prior[i]?.folder,after=presets[i]?.folder;
  if(!before||!after||after.children.length!==before.children.length||JSON.stringify({...after,children:before.children})!==JSON.stringify(before))return false;
  const children=after.children.flatMap((p,j)=>JSON.stringify(p)!==JSON.stringify(before.children[j])?[j]:[]);
  if(children.length!==1)return false;
  const j=children[0],old=before.children[j],next=after.children[j];
  return old.presetType==='tool'&&JSON.stringify({...next,adjustments:old.adjustments})===JSON.stringify(old)&&next.adjustments.exposure!==old.adjustments.exposure;
 };
 const saveChildOverwritten=async items=>{ready();const presets=boundedLibrary(items);if(!childOverwriteCandidate(presets))fail('Overwrite only one existing Exposure Tool child value; preserve parent, IDs, names, flags, order and siblings');return persist(presets);};
 const overwriteCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length)return false;
  const changed=presets.flatMap((item,i)=>JSON.stringify(item)!==JSON.stringify(prior[i])?[i]:[]);
  if(changed.length!==1)return false;
  const i=changed[0],before=prior[i]?.preset,after=presets[i]?.preset;
  return !!before&&before.presetType==='tool'&&!!after&&JSON.stringify({...after,adjustments:before.adjustments})===JSON.stringify(before)&&after.adjustments.exposure!==before.adjustments.exposure;
 };
 const saveOverwritten=async items=>{ready();const presets=boundedLibrary(items);if(!overwriteCandidate(presets))fail('Overwrite only one existing top-level Exposure Tool value; preserve ID, name, flags, order and siblings');return persist(presets);};
 const folderCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length+1)return false;
  const first=prior.findIndex(item=>item.preset),index=first===-1?prior.length:first,folder=presets[index]?.folder;
  return !!folder&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(folder.id)&&folder.children.length===0&&JSON.stringify(presets.filter((_,i)=>i!==index))===JSON.stringify(prior);
 };
 const saveFolderCreated=async items=>{ready();const presets=boundedLibrary(items);if(!folderCandidate(presets))fail('Create one empty folder with fresh UUID at the original position; preserve every existing item');return persist(presets);};
 const folderRenameCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length)return false;
  const changed=presets.flatMap((item,i)=>JSON.stringify(item)!==JSON.stringify(prior[i])?[i]:[]);
  if(changed.length!==1)return false;
  const index=changed[0],before=prior[index]?.folder,after=presets[index]?.folder;
  return !!before&&!!after&&after.name!==before.name&&JSON.stringify({...after,name:before.name})===JSON.stringify(before);
 };
 const saveFolderRenamed=async items=>{ready();const presets=boundedLibrary(items);if(!folderRenameCandidate(presets))fail('Rename only one existing top-level folder; preserve ID, all children, order and siblings');return persist(presets);};
 const folderDeleteCandidate=presets=>{
  const prior=current.presets;if(presets.length!==prior.length-1)return false;
  const removed=prior.filter(item=>!presets.some(next=>(next.preset??next.folder).id===(item.preset??item.folder).id));
  return removed.length===1&&!!removed[0].folder&&removed[0].folder.children.length===0&&JSON.stringify(prior.filter(item=>item!==removed[0]))===JSON.stringify(presets);
 };
 const saveFolderDeleted=async items=>{ready();const presets=boundedLibrary(items);if(!folderDeleteCandidate(presets))fail('Delete only one existing empty top-level folder; preserve every other item');return persist(presets);};
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
  saveCreated,
  saveDuplicated,
  saveOverwritten,
  saveFolderCreated,
  saveFolderRenamed,
  saveFolderDeleted,
  saveChildRenamed,
  saveChildDuplicated,
  saveChildOverwritten,
  saveChildDeleted,
  saveMovedIntoFolder,
  saveChildMovedToRoot,
  saveRootReordered,
  saveChildReordered,
  async savePresets(items,{allowRename=false,allowDelete=false,allowDuplicate=false,allowOverwrite=false,allowCreateFolder=false,allowRenameFolder=false,allowDeleteFolder=false,allowRenameChild=false,allowDuplicateChild=false,allowOverwriteChild=false,allowDeleteChild=false,allowMoveToolIntoFolder=false,allowMoveChildToRoot=false,allowReorderRootTools=false,allowReorderChildTools=false}={}){
   ready();const presets=boundedLibrary(items);
   if(allowReorderChildTools&&childToolReorderCandidate(presets))return saveChildReordered(presets);
   if(allowReorderRootTools&&rootToolReorderCandidate(presets))return saveRootReordered(presets);
   if(allowMoveChildToRoot&&moveChildToRootCandidate(presets))return saveChildMovedToRoot(presets);
   if(allowMoveToolIntoFolder&&moveToolIntoFolderCandidate(presets))return saveMovedIntoFolder(presets);
   if(allowDeleteChild&&childDeleteCandidate(presets))return saveChildDeleted(presets);
   if(allowOverwriteChild&&childOverwriteCandidate(presets))return saveChildOverwritten(presets);
   if(allowDuplicateChild&&childDuplicateCandidate(presets))return saveChildDuplicated(presets);
   if(allowRenameChild&&childRenameCandidate(presets))return saveChildRenamed(presets);
   if(allowDeleteFolder&&folderDeleteCandidate(presets))return saveFolderDeleted(presets);
   if(allowRenameFolder&&folderRenameCandidate(presets))return saveFolderRenamed(presets);
   if(allowCreateFolder&&folderCandidate(presets))return saveFolderCreated(presets);
   if(allowOverwrite&&overwriteCandidate(presets))return saveOverwritten(presets);
   if(allowDuplicate&&duplicateCandidate(presets))return saveDuplicated(presets);
   if(allowDelete&&presets.length===current.presets.length-1)return saveDeleted(presets);
   return allowRename&&presets.length===current.presets.length?saveRenamed(presets):saveCreated(presets);
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
