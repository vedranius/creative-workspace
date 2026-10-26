// Actual-root composition only. Existing native serializer/destination remain authoritative.
import {serializePresetFile} from './preset-file.js';
export function createSelectedPresetExport({host,library,backend,timeoutMs=10000,allowFolders=false,allowAll=false}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)throw Error('Invalid preset export deadline');
 let busy=false,closed=false,stale=false,pending=false;const choices=new Map();
 const check=()=>{if(closed||stale||pending)throw Error('Reload preset export before continuing');};
 const current=async()=>{
  check();const before=library.status();
  if(before.closed||before.busy||before.uncertain||before.pendingIO||before.revision===null)throw Error('Reload preset library before exporting');
  pending=true;let timer;const read=Promise.resolve().then(()=>backend.read());read.finally(()=>pending=false).catch(()=>{});
  let record;try{record=await Promise.race([read,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Preset export library read timed out')),timeoutMs))]);}catch(error){stale=true;throw error;}finally{clearTimeout(timer);}
  check();const after=library.status();
  if(after.closed||after.busy||after.uncertain||after.pendingIO||after.revision!==before.revision||record?.revision!==before.revision){stale=true;throw Error('Preset library changed; reload before exporting');}
  // Validate bounded native-shaped bytes before granting any destination authority.
  serializePresetFile(record.presets);return record;
 };
 return {
  async choose(options){
   check();if(busy)throw Error('Preset export already active');busy=true;
   try{
    if(!options||Object.keys(options).some(k=>!['defaultPath','filters','title'].includes(k))||!options.filters?.some(f=>f.extensions?.length===1&&f.extensions[0]==='rrpreset'))throw Error('Only one preset output is available');
    const record=await current(),all=allowAll&&options.defaultPath==='all_presets.rrpreset';
    const filename=i=>((i.preset??i.folder).name+'.rrpreset').replace(/[<>:"/\\|?*]/g,'_');
    // The original all-library filename cannot also identify a selected item.
    if(all&&record.presets.some(i=>filename(i)===options.defaultPath))throw Error('Ambiguous all-presets output name; rename the colliding item first');
    const toolItem=i=>i.preset?.presetType==='tool'||!!i.folder&&i.folder.children.every(p=>p.presetType==='tool');
    const selected=all?record.presets:record.presets.filter(i=>{
     const eligible=i.preset?.presetType==='tool'||allowFolders&&i.folder?.children.every(p=>p.presetType==='tool');
     return eligible&&options.defaultPath===filename(i);
    });
    if(all?selected.length===0||!selected.every(toolItem):selected.length!==1)throw Error('Choose one existing Exposure Tool preset or unambiguous bounded Tool library');
    if(choices.size>=16)throw Error('Too many preset output choices');
    const token=await host.choose(options);if(!token)return null;
    const fresh=await current();if(JSON.stringify(fresh)!==JSON.stringify(record)){stale=true;throw Error('Preset library changed during output selection');}
    choices.set(token,{record,selected});return token;
   }finally{busy=false;}
  },
  async invoke(command,args){
   check();if(command!=='handle_export_presets_to_file')throw Error('Selected preset export command unavailable');
   if(busy)throw Error('Preset export already active');busy=true;
   const choice=choices.get(args?.filePath);choices.delete(args?.filePath);
   try{
    if(!choice)throw Error('Choose a fresh preset output');
    const record=await current();
    if(JSON.stringify(record)!==JSON.stringify(choice.record)){stale=true;throw Error('Preset library changed after output selection');}
    if(JSON.stringify(args.presetsToExport)!==JSON.stringify(choice.selected))throw Error('Export the selected unchanged preset, folder or bounded library only');
    return await host.invoke(command,args);
   }finally{busy=false;}
  },
  status:()=>({busy,closed,stale,pendingIO:pending}),
  close(){closed=true;choices.clear();},
 };
}
