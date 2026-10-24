// Isolated original PresetsPanel; no RAW/preview/render or general library-write acceptance.
import React from 'react';
import {createRoot} from 'react-dom/client';
import PresetsPanel from './src/components/panel/right/PresetsPanel';
import {ContextMenuProvider} from './src/context/ContextMenuContext';
import {THEMES,DEFAULT_THEME_ID} from './src/utils/themes';
import {createPresetFileHost} from '/engine/preset-file.js';
import {createExportDestination} from '/engine/export-destination.js';
import './src/i18n';
import './src/styles.css';
const theme=THEMES.find(t=>t.id===DEFAULT_THEME_ID)!;
Object.entries(theme.cssVariables).forEach(([k,v])=>document.documentElement.style.setProperty(k,v as string));
document.documentElement.style.setProperty('--font-family','sans-serif');
const qa=(globalThis as any).presetQa,trace:any[]=[];let retention='until-ack';
const destination=createExportDestination({format:'rrpreset',getRetention:()=>retention,pickFile:options=>qa?.pickFile?.(options)??globalThis.showSaveFilePicker(options)});
const host=createPresetFileHost({items:qa?.initialPresets??[],destination,onTrace:event=>trace.push(event),libraryHost:(globalThis as any).rapidRawPresetLibrary});
(globalThis as any).rapidRawTransport={invoke:async(command:string,args:any)=>{const value=await host.invoke(command,args);trace.push({command,phase:'resolved'});return value;},pickExport:(options:any)=>host.choose(options),pickPresets:()=>host.chooseImport()};
const root=createRoot(document.getElementById('root')!);
root.render(<ContextMenuProvider><main style={{height:650,width:560,background:'#171717',color:'white'}}>
 <header style={{padding:12}}>Isolated original development PresetsPanel — Exposure file import/export
 <label>Recovery retention <select aria-label="Recovery retention" onChange={e=>{retention=e.target.value;}}><option value="until-ack">Until write ACK</option><option value="keep">Keep recovery copy</option></select></label></header>
 <PresetsPanel onNavigateToCommunity={()=>{throw Error('Community is unavailable in this proof');}}/>
 </main></ContextMenuProvider>);
(globalThis as any).proof={host,destination,trace,library:(globalThis as any).rapidRawPresetLibrary,async close(){root.unmount();await host.close();}};
