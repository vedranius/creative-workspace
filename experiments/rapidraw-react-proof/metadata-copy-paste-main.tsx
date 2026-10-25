// Original BottomBar Copy/Paste with bounded single-File metadata ACK.
import React from 'react';
import EditorView from './src/components/views/EditorView';
import {PasteMode} from './src/utils/adjustments';
import {useEditorActions} from './src/hooks/useEditorActions';
import {ThumbnailAspectRatio} from './src/components/ui/AppProperties';
import {useLibraryActions} from './src/hooks/useLibraryActions';
import {debouncedSave,debouncedSetHistory} from './src/hooks/useEditorActions';
import LibraryGrid from './src/components/panel/library/LibraryGrid';
import {useSortedLibrary} from './src/hooks/useSortedLibrary';
import {useLibraryStore} from './src/store/useLibraryStore';
import {useEditorStore} from './src/store/useEditorStore';
import {useUIStore} from './src/store/useUIStore';
(globalThis as any).rapidRawProofSettings={copyPasteSettings:{mode:PasteMode.Replace,includedAdjustments:['exposure'],knownAdjustments:['exposure'],autoSync:false}};
(globalThis as any).rapidRawCopyPasteModes=PasteMode;
const host=()=> (globalThis as any).rapidRawTransport;
(globalThis as any).rapidRawNavigationTarget=async(nextPath:string|undefined,options:any)=>{
 if(nextPath){await host().selectRegisteredFileAcknowledged(nextPath,options);(globalThis as any).rapidRawMetadataFile=host().registeredFile(nextPath);}
 else await host().acknowledgeMetadata(options);
};
(globalThis as any).rapidRawLibraryInput=async(files:File[])=>{
 const paths=host().registerFiles(files);useLibraryStore.getState().setLibrary({imageList:paths.map((path:string)=>({path,is_edited:false,modified:0,rating:0,flag:null,tags:[],exif:{},is_virtual_copy:false,is_cloud_placeholder:false,is_raw:true,group_id:null}))});
 if(!useEditorStore.getState().selectedImage)useUIStore.getState().setUI({activeView:'library'});
 (globalThis as any).rapidRawLibraryPaths=paths;
};
(globalThis as any).rapidRawUseLibraryActions=function useSharedOriginalActions(navigation:any,refs:any){
 const actions=useLibraryActions(navigation.handleImageSelect,async()=>{
  try{await host().acknowledgeMetadata({getState:useEditorStore.getState,
   flushMetadata(path:string,adjustments:any){debouncedSave(path,adjustments);return debouncedSave.flush();},
   cancelDebounce(){debouncedSave.cancel();debouncedSetHistory.cancel();}});return true;}
  catch(error){(globalThis as any).navigationError=String((error as any).message??error);return false;}
 });
 (globalThis as any).rapidRawLibraryActions=actions;
 (globalThis as any).rapidRawLibraryStore=useLibraryStore;
 const editor=useEditorActions({
  beforePaste:async()=>{try{await host().acknowledgeMetadata({getState:useEditorStore.getState,
   flushMetadata(path:string,adjustments:any){debouncedSave(path,adjustments);return debouncedSave.flush();},
   cancelDebounce(){debouncedSave.cancel();debouncedSetHistory.cancel();}});return true;}
   catch(error){(globalThis as any).pasteError=String((error as any).message??error);return false;}},
  onPasteAcknowledged(path:string,adjustments:any){refs.prevAdjustmentsRef.current={path,adjustments};},
 });
 (globalThis as any).rapidRawEditorActions=editor;
 return {...actions,handleCopyAdjustments:editor.handleCopyAdjustments,handlePasteAdjustments:editor.handlePasteAdjustments};
};
(globalThis as any).rapidRawLibraryComponent=function OriginalSelectedLibrary({navigation,libraryActions:actions}:any){
 const {displayList}=useSortedLibrary(),activePath=useLibraryStore(s=>s.libraryActivePath),multiSelectedPaths=useLibraryStore(s=>s.multiSelectedPaths),ratings=useLibraryStore(s=>s.imageRatings);
 return <aside aria-label="Original LibraryGrid" style={{width:270,height:'100%',background:'#222',position:'relative',display:'flex',flexShrink:0,minHeight:0}}><LibraryGrid imageList={displayList} activePath={activePath} multiSelectedPaths={multiSelectedPaths} imageRatings={ratings} libraryViewMode="flat" libraryDisplayMode="grid" thumbnailSize="small" thumbnailSizeOptions={[{id:'small',size:110}]} onThumbnailSizeChange={()=>{}} thumbnailAspectRatio="contain" currentFolderPath={null} groupBadgeInfo={null} onContextMenu={(e:any)=>e.preventDefault()} onClearSelection={actions.handleClearSelection} onImageClick={(path:string,event:any,visible?:string[])=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey)void actions.handleLibraryImageSingleClick(path,event,visible);}} onImageDoubleClick={navigation.handleImageSelect}/></aside>;
};
(globalThis as any).rapidRawEditorComponent=function OriginalFilmstripEditor({navigation,libraryActions:actions,transformWrapperRef,onContextMenu}:any){
 const {displayList}=useSortedLibrary();
 return <div aria-label="Original EditorView" style={{display:'flex',flex:1,minHeight:0,height:'100%'}}><EditorView
  transformWrapperRef={transformWrapperRef} isResizing={false} layoutMode="wide" isAndroid={false}
  compactEditorPanelHeight={300} compactEditorPanelCollapsedHeight={48} thumbnailAspectRatio={ThumbnailAspectRatio.Contain}
  sortedImageList={displayList} createResizeHandler={()=>()=>{}} createResizeResetHandler={()=>()=>{}}
  handleBackToLibrary={navigation.handleBackToLibrary} handleEditorContextMenu={onContextMenu}
  handleThumbnailContextMenu={(event:any)=>event.preventDefault()} handleMainLibraryContextMenu={(event:any)=>event.preventDefault()}
  handleImageClick={(path:string,event:any,visible?:string[])=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey)void actions.handleImageClick(path,event,visible);}}
  handleClearSelection={actions.handleClearSelection} handleCopyAdjustments={actions.handleCopyAdjustments} handlePasteAdjustments={actions.handlePasteAdjustments} handleRate={()=>{}}
  handleZoomChange={zoom=>useEditorStore.getState().setEditor({zoomLevel:zoom})}
  handlePanelSelect={activePanel=>useUIStore.getState().setUI({activePanel})} requestThumbnails={()=>{}} renderAppPanel={()=>null}
 /></div>;
};
await import('./metadata-navigation-main');
export {};
