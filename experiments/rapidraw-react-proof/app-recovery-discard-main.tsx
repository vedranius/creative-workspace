// Actual original App export composition; browser File/IDB and unchanged renderer.
import React from 'react';
import RecoveryPanel from './src/browser/RecoveryPanel';
import {createRecoverySession} from '/engine/export-recovery.js';
import {createRoot} from 'react-dom/client';
import App from './src/App';
import {Panel} from './src/components/ui/AppProperties';
import {Status} from './src/components/ui/ExportImportProperties';
import {createExportDestination} from '/engine/export-destination.js';
import {createExportBridge} from '/engine/export-bridge.js';
import {exportRawInWorker} from '/engine/export-client.js';
import {useSettingsStore} from './src/store/useSettingsStore';
import {useEditorStore} from './src/store/useEditorStore';
import {useUIStore} from './src/store/useUIStore';
import {useLibraryStore} from './src/store/useLibraryStore';
import {useProcessStore} from './src/store/useProcessStore';
import {debouncedSave,debouncedSetHistory} from './src/hooks/useEditorActions';
import {normalizeLoadedAdjustments,INITIAL_ADJUSTMENTS} from './src/utils/adjustments';
import {createBrowserSettings,createSettingsDatabase} from '/engine/settings-storage.js';
import {createMetadataStorage,createMetadataDatabase} from '/engine/metadata-storage.js';
import {createReactTransport} from '/engine/react-transport.js';
import init,* as wasm from '/engine/cw_rapidraw_wasm_probe.js';
import './src/i18n';
import './src/styles.css';
await init();
const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw Error('WebGPU unavailable');
const device=await adapter.requestDevice(),gpuErrors:string[]=[];
device.addEventListener('uncapturederror',event=>gpuErrors.push(event.error.message));
const database=createSettingsDatabase(),host=createBrowserSettings({backend:database});
const metadataDatabase=createMetadataDatabase();
const metadataHost=createMetadataStorage({defaults:normalizeLoadedAdjustments(INITIAL_ADJUSTMENTS),backend:(globalThis as any).appFileQa?.wrapBackend?.(metadataDatabase)??metadataDatabase});
let retention='until-ack';const workerStates:any[]=[];
const destination=createExportDestination({coordinateRecovery:true,getRoot:()=>(globalThis as any).appDiscardQa?.getRoot?.()??navigator.storage.getDirectory(),pickFile:options=>(globalThis as any).appExportQa?.pickFile?.(options)??globalThis.showSaveFilePicker(options),getRetention:()=>retention});
const browserExport={getRetention:()=>retention,setRetention(value:string){if(!['until-ack','keep'].includes(value))throw Error('Choose output retention separately');retention=value;}};
const transport=createReactTransport({metadataHost,settingsHost:host,wasm,device,
 shaderSource:await(await fetch('/engine/shader.wgsl')).text(),defaults:normalizeLoadedAdjustments(INITIAL_ADJUSTMENTS),
 getPreviewSettings:()=>useSettingsStore.getState().appSettings,workerUrl:'/engine/react-image-worker.js',
 exportFactory:host=>createExportBridge({...host,destination,runExport:(bytes,options)=>exportRawInWorker(bytes,{...options,onStatus:state=>{workerStates.push(state);(globalThis as any).appExportQa?.onWorkerStatus?.(state);}})})});
(globalThis as any).rapidRawTransport=transport;
const states:any[]=[];
let selectedFile:File|null=null,registeredPath:string|null=null,closed=false;
const options=()=>({getState:useEditorStore.getState,
 async flushMetadata(path:string,adjustments:any){
  // Join the original pending/in-flight autosave before scheduling another write.
  await debouncedSave.flush();
  const state=useEditorStore.getState();
  if(state.selectedImage?.path!==path||JSON.stringify(state.adjustments)!==JSON.stringify(adjustments))return false;
  const status=metadataHost.status();
  if(status.busy||status.uncertain||status.pendingIO)return false;
  if(!status.dirty)return true;
  debouncedSave(path,adjustments);return debouncedSave.flush();
 },
 cancelDebounce(){debouncedSave.cancel();debouncedSetHistory.cancel();}});
const metadataUnsubscribe=useEditorStore.subscribe(state=>{if(!closed&&state.selectedImage?.isReady)metadataHost.observe(selectedFile,state.adjustments);});
const acknowledge=async()=>{try{await transport.acknowledgeMetadata(options());return true;}catch(error){(globalThis as any).appFileError=String(error);return false;}};
const documentCapabilities={
 async open(file:File,navigate:(path:string)=>Promise<any>){
  if(closed||useEditorStore.getState().selectedImage)throw Error('Close the current RAW before opening another File');
  if(!(file instanceof File)||!(/\.(dng|raf)$/i).test(file.name))throw Error('Select one supported DNG or RAF File');
  // A failed decoder can clear the source selection while its File is still registered.
  // Release that clean previous session before granting another File identity.
  if(registeredPath){await transport.closeDocumentAcknowledged(options());selectedFile=null;registeredPath=null;}
  const [path]=transport.registerFiles([file]);registeredPath=path;
  useLibraryStore.getState().setLibrary({imageList:[{path,is_edited:false,modified:file.lastModified,rating:0,flag:null,tags:[],exif:{},is_virtual_copy:false,is_cloud_placeholder:false,is_raw:true,group_id:null}]});
  await navigate(path);
 },
 async beforeLeave(path?:string){
  if([Status.Exporting,Status.Cancelling].includes(useProcessStore.getState().exportState.status))return false;
  try{
   if(path){await transport.selectRegisteredFileAcknowledged(path,options());selectedFile=transport.registeredFile(path);}
   else await transport.acknowledgeMetadata(options());
   return !closed&&useSettingsStore.getState().browserSettingsReady===true;
  }catch(error){(globalThis as any).appFileError=String(error);return false;}
 },
 acknowledge,
 async close(){await transport.closeDocumentAcknowledged(options());selectedFile=null;registeredPath=null;},
};
useSettingsStore.setState({browserSettingsReady:false});
const capabilities={supportedAdjustments:['exposure'],supportedTypes:{raw:['dng','raf'],nonRaw:[]},onState(state:any){states.push(state);}};
// Existing source layout/store ABI, limited to the two accepted panels.
useUIStore.getState().setUI({panelLayout:{leftTop:[Panel.Export],leftBottom:[],rightTop:[Panel.Adjustments],rightBottom:[]},
 activePanels:{leftTop:Panel.Export,leftBottom:null,rightTop:Panel.Adjustments,rightBottom:null},leftPanelWidth:380});
const recoveryDestination=createExportDestination({coordinateRecovery:true,getRoot:()=>(globalThis as any).appDiscardQa?.getRoot?.()??navigator.storage.getDirectory(),pickFile:options=>(globalThis as any).appRecoveryQa?.pickFile?.(options)??globalThis.showSaveFilePicker(options),getRetention:()=>recoveryRetention});
let recoveryRetention='until-ack';
const recovery={createSession:()=>createRecoverySession({journal:destination,destination:recoveryDestination}),getRetention:()=>recoveryRetention,setRetention:(value:string)=>{if(!['until-ack','keep'].includes(value))throw Error('Invalid retention');recoveryRetention=value;}};
const BrowserRecovery=({onClose}:{onClose:()=>void})=><RecoveryPanel recovery={recovery} onClose={onClose}/>;
const root=createRoot(document.getElementById('root')!);
root.render(<App browserCapabilities={capabilities} browserDocument={documentCapabilities} browserExport={browserExport} browserRecovery={BrowserRecovery}/>);
(globalThis as any).appFileProof={destination,recoveryDestination,workerStates,states,transport,trace:transport.trace,host,metadataHost,gpuErrors,
 store:useEditorStore,settings:useSettingsStore,ui:useUIStore,library:useLibraryStore,process:useProcessStore,
 async close(){closed=true;root.unmount();debouncedSave.cancel();debouncedSetHistory.cancel();metadataUnsubscribe();await transport.close();device.destroy();},
};
export {};
