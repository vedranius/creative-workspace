// Local bootstrap of the actual pinned AppWrapper/App, without desktop authority.
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './src/App';
import {useSettingsStore} from './src/store/useSettingsStore';
import {useUIStore} from './src/store/useUIStore';
import {useLibraryStore} from './src/store/useLibraryStore';
import {useProcessStore} from './src/store/useProcessStore';
import {useCloudStore} from './src/store/useCloudStore';
import {createBrowserSettings,createSettingsDatabase} from '/engine/settings-storage.js';
import './src/styles.css';
const database=createSettingsDatabase();
const host=createBrowserSettings({backend:(globalThis as any).appRootQa?.wrapBackend?.(database)??database});
const trace:any[]=[],states:any[]=[];
let closed=false;
(globalThis as any).rapidRawTransport={
 invoke(command:string,args:any){
  trace.push({command});
  if(closed)return Promise.reject(Error('Browser root is closed'));
  if(command==='load_settings')return host.load();
  if(command==='save_settings')return host.save(args?.settings);
  return Promise.reject(Error('Unavailable in browser root: '+command));
 },
 listen(event:string){trace.push({event});throw Error('Native root listener is unavailable: '+event);},
};
useSettingsStore.setState({browserSettingsReady:false});
const capabilities={supportedAdjustments:['exposure'],supportedTypes:{raw:['dng','raf'],nonRaw:[]},onState(state:any){states.push(state);}};
const root=createRoot(document.getElementById('root')!);
root.render(<App browserCapabilities={capabilities}/>);
let mounted=true;
(globalThis as any).appRootProof={trace,states,host,database,settings:useSettingsStore,ui:useUIStore,library:useLibraryStore,process:useProcessStore,cloud:useCloudStore,
 unmount(){if(mounted){root.unmount();mounted=false;}},
 async close(){this.unmount();closed=true;await host.close();},
};
export {};
