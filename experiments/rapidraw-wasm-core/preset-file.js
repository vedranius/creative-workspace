// Experimental original development-preset ABI. JPEG export preferences are separate.
import {createExportDestination} from './export-destination.js';
export const PRESET_FILE_LIMIT=64*1024;
const fail=message=>{throw Error(message);};
export function serializePresetFile(items){
 // Limit encoded size before cloning; the accepted shape below is deliberately narrow.
 const text=JSON.stringify(items);
 if(!text||new TextEncoder().encode(text).length>PRESET_FILE_LIMIT)fail('Preset input exceeds 64 KiB');
 const list=JSON.parse(text),ids=new Set();let count=0;
 const identity=p=>{
  if(typeof p.id!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(p.id)||ids.has(p.id))fail('Invalid or duplicate preset ID');ids.add(p.id);
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>80||/[\\/\x00-\x1f\x7f]/.test(p.name))fail('Invalid preset name');
 };
 const preset=p=>{
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['id','name','adjustments','includeMasks','includeCropTransform','presetType'].includes(k)))fail('Unsupported preset field');
  identity(p);if(++count>32)fail('Choose up to 32 presets');
  if(p.includeMasks!==undefined&&p.includeMasks!==false||p.includeCropTransform!==undefined&&p.includeCropTransform!==false)fail('Masks and crop presets unavailable');
  if(p.presetType!==undefined&&!['tool','style','user','global'].includes(p.presetType))fail('Unsupported preset type');
  // First file slice accepts the already-proven original Exposure scalar only.
  const a=p.adjustments;if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).join(',')!=='exposure'||typeof a.exposure!=='number'||!Number.isFinite(a.exposure)||Math.abs(a.exposure)>5)fail('Only bounded Exposure presets are available');
  return {id:p.id,name:p.name,adjustments:p.adjustments,...(p.includeMasks===undefined?{}:{includeMasks:p.includeMasks}),...(p.includeCropTransform===undefined?{}:{includeCropTransform:p.includeCropTransform}),...(p.presetType===undefined?{}:{presetType:p.presetType})};
 };
 if(!Array.isArray(list)||list.length<1||list.length>32)fail('Choose 1..32 preset items');
 for(const item of list){
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).length!==1)fail('Invalid preset item');
  if(item.preset)item.preset=preset(item.preset);
  else if(item.folder){const f=item.folder;if(Object.keys(f).sort().join(',')!=='children,id,name'||!Array.isArray(f.children)||f.children.length>32)fail('Invalid preset folder');identity(f);item.folder={id:f.id,name:f.name,children:f.children.map(preset)};}
  else fail('Invalid preset variant');
 }
 // Original ExportPresetFile has creator then presets; JS retains its source field order.
 const bytes=new TextEncoder().encode(JSON.stringify({creator:'Anonymous',presets:list},null,2));
 if(bytes.length>PRESET_FILE_LIMIT)fail('Preset output exceeds 64 KiB');
 return bytes;
}
export function createPresetFileHost({items=[],destination=createExportDestination({format:'rrpreset'}),onTrace=()=>{},libraryHost,allowRename=false,allowDelete=false,allowDuplicate=false,allowOverwrite=false,allowCreateFolder=false,allowRenameFolder=false,allowDeleteFolder=false,allowRenameChild=false,allowDuplicateChild=false,allowOverwriteChild=false,allowDeleteChild=false,allowMoveToolIntoFolder=false,allowMoveChildToRoot=false,allowReorderRootTools=false,allowReorderChildTools=false}={}){
 let closed=false,busy=false;
 const library=items.length?JSON.parse(new TextDecoder().decode(serializePresetFile(items))).presets:[];
 const document={ready:true,file:{name:'preset-library'},path:'browser-preset-library:'+crypto.randomUUID(),generation:1};
 const check=()=>{if(closed)fail('Preset session closed');};
 const sync=()=>{if(libraryHost){const s=libraryHost.status();if(s.revision===null||s.uncertain||s.busy)fail('Reload preset library before exporting');document.generation=s.revision+1;}};
 return {
  async chooseImport(){check();if(!libraryHost)fail('Preset import unavailable');return libraryHost.choose();},
  async choose(options){check();sync();if(busy)fail('Preset export already active');return destination.choose(options,document);},
  async invoke(command,args={}){
   check();onTrace({command,phase:'start'});
   if(command==='load_presets')return libraryHost?libraryHost.load():structuredClone(library);
   if(command==='save_presets'&&libraryHost){if(Object.keys(args).join(',')!=='presets')fail('Invalid preset save arguments');return libraryHost.savePresets(args.presets,{allowRename,allowDelete,allowDuplicate,allowOverwrite,allowCreateFolder,allowRenameFolder,allowDeleteFolder,allowRenameChild,allowDuplicateChild,allowOverwriteChild,allowDeleteChild,allowMoveToolIntoFolder,allowMoveChildToRoot,allowReorderRootTools,allowReorderChildTools});}
   if(command==='handle_import_presets_from_files'&&libraryHost){if(Object.keys(args).join(',')!=='filePaths')fail('Invalid import arguments');return libraryHost.importFiles(args.filePaths);}
   if(command!=='handle_export_presets_to_file')fail('Preset command unavailable: '+command);
   if(busy)fail('Preset export already active');busy=true;
   try{
    if(Object.keys(args).sort().join(',')!=='filePath,presetsToExport')fail('Invalid preset export arguments');
    sync();const lease=destination.take(args.filePath,document),bytes=serializePresetFile(args.presetsToExport);
    const ack=await destination.write(lease,bytes,check);check();
    onTrace({command,phase:'ack',bytes:ack.bytes,sha256:ack.sha256});
    await destination.complete(ack);check();return null;
   }catch(error){onTrace({command,phase:'error',retained:!!error.outputRetained});throw error;}
   finally{busy=false;}
  },
  status:()=>({closed,busy}),destination,
  async close(){closed=true;document.generation++;await libraryHost?.close();},
 };
}
