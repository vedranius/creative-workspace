// Isolated composition of the original modal, opener, callback and durable preference host.
import React from 'react';
import CopyPasteSettingsModal from './src/components/modals/CopyPasteSettingsModal';
import {useSettingsStore} from './src/store/useSettingsStore';
import {useUIStore} from './src/store/useUIStore';
import {PasteMode} from './src/utils/adjustments';
import {createBrowserSettings,createSettingsDatabase} from '/engine/settings-storage.js';
const backend=createSettingsDatabase();
const host=createBrowserSettings({backend:(globalThis as any).settingsQa?.wrapBackend?.(backend)??backend});
const load=host.load;
// Old autoSync-only records remain byte-canonical; the isolated UI supplies bounded defaults without a write.
host.load=async()=>{const value=await load();return {...value,copyPasteSettings:{mode:PasteMode.Merge,includedAdjustments:['exposure'],knownAdjustments:['exposure'],...value.copyPasteSettings}};};
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
