// QA composition of unchanged original React components, not a public app shell.
import React,{useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {ToastContainer} from 'react-toastify';
import Editor from './src/components/panel/Editor';
import Basic from './src/components/adjustments/Basic';
import {useImageLoader} from './src/hooks/useImageLoader';
import {useImageProcessing} from './src/hooks/useImageProcessing';
import {useEditorStore} from './src/store/useEditorStore';
import {useUIStore} from './src/store/useUIStore';
import {useLibraryStore} from './src/store/useLibraryStore';
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
const transport=createReactTransport({wasm,device,shaderSource:await(await fetch('/engine/shader.wgsl')).text(),defaults:INITIAL_ADJUSTMENTS,workerUrl:'/engine/worker.js'});
(globalThis as any).rapidRawTransport=transport;
const settings={editorPreviewResolution:512,useWgpuRenderer:false,enableZoomHifi:false,enableLivePreviews:true,
 baselineExposure:0,compensateHighlightPreservation:true,copyPasteSettings:{autoSync:false}};
useSettingsStore.getState().setAppSettings(settings as any);
useUIStore.getState().setUI({activeView:'editor',activePanel:Panel.Adjustments} as any);
function Proof(){
 const transform=useRef(null),cached=useRef(null),prev=useRef(null),job=useRef(0),rendered=useRef(0),resolution=useRef(512);
 useImageLoader(cached);
 useImageProcessing(transform,prev,{previewJobIdRef:job,latestRenderedJobIdRef:rendered,currentResRef:resolution});
 const adjustments=useEditorStore(s=>s.adjustments);
 return <><header style={{padding:8}}>Isolated original React / native Speed development proof — no save support
  <input aria-label="Open RAW fixture" type="file" accept=".dng,.raf" onChange={event=>{
   const file=event.target.files?.[0];if(!file)return;
   const path=transport.selectFile(file);
   useLibraryStore.getState().setLibrary({isViewLoading:true});
   useEditorStore.getState().setEditor({selectedImage:{path,width:0,height:0,exif:{},isRaw:false,thumbnailUrl:'',isReady:false} as any,finalPreviewUrl:null,interactivePatch:null});
  }}/></header><main style={{display:'flex',height:'calc(100vh - 70px)',background:'#171717',color:'white'}}>
  <section style={{flex:1,minWidth:0,display:'flex'}}><Editor transformWrapperRef={transform} onBackToLibrary={()=>{}} onContextMenu={e=>e.preventDefault()}/></section>
  <aside aria-label="Original Basic panel" style={{width:300,padding:16,overflow:'auto'}}><Basic adjustments={adjustments} appSettings={settings}
   setAdjustments={(update:any)=>useEditorStore.getState().setEditor(state=>({adjustments:typeof update==='function'?update(state.adjustments):{...state.adjustments,...update}}))}
   onDragStateChange={isSliderDragging=>useEditorStore.getState().setEditor({isSliderDragging})}/></aside>
 </main><ToastContainer position="bottom-left" theme="dark"/></>;
}
const root=createRoot(document.getElementById('root')!);root.render(<Proof/>);
(globalThis as any).proof={gpuErrors,adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture},store:useEditorStore,trace:transport.trace,async close(){root.unmount();await transport.close();device.destroy();},settings};
