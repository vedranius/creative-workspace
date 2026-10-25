// Isolated composition of the original modal, opener, callback and durable preference host.
import React from 'react';
import CopyPasteSettingsModal from './src/components/modals/CopyPasteSettingsModal';
import {useSettingsStore} from './src/store/useSettingsStore';
import {useUIStore} from './src/store/useUIStore';
import {loadInitialSettings} from './src/hooks/useAppInitialization';
import {createBrowserSettings,createSettingsDatabase} from '/engine/settings-storage.js';
const backend=createSettingsDatabase();
const host=createBrowserSettings({backend:(globalThis as any).settingsQa?.wrapBackend?.(backend)??backend});
(globalThis as any).rapidRawSettingsStore=useSettingsStore;
let initializationCalls=0;
(globalThis as any).rapidRawInitializeSettings=async()=>{
 const previous=useSettingsStore.getState().appSettings;
 const isCurrent=()=>useSettingsStore.getState().appSettings===previous;
 (globalThis as any).rapidRawInitialization={status:'loading',calls:++initializationCalls};
 try{
  const settings=await loadInitialSettings({supportedAdjustments:['exposure'],isCurrent});
  if(!isCurrent())throw Error('Newer settings superseded initialization');
  useSettingsStore.getState().setAppSettings(settings);
  (globalThis as any).rapidRawInitialization={status:'ready',calls:initializationCalls};
 }catch(error){(globalThis as any).rapidRawInitialization={status:'error',calls:initializationCalls,error:String((error as any).message??error)};}
};
(globalThis as any).rapidRawSettingsHost=host;
const supportedAdjustments=['exposure'];
(globalThis as any).rapidRawPreferenceModals=function OriginalCopyPasteModal(){
 const settings=useSettingsStore(s=>s.appSettings),isOpen=useUIStore(s=>s.isCopyPasteSettingsModalOpen);
 return <CopyPasteSettingsModal isOpen={isOpen} onClose={()=>useUIStore.getState().setUI({isCopyPasteSettingsModalOpen:false})}
  settings={settings!.copyPasteSettings!} supportedAdjustments={supportedAdjustments}
  onSave={copyPasteSettings=>useSettingsStore.getState().handleSettingsChange({...useSettingsStore.getState().appSettings!,copyPasteSettings})}/>;
};
await import('./metadata-copy-paste-main');
export {};
