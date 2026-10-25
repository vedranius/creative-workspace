// QA composition of unchanged original React components, not a public app shell.
import React,{useRef,useState} from 'react';
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
import {normalizeLoadedAdjustments,INITIAL_ADJUSTMENTS} from './src/utils/adjustments';
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
const metadataDefaults=(globalThis as any).rapidRawMetadataFactory?normalizeLoadedAdjustments(INITIAL_ADJUSTMENTS):INITIAL_ADJUSTMENTS;
const metadataHost=(globalThis as any).rapidRawMetadataFactory?.(metadataDefaults);
const rendererTransport=createReactTransport({metadataHost,settingsHost,wasm,device,shaderSource:await(await fetch('/engine/shader.wgsl')).text(),defaults:metadataDefaults,getPreviewSettings:()=>useSettingsStore.getState().appSettings,workerUrl:'/engine/react-image-worker.js',exportFactory:host=>createExportBridge({...host,destination,runExport:(bytes,options)=>exportRawInWorker(bytes,{...options,onStatus:state=>{workerStates.push(state);(globalThis as any).exportQa?.onWorkerStatus?.(state);}})})});
const transport=(globalThis as any).wrapRapidRawTransport?.(rendererTransport)??rendererTransport;
const metadataUnsubscribe=metadataHost?useEditorStore.subscribe((state)=>{if(state.selectedImage?.isReady)metadataHost.observe((globalThis as any).rapidRawMetadataFile,state.adjustments);}):()=>{};
const LibraryComponent=(globalThis as any).rapidRawLibraryComponent;
const EditorComponent=(globalThis as any).rapidRawEditorComponent??Editor;
const LibraryActionsHook=(globalThis as any).rapidRawUseLibraryActions;
const MetadataControls=(globalThis as any).rapidRawMetadataControls;
const metadataTransition=(globalThis as any).rapidRawMetadataTransition;
const PreferenceModals=(globalThis as any).rapidRawPreferenceModals;
const PresetPanel=(globalThis as any).rapidRawPresetPanel;
(globalThis as any).rapidRawTransport=transport;
const settings={editorPreviewResolution:512,useWgpuRenderer:false,enableZoomHifi:false,enableLivePreviews:true,
 livePreviewQuality:'high',baselineExposure:0,compensateHighlightPreservation:true,copyPasteSettings:{autoSync:false},...(globalThis as any).rapidRawProofSettings};
if((globalThis as any).rapidRawInitializeSettings) await (globalThis as any).rapidRawInitializeSettings();
else useSettingsStore.getState().setAppSettings(settingsHost?await transport.invoke('load_settings'):settings as any);
useUIStore.getState().setUI({activeView:'editor',activePanel:Panel.Adjustments} as any);
function Proof(){
 const [openError,setOpenError]=useState('');
 const transform=useRef(null),cached=useRef(null),prev=useRef(null),job=useRef(0),rendered=useRef(0),resolution=useRef(512);
 useImageLoader(cached);
 useImageProcessing(transform,prev,{previewJobIdRef:job,latestRenderedJobIdRef:rendered,currentResRef:resolution});
 useTauriListeners({refreshAllFolderTrees(){},handleSelectSubfolder(){},refreshImageList(){},markGenerated(){}});
 const navigationRefs={transformWrapperRef:transform,cachedEditStateRef:cached,preloadedDataRef:useRef(null),selectedImagePathRef:useRef(null),isBackendReadyRef:useRef(true),latestRenderedJobIdRef:rendered,previewJobIdRef:job,currentResRef:resolution,prevAdjustmentsRef:prev};
 const navigation=(globalThis as any).rapidRawUseMetadataNavigation?.(navigationRefs);
 const libraryActions=LibraryActionsHook?.(navigation,navigationRefs);
 const activeView=useUIStore(s=>s.activeView);
 const adjustments=useEditorStore(s=>s.adjustments),selectedImage=useEditorStore(s=>s.selectedImage);
 const exportState=useProcessStore(s=>s.exportState),appSettings=useSettingsStore(s=>s.appSettings);
 if(!appSettings||(globalThis as any).rapidRawInitialization?.status==='error')return <div role="alert" style={{background:'#171717',color:'#fff',minHeight:'100vh',padding:16}}>Settings could not be loaded. Your saved preferences are unchanged. Reload to read them again.</div>;
 return <><header style={{padding:8}}>Isolated original React ExportPanel — bounded single JPEG / acknowledged output only
  <input aria-label="Open RAW fixture" type="file" accept=".dng,.raf" multiple={!!(globalThis as any).rapidRawLibraryInput} onChange={async event=>{
   const file=event.target.files?.[0];if(!file)return;
   try{
   if((globalThis as any).rapidRawLibraryInput){await (globalThis as any).rapidRawLibraryInput(Array.from(event.target.files??[]));setOpenError('');return;}
   const path=metadataTransition?await transport.selectFileAcknowledged(file,{getState:useEditorStore.getState,flushMetadata:metadataTransition.flush,cancelDebounce:metadataTransition.cancel}):transport.selectFile(file);
   (globalThis as any).rapidRawMetadataFile=file;
   if((globalThis as any).rapidRawUseMetadataNavigation){
    // A selected browser File is the one visible item in this isolated QA library.
    // Folder discovery and arbitrary library navigation remain outside this proof.
    useLibraryStore.getState().setLibrary({imageList:[{path,is_edited:false,modified:file.lastModified,rating:0,flag:null,tags:[],exif:{},is_virtual_copy:false,is_cloud_placeholder:false,is_raw:true,group_id:null}]});
    useUIStore.getState().setUI({activeView:'editor'});
   }
   setOpenError('');
   useLibraryStore.getState().setLibrary({isViewLoading:true});
   useEditorStore.getState().setEditor({selectedImage:{path,width:0,height:0,exif:{},isRaw:false,thumbnailUrl:'',isReady:false} as any,finalPreviewUrl:null,interactivePatch:null});
   }catch(error){setOpenError(String((error as any).message??error));}
  }}/>{openError&&<span role="alert">{openError}</span>}{navigation&&<><span aria-label="Original navigation view">{activeView}</span><button onClick={()=>navigation.handleImageSelect(useEditorStore.getState().selectedImage?.path)}>QA resume cached editor</button><button onClick={()=>{void (globalThis as any).rapidRawNavigation.closeDocument();}}>QA close acknowledged document</button></>}</header><main style={{display:'flex',height:'calc(100vh - 70px)',background:'#171717',color:'white'}}>
  {LibraryComponent&&<LibraryComponent navigation={navigation} libraryActions={libraryActions}/>}
  <section style={{flex:1,minWidth:0,display:navigation&&activeView!=='editor'?'none':'flex'}}><EditorComponent navigation={navigation} libraryActions={libraryActions} transformWrapperRef={transform} onBackToLibrary={navigation?.handleBackToLibrary??(()=>{})} onContextMenu={e=>e.preventDefault()}/></section>
  <aside aria-label="Original Basic panel" style={{width:300,padding:16,overflow:'auto'}}><PanelSwitcher region="rightTop" side="right" placement="top"/>{MetadataControls?<MetadataControls/>:<Basic adjustments={adjustments} appSettings={settings}
   setAdjustments={(update:any)=>useEditorStore.getState().setEditor(state=>({adjustments:typeof update==='function'?update(state.adjustments):{...state.adjustments,...update}}))}
   onDragStateChange={isSliderDragging=>useEditorStore.getState().setEditor({isSliderDragging})}/>}
 <section aria-label="Original geometry panel"><CropPanel/></section></aside><aside aria-label="Original Export panel" style={{width:400,overflow:'auto',padding:12}}>
 <PanelSwitcher region="leftTop" side="left" placement="top"/>
 <label>Recovery retention <select aria-label="Recovery retention" defaultValue="until-ack" onChange={event=>{retention=event.target.value;}}><option value="until-ack">Until write ACK</option><option value="keep">Keep recovery copy</option></select></label>
 <ExportPanel exportState={exportState} selectedImage={selectedImage} multiSelectedPaths={[]} setExportState={useProcessStore.getState().setExportState} appSettings={appSettings} onSettingsChange={settingsHost?useSettingsStore.getState().handleSettingsChange:useSettingsStore.getState().setAppSettings} rootPaths={[]} isVisible={true}/></aside>
 {PresetPanel&&<aside aria-label="Original Presets panel" style={{width:340,overflow:'auto',padding:8}}><PresetPanel/></aside>}
 </main>{PreferenceModals&&<PreferenceModals/>}<ToastContainer position="bottom-left" theme="dark"/></>;
}
function Layout(){const layoutSensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:5}}));return <DndContext sensors={layoutSensors}><ContextMenuProvider><Proof/></ContextMenuProvider></DndContext>;}
const root=createRoot(document.getElementById('root')!);root.render(<Layout/>);
(globalThis as any).proof={metadataHost,...(globalThis as any).rapidRawPresetProof,settingsHost,settingsStore:useSettingsStore,gpuErrors,adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture},store:useEditorStore,processStore:useProcessStore,destination,workerStates,trace:transport.trace,uiStore:useUIStore,setLiveQuality(livePreviewQuality:string){useSettingsStore.getState().setAppSettings({...useSettingsStore.getState().appSettings,livePreviewQuality} as any);},async close(){(globalThis as any).rapidRawCloseInitialization?.();root.unmount();metadataUnsubscribe();await transport.close();device.destroy();},settings};
