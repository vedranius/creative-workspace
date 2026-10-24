// Original controls and acknowledged autosave completion, isolated browser composition.
import Controls from './src/components/panel/right/ControlsPanel';
import {debouncedSave,debouncedSetHistory} from './src/hooks/useEditorActions';
(globalThis as any).rapidRawMetadataControls=Controls;
(globalThis as any).rapidRawMetadataTransition={
 flush(path:string,adjustments:any){debouncedSave(path,adjustments);return debouncedSave.flush();},
 cancel(){debouncedSave.cancel();debouncedSetHistory.cancel();},
};
await import('./metadata-main');
export {};
