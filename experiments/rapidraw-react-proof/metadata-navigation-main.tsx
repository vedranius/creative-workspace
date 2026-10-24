// QA composition: original navigation hook, controls and in-memory editor cache.
import {useAppNavigation} from './src/hooks/useAppNavigation';
import {useEditorStore} from './src/store/useEditorStore';
import {useUIStore} from './src/store/useUIStore';
import {globalImageCache} from './src/utils/ImageLRUCache';
import {debouncedSave,debouncedSetHistory} from './src/hooks/useEditorActions';
const options=()=>({getState:useEditorStore.getState,
 flushMetadata(path:string,adjustments:any){debouncedSave(path,adjustments);return debouncedSave.flush();},
 cancelDebounce(){debouncedSave.cancel();debouncedSetHistory.cancel();}});
(globalThis as any).rapidRawUseMetadataNavigation=(refs:any)=>{
 const navigation=useAppNavigation({refs,clearThumbnailQueue(){},beforeLeaveEditor:async()=>{
  try{await (globalThis as any).rapidRawTransport.acknowledgeMetadata(options());return true;}
  catch(error){(globalThis as any).navigationError=String((error as any).message??error);return false;}
 }});
 (globalThis as any).rapidRawNavigation={...navigation,cache:globalImageCache,
  async closeDocument(){
   try{await (globalThis as any).rapidRawTransport.closeDocumentAcknowledged(options());
    (globalThis as any).rapidRawMetadataFile=null;globalImageCache.clear();
    useEditorStore.getState().setEditor({selectedImage:null,finalPreviewUrl:null,interactivePatch:null});
    useUIStore.getState().setUI({activeView:'library'});return true;
   }catch(error){(globalThis as any).navigationError=String((error as any).message??error);return false;}
  },
 };
 return navigation;
};
await import('./metadata-lifecycle-main');
export {};
