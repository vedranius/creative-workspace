import {LocalFolderAgent} from './agent.js';

const agents=new Map();
// Lazy loading keeps existing editor sessions usable with an older running gateway.
export async function openRecovery(options){
  const module=await import('./recovery.js').catch(()=>{throw new Error('Save recovery requires the updated server. Save your open documents before restarting it.');});
  return module.openRecovery(options);
}
const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
async function api(url,method='GET',value){const response=await fetch(url,{method,headers:value===undefined?{}:{'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Folder service failed');return data;}
function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('cw-local-folders',1);request.onupgradeneeded=()=>request.result.createObjectStore('folders',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function saveHandle(value){const db=await database();try{await new Promise((resolve,reject)=>{const transaction=db.transaction('folders','readwrite');transaction.objectStore('folders').put(value);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});}finally{db.close();}}

export async function chooseLocalFolder({app,onReady,onStatus=()=>{}}){
  const supported=window.isSecureContext&&typeof window.showDirectoryPicker==='function';
  if(!supported)throw new Error('Local folder sharing requires a browser with File System Access (Chrome/Edge) and HTTPS or localhost. File upload remains available.');
  const caps=await api('/api/storage/capabilities');
  const dialog=element('dialog');dialog.className='storage-dialog';
  const title=element('div');title.className='dialog-title';title.append(element('h2','Work with a laptop folder'));const close=element('button','×');close.type='button';close.onclick=()=>dialog.close();title.append(close);dialog.append(title);
  dialog.append(element('p','Choose where your originals stay and where your results are saved. The server processes the selected document.'));
  const modeLabel=element('label','Working mode');const mode=element('select');
  for(const [value,label]of [['ondemand','On demand — originals stay on laptop'],['hybrid','On demand + background server copy'],['transfer','Copy the whole folder to server first']]){const option=element('option',label);option.value=value;if(value!=='transfer'&&!caps.ondemand)option.disabled=true;mode.append(option);}mode.value=caps.ondemand?'ondemand':'transfer';modeLabel.append(mode);dialog.append(modeLabel);
  if(!caps.ondemand)dialog.append(element('p',caps.reason||'This server cannot mount local folders on demand.'));
  const saveLabel=element('label','Save results to');const destination=element('select');for(const [value,label]of [['server','Server workspace (download when ready)'],['laptop','Chosen laptop folder']]){const option=element('option',label);option.value=value;destination.append(option);}saveLabel.append(destination);dialog.append(saveLabel);
  const keepLabel=element('label');const keep=element('input');keep.type='checkbox';keepLabel.append(keep,element('span','Also retain fetched originals on the server'));dialog.append(keepLabel);
  const picker=element('button','Choose laptop folder…');picker.type='button';picker.className='accent';const chosen=element('p','No folder selected');let handle=null;
  picker.onclick=async()=>{try{handle=await window.showDirectoryPicker({id:`cw-${app}`,mode:destination.value==='laptop'?'readwrite':'read'});chosen.textContent=handle.name;start.disabled=false;}catch(error){if(error.name!=='AbortError')chosen.textContent=error.message;}};
  const status=element('p');status.setAttribute('role','status');dialog.append(picker,chosen,status);
  dialog.append(element('p','On-demand access needs this tab to stay connected. Only selected files/ranges are fetched; opening a document may require its complete contents.'));
  const start=element('button','Start this mode');start.className='accent';start.disabled=true;dialog.append(start);
  function changed(){destination.querySelector('option[value=laptop]').disabled=mode.value==='transfer';if(mode.value==='transfer'){destination.value='server';keep.checked=true;keep.disabled=true;}else keep.disabled=false;handle=null;chosen.textContent='Choose the folder for this mode';start.disabled=true;}
  mode.onchange=changed;destination.onchange=()=>{handle=null;chosen.textContent='Choose again to grant the selected access';start.disabled=true;};changed();
  start.onclick=async()=>{
    if(!handle)return;start.disabled=true;picker.disabled=true;mode.disabled=true;destination.disabled=true;keep.disabled=true;
    let share;
    try{
      status.textContent='Connecting selected folder…';
      share=await api('/api/storage/shares','POST',{app,name:handle.name,mode:mode.value==='transfer'?'transfer':'ondemand',fill:mode.value==='hybrid',keep:keep.checked,access:destination.value==='laptop'?'readwrite':'read'});
      const agent=new LocalFolderAgent(share,handle,()=>{
        const progress=agent.progress;status.textContent=progress?`Copying ${progress.done}/${progress.total} files · ${Math.round(progress.bytes/1024/1024)} MB`:(share.online?'Laptop folder connected':'Laptop folder disconnected');onStatus(status.textContent);
      });agents.set(share.id,agent);agent.connect();
      await new Promise((resolve,reject)=>{const deadline=Date.now()+10000;const wait=()=>{if(share.online)resolve();else if(Date.now()>deadline)reject(new Error('Folder connection timed out'));else setTimeout(wait,50);};wait();});
      if(share.mode==='transfer')await agent.transfer();
      await saveHandle({id:share.id,app,handle,mode:mode.value,keep:keep.checked,destination:destination.value}).catch(()=>{});
      await onReady({...share,saveDestination:destination.value,caption:`${handle.name} · ${mode.value==='transfer'?'server copy':'laptop on demand'}`});dialog.close();
    }catch(error){status.textContent=error.message;onStatus(error.message);start.disabled=false;picker.disabled=false;mode.disabled=false;destination.disabled=false;keep.disabled=false;if(share){agents.get(share.id)?.stop();agents.delete(share.id);api(`/api/storage/shares/${share.id}`,'DELETE',{}).catch(()=>{});}}
  };
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}

export async function reconnectLocalFolder(id){
  const db=await database();const saved=await new Promise((resolve,reject)=>{const transaction=db.transaction('folders','readonly');const request=transaction.objectStore('folders').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();
  if(!saved)throw new Error('This browser has no saved handle for that laptop folder');
  const permission=await saved.handle.requestPermission({mode:saved.destination==='laptop'?'readwrite':'read'});if(permission!=='granted')throw new Error('Folder permission was not granted');
  const share=(await api('/api/storage/shares')).find(item=>item.id===id);if(!share)throw new Error('Server restarted. Choose the laptop folder again.');
  const agent=new LocalFolderAgent(share,saved.handle,()=>{});agents.get(id)?.stop();agents.set(id,agent);agent.connect();return share;
}

export async function stopLocalFolder(id){await api(`/api/storage/shares/${id}`,'DELETE',{});agents.get(id)?.stop();agents.delete(id);}
