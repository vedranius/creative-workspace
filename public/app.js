const $=id=>document.getElementById(id);
let apps=[],settings={},category='All tools',selectedApp='',relativePath='',currentView='apps';
const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
async function api(url,method='GET',data){const response=await fetch(url,{method,headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed');return result;}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,5000);}
function githubLink(app){const a=element('a','repo-link','Repository ↗');a.href=`https://github.com/${app.repo}`;a.target='_blank';a.rel='noopener noreferrer';return a;}
function attribution(app){const group=element('div','attribution');const source=element('a','source-link',`${app.creator} / ${app.sourceRepo} ↗`);source.href=`https://github.com/${app.sourceRepo}`;source.target='_blank';source.rel='noopener noreferrer';group.append(source);if(app.webAdaptation){const fork=element('a','source-link',`Web adaptation: ${app.webAdaptation.creator} ↗`);fork.href=`https://github.com/${app.webAdaptation.repo}`;fork.target='_blank';fork.rel='noopener noreferrer';group.append(fork);}return group;}
function showWorkspace(app){selectedApp=app.id;$('dialog-title').textContent=app.name;$('workspace-root').value=app.configuration.workspace||'';$('form-error').textContent='';$('allowed-roots').replaceChildren(...settings.allowedRoots.map(root=>element('code','',root)));$('workspace-dialog').showModal();}
function renderApps(){
  const query=$('search').value.toLowerCase();
  const list=apps.filter(app=>(category==='All tools'||app.category===category)&&`${app.name} ${app.category} ${app.description}`.toLowerCase().includes(query));
  $('app-count').textContent=list.length;
  $('apps').replaceChildren(...list.map(app=>{
    const card=element('article',`app-card ${app.id}`);
    const top=element('div','card-top');top.append(element('div','app-icon',app.symbol),element('span','category-label',app.category));
    const art=element('div','app-art');art.setAttribute('aria-hidden','true');art.append(element('span','art-orbit'),element('span','art-grid'),element('span','art-symbol',app.symbol),element('span','art-index',String(apps.indexOf(app)+1).padStart(2,'0')));
    card.append(art,top,element('h3','',app.name),element('p','description',app.description));
    card.append(attribution(app));
    const state=element('div','adapter-state','Editor not available yet');card.append(state);
    const folder=element('div','workspace-path',app.configuration.workspace||'No workspace assigned');folder.title=folder.textContent;card.append(folder);
    const bottom=element('div','card-bottom');const configure=element('button','secondary',app.configuration.workspace?'Server folder':'Set server folder');configure.onclick=()=>showWorkspace(app);const local=element('button','primary','Import from laptop');local.onclick=()=>showImport(app.id);bottom.append(local,configure);card.append(bottom);return card;
  }));
  if(!list.length)$('apps').append(element('div','empty','No applications match your search.'));
}
function renderFilters(){const categories=['All tools',...new Set(apps.map(app=>app.category))];$('filters').replaceChildren(...categories.map(name=>{const b=element('button',name===category?'filter selected':'filter',name);b.onclick=()=>{category=name;renderFilters();renderApps();};return b;}));}
function renderUpdates(){$('updates').replaceChildren(...apps.map(app=>{const row=element('article','update-row');const info=element('div');info.append(element('h3','',app.name));const u=app.update;let message='Not checked yet';if(u.status==='upstream-release')message=`Latest upstream: ${u.version} · Adapter compatibility not verified`;if(u.status==='no-release')message='No published release found; tag tracking is not implemented yet';if(u.status==='error')message=`Check failed: ${u.message}`;info.append(element('p','',message));if(u.checkedAt)info.append(element('small','',`Checked ${new Date(u.checkedAt).toLocaleString()}`));row.append(info,githubLink(app));if(u.notes){const details=element('details');details.append(element('summary','','Release notes'),element('pre','release-notes',u.notes));info.append(details);}return row;}));}
function renderSettings(){const root=$('settings');root.replaceChildren();for(const [name,value]of [['Server mode','Single user — multi-user sessions are planned'],['Authentication',settings.authentication?'HTTP Basic enabled':'Loopback development access'],['Update checks','Every 24 hours while the service is running'],['Allowed roots',settings.allowedRoots.join('\n')],['Engine installation','Not implemented in this milestone']]){const row=element('div','setting-row');row.append(element('b','',name),element('span','',value));root.append(row);}}
async function loadFiles(){try{const id=$('file-app').value;if(!id){$('files').replaceChildren(element('p','empty','Import files from your laptop or assign an application workspace to get started.'));return;}const result=await api(`/api/files?app=${encodeURIComponent(id)}&path=${encodeURIComponent(relativePath)}`);$('file-path').textContent=`/${relativePath}`;$('parent').disabled=!relativePath;$('files').replaceChildren(...result.entries.map(file=>{const row=element('div','file-row');const name=element(file.directory?'button':'a','file-name',`${file.directory?'▤':'▧'}  ${file.name}`);const child=[relativePath,file.name].filter(Boolean).join('/');if(file.directory)name.onclick=()=>{relativePath=child;loadFiles();};else{name.href=`/api/files/download?app=${encodeURIComponent(id)}&path=${encodeURIComponent(child)}`;name.download=file.name;name.title='Download to this computer';}row.append(name,element('span','',file.directory?'Folder':`${Math.ceil(file.size/1024).toLocaleString()} KB`),element('small','',new Date(file.modified).toLocaleDateString()));return row;}));if(!result.entries.length)$('files').append(element('p','empty','This folder is empty.'));if(result.truncated)$('files').append(element('p','empty','Showing the first 1,000 entries.'));}catch(e){$('files').replaceChildren(element('p','error',e.message));}}
function renderFileApps(){const configured=apps.filter(app=>app.configuration.workspace);const previous=$('file-app').value;$('file-app').replaceChildren(...configured.map(app=>{const option=element('option','',app.name);option.value=app.id;return option;}));if(configured.some(app=>app.id===previous))$('file-app').value=previous;}
async function refresh(){apps=await api('/api/apps');renderApps();renderUpdates();renderFileApps();}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{currentView=button.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===button));for(const view of ['apps','files','updates','settings'])$(`${view}-view`).hidden=view!==currentView;$('view-name').textContent=button.textContent.trim().replace(/^[^A-Za-z]+/,'');if(currentView==='files')loadFiles();});
$('search').oninput=renderApps;$('close-dialog').onclick=()=>$('workspace-dialog').close();
$('workspace-form').onsubmit=async event=>{event.preventDefault();try{await api(`/api/apps/${selectedApp}/workspace`,'PUT',{root:$('workspace-root').value});$('workspace-dialog').close();await refresh();toast('Workspace saved on your server.');}catch(e){$('form-error').textContent=e.message.includes('WORKSPACE_ROOTS')?'This is a server-folder setting. Use a folder inside the allowed roots below, or choose Import from laptop for files on your computer.':e.message;}};
$('file-app').onchange=()=>{relativePath='';loadFiles();};$('parent').onclick=()=>{relativePath=relativePath.split('/').slice(0,-1).join('/');loadFiles();};
$('check-updates').onclick=async()=>{const button=$('check-updates');button.disabled=true;button.textContent='Checking…';try{await api('/api/updates/check','POST',{});toast('Release check started. Results appear as each repository responds.');setTimeout(()=>refresh().catch(e=>toast(e.message)),2000);}catch(e){toast(e.message);}finally{setTimeout(()=>{button.disabled=false;button.textContent='Check GitHub now';},5000);}};
try{settings=await api('/api/settings');await refresh();renderFilters();renderSettings();$('connection').textContent='Server connected';}catch(e){$('connection').textContent='Connection failed';toast(e.message);}
setInterval(()=>{if(currentView==='updates')refresh().catch(()=>{});},5000);

let transfer=null;
function showImport(id){
  if(!transfer){$('import-app').replaceChildren(...apps.map(app=>{const option=element('option','',app.name);option.value=app.id;return option;}));$('import-app').value=id||apps[0].id;$('import-path').value=currentView==='files'&&id===$('file-app').value?relativePath:'';$('upload-results').replaceChildren();$('upload-status').textContent='A server workspace is created automatically if needed.';$('upload-progress').hidden=true;}
  $('upload-limit').textContent=`Up to ${(settings.maxUploadBytes/1024**3).toFixed(1)} GB per file. Existing files are never overwritten.`;
  $('import-dialog').showModal();
}
function sendFile(app,file,target,onProgress){return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();transfer.xhr=xhr;xhr.open('PUT',`/api/files/upload?app=${encodeURIComponent(app)}&path=${encodeURIComponent(target)}`);xhr.setRequestHeader('Content-Type','application/octet-stream');
  xhr.upload.onprogress=event=>onProgress(event.loaded);
  xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{reject(new Error('Unexpected server response'));return;}xhr.status===201?resolve(data):reject(new Error(data.error||'Upload failed'));};
  xhr.onerror=()=>reject(new Error('Connection interrupted; retry this file'));
  xhr.onabort=()=>reject(new Error('Transfer cancelled'));xhr.send(file);
});}
async function importLocal(files){
  if(transfer||!files.length)return;
  const app=$('import-app').value;const destination=$('import-path').value.trim().replace(/\/$/,'');
  transfer={cancelled:false,xhr:null};
  for(const id of ['pick-files','pick-folder','import-app','import-path'])$(id).disabled=true;
  $('cancel-upload').hidden=false;$('upload-progress').hidden=false;$('upload-progress').value=0;$('upload-results').replaceChildren();
  let uploaded=0,failed=0,processedBytes=0;const total=files.reduce((sum,file)=>sum+file.size,0);
  try{
    await api('/api/imports/prepare','POST',{app});
    for(const [index,file] of files.entries()){
      if(transfer.cancelled)break;
      const item=element('li','',file.webkitRelativePath||file.name);$('upload-results').append(item);
      $('upload-status').textContent=`Transferring ${index+1} of ${files.length}: ${file.name}`;
      const target=[destination,file.webkitRelativePath||file.name].filter(Boolean).join('/');
      try{
        if(file.size>settings.maxUploadBytes)throw new Error('File exceeds the server upload limit');
        await sendFile(app,file,target,bytes=>{$('upload-progress').value=total?Math.min(100,(processedBytes+bytes)/total*100):0;});
        item.textContent=`✓ ${target}`;uploaded++;
      }catch(e){item.textContent=`${target}: ${e.message}`;item.className='error';failed++;}
      processedBytes+=file.size;
    }
    $('upload-status').textContent=`${uploaded} imported · ${failed} failed${transfer.cancelled?' · cancelled':''}. Originals stay on your computer.`;
    if(!transfer.cancelled)$('upload-progress').value=100;
    await refresh();if(currentView==='files')await loadFiles();
  }catch(e){$('upload-status').textContent=e.message;}
  finally{transfer=null;for(const id of ['pick-files','pick-folder','import-app','import-path'])$(id).disabled=false;$('cancel-upload').hidden=true;$('local-files').value='';$('local-folder').value='';}
}
$('import-files').onclick=()=>showImport($('file-app').value);
$('close-import').onclick=()=>$('import-dialog').close();
$('pick-files').onclick=()=>$('local-files').click();$('pick-folder').onclick=()=>$('local-folder').click();
$('local-files').onchange=event=>importLocal(Array.from(event.target.files));$('local-folder').onchange=event=>importLocal(Array.from(event.target.files));
$('cancel-upload').onclick=()=>{if(transfer){transfer.cancelled=true;transfer.xhr?.abort();}};
$('drop-zone').ondragover=event=>{event.preventDefault();$('drop-zone').classList.add('dragging');};
$('drop-zone').ondragleave=()=>$('drop-zone').classList.remove('dragging');
$('drop-zone').ondrop=event=>{event.preventDefault();$('drop-zone').classList.remove('dragging');importLocal(Array.from(event.dataTransfer.files));};

$('workspace-import').onclick=()=>{$('workspace-dialog').close();showImport(selectedApp);};
$('default-workspace').onclick=async()=>{try{const result=await api('/api/imports/prepare','POST',{app:selectedApp});$('workspace-root').value=result.workspace;$('form-error').textContent='';await refresh();toast('Server folder ready. Use Import from laptop to choose local files.');}catch(e){$('form-error').textContent=e.message;}};
