// Isolated original LibraryGrid gestures + original navigation; explicit browser Files only.
import React from 'react';
import LibraryGrid from './src/components/panel/library/LibraryGrid';
import {useSortedLibrary} from './src/hooks/useSortedLibrary';
import {useLibraryStore} from './src/store/useLibraryStore';
import {useEditorStore} from './src/store/useEditorStore';
import {useUIStore} from './src/store/useUIStore';
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
(globalThis as any).rapidRawLibraryComponent=function OriginalSelectedLibrary({navigation}:any){
 const {displayList}=useSortedLibrary(),activePath=useLibraryStore(s=>s.libraryActivePath),multiSelectedPaths=useLibraryStore(s=>s.multiSelectedPaths),ratings=useLibraryStore(s=>s.imageRatings);
 return <aside aria-label="Original LibraryGrid" style={{width:270,height:'100%',background:'#222',position:'relative',display:'flex',flexShrink:0,minHeight:0}}><LibraryGrid imageList={displayList} activePath={activePath} multiSelectedPaths={multiSelectedPaths} imageRatings={ratings} libraryViewMode="flat" libraryDisplayMode="grid" thumbnailSize="small" thumbnailSizeOptions={[{id:'small',size:110}]} onThumbnailSizeChange={()=>{}} thumbnailAspectRatio="contain" currentFolderPath={null} groupBadgeInfo={null} onContextMenu={(e:any)=>e.preventDefault()} onImageClick={()=>{}} onImageDoubleClick={navigation.handleImageSelect}/></aside>;
};
await import('./metadata-navigation-main');
export {};
