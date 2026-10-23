// QA composition of unchanged original React components, not a public app shell.
import React,{useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {ToastContainer} from 'react-toastify';
import Editor from './src/components/panel/Editor';
import Basic from './src/components/adjustments/Basic';
import {DndContext,PointerSensor,useSensor,useSensors} from '@dnd-kit/core';
import PanelSwitcher from './src/components/panel/PanelSwitcher';
import CropPanel from './src/components/panel/right/CropPanel';
import {ContextMenuProvider} from './src/context/ContextMenuContext';
import {useImageLoader} from './src/hooks/useImageLoader';
import {useImageProcessing} from './src/hooks/useImageProcessing';
import {useEditorStore} from './src/store/useEditorStore';
import {useUIStore} from './src/store/useUIStore';
import {useLibraryStore} from './src/store/useLibraryStore';
import ExportPanel from './src/components/panel/right/ExportPanel';
import {useTauriListeners} from './src/hooks/useTauriListeners';
import {useProcessStore} from './src/store/useProcessStore';
import {createExportDestination} from '/engine/export-destination.js';
import {createExportBridge} from '/engine/export-bridge.js';
import {exportRawInWorker} from '/engine/export-client.js';
import {useSettingsStore} from './src/store/useSettingsStore';
import {INITIAL_ADJUSTMENTS} from './src/utils/adjustments';
import {THEMES,DEFAULT_THEME_ID} from './src/utils/themes';
import {Panel} from './src/components/ui/AppProperties';
import './src/i18n';
import './src/styles.css';
import init,* as wasm from '/engine/cw_rapidraw_wasm_probe.js';
import {createReactTransport} from '/engine/react-transport.js';
const baseTheme=THEMES.find(t=>t.id===DEFAULT_THEME_ID)!;Object.entries(baseTheme.cssVariables).forEach(([key,value])=>document.documentElement.style.setProperty(key,value as string));
document.documentElement.style.setProperty('--font-family','-apple-system, BlinkMacSystemFont, system-ui, sans-serif');
await init();
const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw Error('WebGPU unavailable');
const device=await adapter.requestDevice();const gpuErrors:string[]=[];device.addEventListener('uncapturederror',e=>gpuErrors.push(e.error.message));
const settingsHost=(globalThis as any).rapidRawSettingsHost;
let retention='until-ack';const workerStates:any[]=[];
// QA may inject a real OPFS chooser; normal operation requires the OS picker.
const destination=createExportDestination({pickFile:options=>(globalThis as any).exportQa?.pickFile?.(options)??globalThis.showSaveFilePicker(options),getRetention:()=>retention});
const transport=createReactTransport({settingsHost,wasm,device,shaderSource:await(await fetch('/engine/shader.wgsl')).text(),defaults:INITIAL_ADJUSTMENTS,getPreviewSettings:()=>useSettingsStore.getState().appSettings,workerUrl:'/engine/react-image-worker.js',exportFactory:host=>createExportBridge({...host,destination,runExport:(bytes,options)=>exportRawInWorker(bytes,{...options,onStatus:state=>{workerStates.push(state);(globalThis as any).exportQa?.onWorkerStatus?.(state);}})})});
(globalThis as any).rapidRawTransport=transport;
const settings={editorPreviewResolution:512,useWgpuRenderer:false,enableZoomHifi:false,enableLivePreviews:true,
 livePreviewQuality:'high',baselineExposure:0,compensateHighlightPreservation:true,copyPasteSettings:{autoSync:false}};
useSettingsStore.getState().setAppSettings(settingsHost?await transport.invoke('load_settings'):settings as any);
useUIStore.getState().setUI({activeView:'editor',activePanel:Panel.Adjustments} as any);
function Proof(){
 const transform=useRef(null),cached=useRef(null),prev=useRef(null),job=useRef(0),rendered=useRef(0),resolution=useRef(512);
 useImageLoader(cached);
 useImageProcessing(transform,prev,{previewJobIdRef:job,latestRenderedJobIdRef:rendered,currentResRef:resolution});
 useTauriListeners({refreshAllFolderTrees(){},handleSelectSubfolder(){},refreshImageList(){},markGenerated(){}});
 const adjustments=useEditorStore(s=>s.adjustments),selectedImage=useEditorStore(s=>s.selectedImage);
 const exportState=useProcessStore(s=>s.exportState),appSettings=useSettingsStore(s=>s.appSettings);
 return <><header style={{padding:8}}>Isolated original React ExportPanel — bounded single JPEG / acknowledged output only
  <input aria-label="Open RAW fixture" type="file" accept=".dng,.raf" onChange={event=>{
   const file=event.target.files?.[0];if(!file)return;
   const path=transport.selectFile(file);
   useLibraryStore.getState().setLibrary({isViewLoading:true});
   useEditorStore.getState().setEditor({selectedImage:{path,width:0,height:0,exif:{},isRaw:false,thumbnailUrl:'',isReady:false} as any,finalPreviewUrl:null,interactivePatch:null});
  }}/></header><main style={{display:'flex',height:'calc(100vh - 70px)',background:'#171717',color:'white'}}>
  <section style={{flex:1,minWidth:0,display:'flex'}}><Editor transformWrapperRef={transform} onBackToLibrary={()=>{}} onContextMenu={e=>e.preventDefault()}/></section>
  <aside aria-label="Original Basic panel" style={{width:300,padding:16,overflow:'auto'}}><PanelSwitcher region="rightTop" side="right" placement="top"/><Basic adjustments={adjustments} appSettings={settings}
   setAdjustments={(update:any)=>useEditorStore.getState().setEditor(state=>({adjustments:typeof update==='function'?update(state.adjustments):{...state.adjustments,...update}}))}
   onDragStateChange={isSliderDragging=>useEditorStore.getState().setEditor({isSliderDragging})}/>
 <section aria-label="Original geometry panel"><CropPanel/></section></aside><aside aria-label="Original Export panel" style={{width:400,overflow:'auto',padding:12}}>
 <PanelSwitcher region="leftTop" side="left" placement="top"/>
 <label>Recovery retention <select aria-label="Recovery retention" defaultValue="until-ack" onChange={event=>{retention=event.target.value;}}><option value="until-ack">Until write ACK</option><option value="keep">Keep recovery copy</option></select></label>
 <ExportPanel exportState={exportState} selectedImage={selectedImage} multiSelectedPaths={[]} setExportState={useProcessStore.getState().setExportState} appSettings={appSettings} onSettingsChange={settingsHost?useSettingsStore.getState().handleSettingsChange:useSettingsStore.getState().setAppSettings} rootPaths={[]} isVisible={true}/></aside>
 </main><ToastContainer position="bottom-left" theme="dark"/></>;
}
function Layout(){const layoutSensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:5}}));return <DndContext sensors={layoutSensors}><ContextMenuProvider><Proof/></ContextMenuProvider></DndContext>;}
const root=createRoot(document.getElementById('root')!);root.render(<Layout/>);
(globalThis as any).proof={settingsHost,settingsStore:useSettingsStore,gpuErrors,adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture},store:useEditorStore,processStore:useProcessStore,destination,workerStates,trace:transport.trace,uiStore:useUIStore,setLiveQuality(livePreviewQuality:string){useSettingsStore.getState().setAppSettings({...useSettingsStore.getState().appSettings,livePreviewQuality} as any);},async close(){root.unmount();await transport.close();device.destroy();},settings};
