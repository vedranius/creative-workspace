// Experimental AGPL-3.0-only browser implementation of the original settings ABI.
// Preferences only. File handles, opaque output leases and filesystem paths never persist.
export const SETTINGS_LIMIT=64*1024;
export const DEFAULT_BROWSER_SETTINGS=Object.freeze({editorPreviewResolution:512,useWgpuRenderer:false,enableZoomHifi:false,enableLivePreviews:true,livePreviewQuality:'high',baselineExposure:0,compensateHighlightPreservation:true,copyPasteSettings:Object.freeze({autoSync:false}),exportPresets:Object.freeze([])});
const presetFields='id name fileFormat jpegQuality tiffBitDepth dpi enableResize resizeMode resizeValue dontEnlarge enablePad padRatioWidth padRatioHeight padColor enableBorder borderBasis borderHorizontalPercent borderVerticalPercent borderColor keepMetadata preserveTimestamps stripGps exportMasks preserveFolders filenameTemplate enableWatermark watermarkPath watermarkAnchor watermarkScale watermarkSpacing watermarkOpacity lastExportPath destinationType subfolder'.split(' ');
const fail=message=>{throw Error(message);};
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function boundedSettings(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Invalid settings');
 const text=JSON.stringify(input);if(new TextEncoder().encode(text).length>SETTINGS_LIMIT)fail('Settings exceed 64 KiB');
 const value=JSON.parse(text),allowed=[...Object.keys(DEFAULT_BROWSER_SETTINGS),'theme'];
 if(Object.keys(value).some(k=>!allowed.includes(k)))fail('Unsupported browser setting');
 for(const key of ['useWgpuRenderer','enableZoomHifi','enableLivePreviews','compensateHighlightPreservation'])if(value[key]!==undefined&&typeof value[key]!=='boolean')fail('Invalid settings flag');
 if(value.editorPreviewResolution!==undefined&&(!Number.isSafeInteger(value.editorPreviewResolution)||!finite(value.editorPreviewResolution,1,4096)))fail('Invalid preview resolution');
 if(value.baselineExposure!==undefined&&!finite(value.baselineExposure,-5,5))fail('Invalid baseline exposure');
 if(value.livePreviewQuality!==undefined&&!['high','speed','balanced'].includes(value.livePreviewQuality))fail('Invalid preview quality');
 if(value.theme!==undefined&&(typeof value.theme!=='string'||value.theme.length>64||!/^[a-zA-Z0-9_-]+$/.test(value.theme)))fail('Invalid theme');
 if(value.copyPasteSettings!==undefined&&(Object.keys(value.copyPasteSettings||{}).join(',')!=='autoSync'||value.copyPasteSettings.autoSync!==false))fail('Automatic sidecar sync is unavailable');
 const presets=value.exportPresets??[];if(!Array.isArray(presets)||presets.length>32)fail('Choose up to 32 export presets');
 const ids=new Set();
 for(const p of presets){
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!presetFields.includes(k)))fail('Unsupported preset field');
  if(typeof p.id!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(p.id)||ids.has(p.id))fail('Invalid or duplicate preset ID');ids.add(p.id);
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>80||/[\x00-\x1f\x7f]/.test(p.name))fail('Invalid preset name');
  if(p.fileFormat!=='jpeg'||!Number.isSafeInteger(p.jpegQuality)||!finite(p.jpegQuality,1,100))fail('Only bounded JPEG presets are supported');
  for(const [k,min,max]of [['dpi',1,65535],['resizeValue',1,32768],['padRatioWidth',0.01,100],['padRatioHeight',0.01,100],['borderHorizontalPercent',0,100],['borderVerticalPercent',0,100],['watermarkScale',0,100],['watermarkSpacing',0,100],['watermarkOpacity',0,100]])if(p[k]!==undefined&&!finite(p[k],min,max))fail('Invalid preset number');
  for(const k of ['enableResize','dontEnlarge','enablePad','enableBorder','keepMetadata','preserveTimestamps','stripGps','exportMasks','preserveFolders','enableWatermark'])if(p[k]!==undefined&&typeof p[k]!=='boolean')fail('Invalid preset flag');
  if(!['longEdge','shortEdge','width','height','percentage'].includes(p.resizeMode))fail('Invalid resize mode');
  if(p.tiffBitDepth!==undefined&&![8,16].includes(p.tiffBitDepth))fail('Invalid bit depth');
  for(const k of ['padColor','borderColor'])if(p[k]!==undefined&&!/^#[0-9a-fA-F]{6}$/.test(p[k]))fail('Invalid colour');
  if(p.borderBasis!==undefined&&!['longEdge','shortEdge','eachEdge'].includes(p.borderBasis))fail('Invalid border basis');
  if(p.watermarkAnchor!==undefined&&!['topLeft','topCenter','topRight','centerLeft','center','centerRight','bottomLeft','bottomCenter','bottomRight'].includes(p.watermarkAnchor))fail('Invalid watermark anchor');
  if(typeof p.filenameTemplate!=='string'||p.filenameTemplate.length>180||/[\\/\x00-\x1f\x7f]/.test(p.filenameTemplate)||p.filenameTemplate.includes('browser-'))fail('Invalid filename template');
  if(p.enableWatermark)fail('Watermark presets are unavailable');
  // Native presets may remember the last chooser result. That is session authority,
  // never a persistent preference. Do not deserialize or follow any such value.
  delete p.lastExportPath;p.watermarkPath=null;p.destinationType='customFolder';p.subfolder='';
 }
 return {...structuredClone(DEFAULT_BROWSER_SETTINGS),...value,exportPresets:presets};
}
function record(value){
 if(value==null)return {schema:1,revision:0,settings:structuredClone(DEFAULT_BROWSER_SETTINGS)};
 if(value.schema!==1||!Number.isSafeInteger(value.revision)||value.revision<1||Object.keys(value).sort().join(',')!=='revision,schema,settings')fail('Corrupt browser settings; existing data preserved');
 const settings=boundedSettings(value.settings);if(JSON.stringify(settings)!==JSON.stringify(value.settings))fail('Noncanonical browser settings; existing data preserved');
 return {schema:1,revision:value.revision,settings};
}
export function createBrowserSettings({backend=createSettingsDatabase(),timeoutMs=10000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)fail('Invalid settings deadline');
 let current=null,saving=false,closed=false,uncertain=false,pending=null;
 const io=async operation=>{
  if(pending)fail('Previous settings IO is still pending');
  const work=Promise.resolve().then(operation);pending=work;
  work.then(()=>{if(pending===work)pending=null;},()=>{if(pending===work)pending=null;});
  let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Settings storage timed out; reload after pending IO settles')),timeoutMs);})]);}finally{clearTimeout(timer);}
 };
 return {
  async load(){if(closed||saving)fail('Settings are busy or closed');uncertain=true;current=record(await io(()=>backend.read()));if(closed)fail('Settings session closed');uncertain=false;return structuredClone(current.settings);},
  async save(input){
   if(closed||saving||!current||uncertain)fail('Reload settings before saving again');
   const settings=boundedSettings(input),next={schema:1,revision:current.revision+1,settings};if(!Number.isSafeInteger(next.revision))fail('Settings revision limit reached');saving=true;
   try{
    await io(()=>backend.commit(current.revision,next));if(closed)fail('Settings session closed before acknowledgement');
    const readback=record(await io(()=>backend.read()));
    if(JSON.stringify(readback)!==JSON.stringify(next))fail('Settings readback did not acknowledge this write');
    current=next;return null; // Original save_settings resolves only after the write.
   }catch(error){uncertain=true;throw error;}finally{saving=false;}
  },
  status:()=>({revision:current?.revision??null,saving,uncertain,closed,pendingIO:!!pending}),
  async close(){closed=true;await backend.close?.();},
 };
}
export function createSettingsDatabase({indexedDB=globalThis.indexedDB}={}){
 let opened,connection,closed=false;
 const db=()=>closed?Promise.reject(Error('Settings database closed')):opened??=new Promise((resolve,reject)=>{
  if(!indexedDB){reject(Error('Browser settings storage unavailable'));return;}
  const request=indexedDB.open('cw-rapidraw-browser-settings-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('preferences');
  request.onsuccess=()=>{connection=request.result;connection.onversionchange=()=>connection.close();if(closed){connection.close();reject(Error('Settings database closed'));}else resolve(connection);};request.onerror=()=>reject(Error('Browser settings storage unavailable'));request.onblocked=()=>{closed=true;reject(Error('Close other settings sessions before upgrading'));};
 });
 return {
  async read(){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('preferences','readonly'),request=tx.objectStore('preferences').get('settings');let value;request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>resolve(value??null);tx.onerror=tx.onabort=()=>reject(Error('Cannot read browser settings'));});},
  async commit(expected,next){const checked=record(next);if(checked.revision!==expected+1)fail('Invalid settings revision');const database=await db();return new Promise((resolve,reject)=>{
   const tx=database.transaction('preferences','readwrite'),store=tx.objectStore('preferences'),request=store.get('settings');let conflict=false,corrupt=false;
   request.onsuccess=()=>{let existing;try{existing=record(request.result??null);}catch{corrupt=true;tx.abort();return;}if(existing.revision!==expected){conflict=true;tx.abort();return;}store.put(checked,'settings');};
   tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(Error(corrupt?'Corrupt browser settings preserved':conflict?'Settings changed in another tab; reload before saving':'Browser settings write was not acknowledged'));
  });},
  async close(){closed=true;connection?.close();},
 };
}
