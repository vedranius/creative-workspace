// Actual original preset panel composed with the existing original editor/preview flow.
import React from 'react';
import PresetsPanel from './src/components/panel/right/PresetsPanel';
import {createPresetLibrary,createPresetLibraryDatabase} from '/engine/preset-library.js';
import {createPresetFileHost} from '/engine/preset-file.js';
import {createExportDestination} from '/engine/export-destination.js';
const qa=(globalThis as any).presetQa,rawBackend=createPresetLibraryDatabase(),backend=qa?.wrapLibrary?.(rawBackend)??rawBackend;
const library=createPresetLibrary({backend,pickFiles:o=>qa?.pickInputs?.(o)??globalThis.showOpenFilePicker(o)});
const destination=createExportDestination({format:'rrpreset',pickFile:o=>qa?.pickPresetFile?.(o)??globalThis.showSaveFilePicker(o)});
let trace:any[]=[];
const host=createPresetFileHost({libraryHost:library,destination,onTrace:e=>trace.push(e)});
(globalThis as any).rapidRawPresetProof={presetLibrary:library,presetHost:host};
(globalThis as any).rapidRawPresetPanel=()=> <PresetsPanel onNavigateToCommunity={()=>{throw Error('Community unavailable in this experiment');}}/>;
(globalThis as any).wrapRapidRawTransport=(renderer:any)=>{
 trace=renderer.trace;
 return {...renderer,async invoke(command:string,args:any){
  if(command==='load_presets'||command==='handle_import_presets_from_files'||command==='handle_export_presets_to_file'||(globalThis as any).rapidRawPresetCreation&&command==='save_presets'){
   const value=await host.invoke(command,args);trace.push({command,phase:'resolved'});return value;
  }
  return renderer.invoke(command,args);
 },pickExport:(o:any)=>o?.filters?.some((f:any)=>f.extensions?.includes('rrpreset'))?host.choose(o):renderer.pickExport(o),
 pickPresets:(o:any)=>{if(o?.directory||!o?.filters?.some((f:any)=>f.extensions?.includes('rrpreset')))throw Error('Only preset import is available');return host.chooseImport();},
 async close(){await host.close();await renderer.close();}};
};
await import('./export-main');
