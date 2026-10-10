const dialogs=new Map();
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const outputURL=(record)=>`/api/storage/recovery/${record.id}/output?${new URLSearchParams({app:record.app})}`;
const sizeLabel=bytes=>bytes===null?'Size unavailable':bytes<1024?`${bytes} B`:bytes<1024**2?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1024**2).toFixed(1)} MB`;
function inventory(value){
  if(!value||!Array.isArray(value.records)||!Number.isSafeInteger(value.invalidManifests)||value.invalidManifests<0||typeof value.truncated!=='boolean')throw new Error('Unexpected recovery response. Update the server and try again.');
  for(const record of value.records){
    if(!/^[a-f0-9]{16}-[a-f0-9]{64}$/.test(record.id)||typeof record.app!=='string'||!record.app||typeof record.folderName!=='string'||typeof record.relativePath!=='string'||!record.relativePath||!['writing','unacknowledged','failed'].includes(record.state)||typeof record.mayBeIncomplete!=='boolean'||typeof record.downloadAvailable!=='boolean'||!Number.isFinite(Date.parse(record.updatedAt))||record.size!==null&&(!Number.isSafeInteger(record.size)||record.size<0)||record.lastError!==undefined&&typeof record.lastError!=='string')throw new Error('Unexpected recovery record. Refresh or check the server.');
  }
  return value;
}
function responseError(response){
  if(response.status===401)return 'Sign in to the server before viewing or downloading recovery copies.';
  if(response.status===403)return 'This recovery copy cannot be accessed. Check the workspace permissions.';
  if(response.status===404)return 'Recovery is unavailable or this record has changed. Refresh the list; an older server may need a restart after updating.';
  if(response.status===400)return 'The server copy is unavailable. Refresh the list or check the server storage.';
  return `Recovery request failed (${response.status}). Try again.`;
}

export function openRecovery({app,apps=[]}={}){
  const key=app||'*';
  if(dialogs.has(key)){dialogs.get(key).focus();return;}
  if(!document.querySelector('link[data-cw-recovery]')){const style=element('link');style.rel='stylesheet';style.href='/storage/recovery.css';style.dataset.cwRecovery='';document.head.append(style);}
  const names=new Map(apps.map(item=>[item.id,item.name]));
  const dialog=element('dialog',undefined,'cw-recovery-dialog');dialog.setAttribute('aria-label',app?`${names.get(app)||app} save recovery`:'Save recovery');dialog.tabIndex=-1;
  const heading=element('div',undefined,'cw-recovery-heading');
  const title=element('div');title.append(element('span','SERVER COPIES / SAVE RECOVERY','cw-recovery-eyebrow'),element('h2','Keep your work within reach.'));
  const close=element('button','×','cw-recovery-close');close.type='button';close.setAttribute('aria-label','Close save recovery');close.onclick=()=>dialog.close();heading.append(title,close);dialog.append(heading);
  dialog.append(element('p','These outputs have no confirmed final laptop save. Your laptop may already contain a copy. Download a separate server copy, then compare it with your original.','cw-recovery-intro'));
  const toolbar=element('div',undefined,'cw-recovery-toolbar');const filter=element('select');filter.setAttribute('aria-label','Recovery application');
  const all=element('option','All applications');all.value='';filter.append(all);
  for(const item of apps){const option=element('option',item.name);option.value=item.id;filter.append(option);}
  if(app){if(!names.has(app)){const option=element('option',app);option.value=app;filter.append(option);}filter.value=app;filter.disabled=true;}
  const refresh=element('button','Refresh');refresh.type='button';toolbar.append(filter,refresh);dialog.append(toolbar);
  const notice=element('p',undefined,'cw-recovery-notice');notice.setAttribute('role','status');
  const list=element('div',undefined,'cw-recovery-list');dialog.append(notice,list);
  const downloadStatus=element('p',undefined,'cw-recovery-download-status');downloadStatus.setAttribute('role','status');dialog.append(downloadStatus);
  dialog.append(element('p','Downloads use a .recovered filename and are managed by your browser. Access errors open separately. Downloading does not clear records, reconnect folders or automatically replace originals.','cw-recovery-footnote'));
  let closed=false,loading=false,checking=false,inventoryController=null,checkController=null;

  function directLink(record){const link=element('a','Download server copy ↗','cw-recovery-direct');link.href=outputURL(record);link.target='_blank';link.rel='noopener';return link;}
  async function checkCopy(record,button){
    if(checking)return;checking=true;button.disabled=true;checkController=new AbortController();
    const cancel=element('button','Cancel check');cancel.type='button';cancel.onclick=()=>checkController?.abort();
    const progress=element('span',`Checking ${record.relativePath} before download…`);downloadStatus.replaceChildren(progress,cancel);
    const timer=setTimeout(()=>checkController?.abort(),30000);let response;
    try{
      response=await fetch(outputURL(record),{cache:'no-store',signal:checkController.signal});
      if(!response.ok)throw new Error(responseError(response));
      if(!response.headers.get('Content-Type')?.startsWith('application/octet-stream')||!response.headers.get('Content-Disposition')?.startsWith('attachment;'))throw new Error('Unexpected download response; no recovery file was saved.');
      // Let the browser stream large files to disk. Do not buffer originals in
      // this tab or force an error response to download as a recovery file.
      await response.body.cancel();
      if(closed)return;
      downloadStatus.textContent=`Server copy available: ${record.relativePath}. Use Download server copy to save it; access is checked again when downloading.`;
    }catch(error){if(!closed)downloadStatus.textContent=error.name==='AbortError'?'Availability check cancelled or timed out. No files were changed.':`Could not check ${record.relativePath}: ${error.message}`;}
    finally{clearTimeout(timer);await response?.body?.cancel().catch(()=>{});checkController=null;checking=false;button.disabled=false;}
  }
  function render(value){
    const warnings=[];if(value.invalidManifests)warnings.push(`${value.invalidManifests} recovery journal(s) could not be read across the server. Check the server before removing any retained copies.`);if(value.truncated)warnings.push('Only part of the recovery inventory is shown. Some records may be outside this list.');
    notice.textContent=warnings.length?warnings.join(' '):`${value.records.length} recovery record${value.records.length===1?'':'s'}.`;
    list.replaceChildren();
    if(!value.records.length){list.append(element('p','No recovery records in this selection. This does not check unsaved documents still open in an editor.','cw-recovery-empty'));return;}
    for(const record of value.records){
      const row=element('article',undefined,'cw-recovery-record');row.append(element('h3',record.relativePath));
      const time=element('time',new Date(record.updatedAt).toLocaleString());time.dateTime=record.updatedAt;
      const meta=element('div',undefined,'cw-recovery-meta');meta.append(element('span',`${names.get(record.app)||record.app} · ${record.folderName}`),time,element('span',sizeLabel(record.size)));row.append(meta);
      const state=record.mayBeIncomplete||record.state==='writing'?'Possibly incomplete — the server write was not confirmed complete':record.state==='failed'?'Laptop save failed — recovery record retained':'Laptop save not confirmed';row.append(element('p',state,record.mayBeIncomplete||record.state==='writing'?'cw-recovery-state incomplete':'cw-recovery-state'));
      if(record.lastError){const detail=element('details');detail.append(element('summary','Save error details'),element('pre',record.lastError));row.append(detail);}
      if(record.downloadAvailable){const actions=element('div',undefined,'cw-recovery-actions');const button=element('button','Check availability','cw-recovery-check');button.type='button';button.onclick=()=>checkCopy(record,button);actions.append(directLink(record),button);row.append(actions);}
      else row.append(element('p','Server copy currently unavailable. Keep this record and check the server storage.','cw-recovery-unavailable'));
      list.append(row);
    }
  }
  async function load(){
    if(loading)return;loading=true;refresh.disabled=true;filter.disabled=true;inventoryController=new AbortController();const timer=setTimeout(()=>inventoryController?.abort(),15000);
    notice.textContent='Checking retained server copies…';list.replaceChildren();if(!checking)downloadStatus.replaceChildren();
    try{const query=filter.value?`?${new URLSearchParams({app:filter.value})}`:'';const response=await fetch(`/api/storage/recovery${query}`,{cache:'no-store',signal:inventoryController.signal});if(!response.ok)throw new Error(responseError(response));const value=inventory(await response.json());if(!closed)render(value);}
    catch(error){if(!closed){notice.textContent=error.name==='AbortError'?'Recovery check timed out. Refresh to try again.':error instanceof SyntaxError?'Unexpected server response. Refresh or check the server version.':error.message;list.replaceChildren(element('p','The recovery list could not be checked. No files were changed.','cw-recovery-empty'));}}
    finally{clearTimeout(timer);loading=false;inventoryController=null;refresh.disabled=false;filter.disabled=!!app;}
  }
  refresh.onclick=load;filter.onchange=load;
  dialog.addEventListener('close',()=>{closed=true;inventoryController?.abort();checkController?.abort();dialogs.delete(key);dialog.remove();},{once:true});
  document.body.append(dialog);dialogs.set(key,dialog);dialog.showModal();load();
}
