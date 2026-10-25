// Experimental composition mounting the complete original initialization hook.
import React,{useRef,useState} from 'react';
import {createRoot,Root} from 'react-dom/client';
import CopyPasteSettingsModal from './src/components/modals/CopyPasteSettingsModal';
import {useAppInitialization,BrowserInitializationCapabilities} from './src/hooks/useAppInitialization';
import {ThumbnailSize,ThumbnailAspectRatio,LibraryViewMode} from './src/components/ui/AppProperties';
import {useSettingsStore} from './src/store/useSettingsStore';
import {useUIStore} from './src/store/useUIStore';
import {useLibraryStore} from './src/store/useLibraryStore';
import {createBrowserSettings,createSettingsDatabase} from '/engine/settings-storage.js';
const backend=createSettingsDatabase();
const host=createBrowserSettings({backend:(globalThis as any).settingsQa?.wrapBackend?.(backend)??backend});
(globalThis as any).rapidRawSettingsHost=host;
(globalThis as any).rapidRawSettingsStore=useSettingsStore;
(globalThis as any).rapidRawInitializationStores={ui:useUIStore,library:useLibraryStore};
let initializationRoot:Root|undefined;
const node=document.createElement('div');document.body.appendChild(node);
(globalThis as any).rapidRawInitializeSettings=()=>{
 useSettingsStore.setState({browserSettingsReady:false});
 return new Promise<void>(resolve=>{
 const states:any[]=[];
 const capabilities:BrowserInitializationCapabilities={supportedAdjustments:['exposure'],supportedTypes:{raw:['dng','raf'],nonRaw:[]},onState(state){
  states.push(state);
  (globalThis as any).rapidRawInitialization={...state,status:state.status==='closed'?'error':state.status,states:[...states],calls:states.filter(s=>s.status==='loading').length,fullHookMounted:true};
  if(state.status!=='loading')resolve();
 }};
 function OriginalStartup(){
  const preloadedDataRef=useRef(null);
  const [thumbnailSize,setThumbnailSize]=useState(ThumbnailSize.Medium);
  const [thumbnailAspectRatio,setThumbnailAspectRatio]=useState(ThumbnailAspectRatio.Contain);
  const [libraryViewMode,setLibraryViewMode]=useState(LibraryViewMode.Flat);
  (globalThis as any).rapidRawInitializationControls={setThumbnailSize,setThumbnailAspectRatio,setLibraryViewMode,preloadedDataRef};
  useAppInitialization({preloadedDataRef,thumbnailSize,setThumbnailSize,thumbnailAspectRatio,setThumbnailAspectRatio,libraryViewMode,setLibraryViewMode,browserCapabilities:capabilities});
  return null;
 }
 initializationRoot=createRoot(node);initializationRoot.render(<OriginalStartup/>);
 });
};
(globalThis as any).rapidRawCloseInitialization=()=>{initializationRoot?.unmount();initializationRoot=undefined;node.remove();};
(globalThis as any).rapidRawPreferenceModals=function OriginalCopyPasteModal(){
 const settings=useSettingsStore(s=>s.appSettings),isOpen=useUIStore(s=>s.isCopyPasteSettingsModalOpen);
 return <CopyPasteSettingsModal isOpen={isOpen} onClose={()=>useUIStore.getState().setUI({isCopyPasteSettingsModalOpen:false})}
  settings={settings!.copyPasteSettings!} supportedAdjustments={['exposure']}
  onSave={copyPasteSettings=>useSettingsStore.getState().handleSettingsChange({...useSettingsStore.getState().appSettings!,copyPasteSettings})}/>;
};
await import('./metadata-copy-paste-main');
export {};
