import {chooseLocalFolder,reconnectLocalFolder,stopLocalFolder,openRecovery} from '/storage/folders.js';
const $=id=>document.getElementById(id),node=(tag,text,className)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(className)item.className=className;return item;};
let sessionId,state=null,version,busy=false,folder='',sourceShare=null;
try{sourceShare=JSON.parse(sessionStorage.getItem('cw-pdfcraft-source')||'null');}catch{}
const clean=()=>!state?.documents?.some(doc=>doc.dirty),laptop=()=>sourceShare?.saveDestination==='laptop';
function status(text){$('status').textContent=text;}
function report(error){$('error').textContent=error.message||String(error);$('error').hidden=false;setTimeout(()=>$('error').hidden=true,9000);}
async function request(url,method='GET',body){const response=await fetch(url,{method,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error||'Request failed'),{status:response.status,code:value.code});return value;}
const rpc=(method,params={})=>request(`/api/pdfcraft/sessions/${sessionId}/rpc`,'POST',{method,params,requestId:crypto.randomUUID(),...(!['state','heartbeat','text.extract'].includes(method)&&version!==undefined?{expectedVersion:version}:{})});
function apply(value){
  state=value;version=value.stateVersion;const info=value.document,doc=info?.document;
  $('empty').hidden=!!doc;$('preview').hidden=!doc;if(value.preview)$('preview').src=value.preview;
  $('name').textContent=doc?.name||'No PDF open';$('dirty').textContent=doc?.dirty?'Unsaved changes':'';$('close-document').hidden=!doc;
  $('documents').replaceChildren(...value.documents.map(item=>{const option=node('option',`${item.name}${item.dirty?' •':''}`);option.value=item.doc;return option;}));$('documents').value=value.active??'';$('documents').hidden=value.documents.length<2;
  const count=info?.pages.length||0;$('page-count').textContent=count;$('page-total').textContent=`/ ${count}`;$('page-number').value=value.page;$('page-number').max=count;
  $('pages').replaceChildren(...(info?.pages||[]).slice(0,200).map(page=>{const button=node('button',`Page ${page.page}`,`page-choice${page.page===value.page?' active':''}`);button.append(node('small',`${page.rotation}°`));button.onclick=()=>action('page.select',{page:page.page}).catch(()=>{});return button;}));
  if(!count)$('pages').append(node('p','Open a document to begin.'));if(count>200)$('pages').append(node('p','First 200 pages shown. Use the page number to reach any page.'));
  for(const id of ['save','note','text','page-number'])$(id).disabled=!doc;
  for(const id of ['rotate-left','rotate-right','delete-page','move-page'])$(id).disabled=!doc?.editable;
  $('undo').disabled=!doc?.undo;$('redo').disabled=!doc?.redo;$('previous').disabled=!doc||value.page<=1;$('next').disabled=!doc||value.page>=count;
  const page=info?.pages[value.page-1];$('dimensions').textContent=page?`${Math.round(page.width)} × ${Math.round(page.height)} pt`:'';
  $('metadata').replaceChildren();for(const [key,text]of [['Pages',count||'—'],['PDF',info?.pdf_version||'—'],['Title',info?.title||'—'],['Author',info?.author||'—'],['Processing','Server'],['Output',laptop()?'Laptop folder':'Server workspace']])$('metadata').append(node('dt',key),node('dd',String(text)));
  $('notes').replaceChildren(...(info?.annotations||[]).filter(note=>note.page===value.page&&note.contents).map(note=>node('div',note.contents,'note')));if(!$('notes').childNodes.length)$('notes').append(node('p','No notes on this page.'));
  zoom();
}
async function action(method,params={},label='Processing PDF on server…'){
  if(busy)return;busy=true;document.body.classList.add('busy');status(label);
  try{const value=await rpc(method,params);if(value.documents)apply(value);status('Ready · PDF processing stays on the server');return value;}
  catch(error){try{apply(await rpc('state'));}catch{}if(error.code==='STATE_VERSION_CONFLICT')$('save-dialog').close();status(method==='doc.save'&&laptop()?'Save not confirmed · check Save recovery':'Operation failed · no automatic retry');report(error);throw error;}
  finally{busy=false;document.body.classList.remove('busy');}
}
async function files(){const data=await request(sourceShare?`/api/storage/shares/${sourceShare.id}/files?app=pdfcraft&path=${encodeURIComponent(folder)}`:`/api/files?app=pdfcraft&path=${encodeURIComponent(folder)}`);$('folder').textContent=`/${folder}`;$('parent').disabled=!folder;$('files').replaceChildren(...data.entries.filter(file=>file.directory||/\.pdf$/i.test(file.name)).map(file=>{const button=node('button',`${file.directory?'▤':'▧'} ${file.name}`,'file-choice');const path=[folder,file.name].filter(Boolean).join('/');button.onclick=async()=>{if(file.directory){folder=path;await files();}else{$('files-dialog').close();await action('doc.open',{path},'Fetching the selected PDF and opening it on server…').catch(()=>{});}};return button;}));if(!$('files').childNodes.length)$('files').append(node('p','No PDF files in this folder.'));}
async function importFile(file){
  if(!file||busy)return;if(!/\.pdf$/i.test(file.name)){report(new Error('Choose a PDF file'));return;}if(!clean()&&sourceShare){report(new Error('Save open PDFs before switching to uploaded files'));return;}
  try{if(sourceShare)await changeSource(null);const path=`imports/${Date.now()}-${crypto.randomUUID().slice(0,8)}/${file.name}`;status('Uploading the selected PDF…');const response=await fetch(`/api/files/upload?app=pdfcraft&path=${encodeURIComponent(path)}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file});const data=await response.json();if(!response.ok)throw new Error(data.error);await action('doc.open',{path},'Opening imported PDF…');}catch(error){report(error);}
}
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
$('new').onclick=()=>$('new-dialog').showModal();$('empty-new').onclick=()=>$('new').click();
$('new-form').onsubmit=event=>{event.preventDefault();$('new-dialog').close();action('doc.new',{name:$('new-name').value,pages:Number($('new-pages').value)}).catch(()=>{});};
$('open').onclick=()=>files().then(()=>$('files-dialog').showModal()).catch(report);$('parent').onclick=()=>{folder=folder.split('/').slice(0,-1).join('/');files().catch(report);};
$('import').onclick=()=>$('local-file').click();$('empty-open').onclick=()=>$('local-file').click();$('local-file').onchange=event=>{importFile(event.target.files[0]);event.target.value='';};
$('undo').onclick=()=>action('edit.undo').catch(()=>{});$('redo').onclick=()=>action('edit.redo').catch(()=>{});
$('rotate-left').onclick=()=>action('page.rotate',{degrees:-90}).catch(()=>{});$('rotate-right').onclick=()=>action('page.rotate',{degrees:90}).catch(()=>{});
$('delete-page').onclick=()=>{if(confirm(`Delete page ${state.page}? You can undo this change.`))action('page.delete').catch(()=>{});};
$('move-page').onclick=()=>{const to=prompt('Move this page to position:',String(state.page));if(to!==null)action('page.move',{to:Number(to)}).catch(()=>{});};
$('note').onclick=()=>{$('note-content').value='';$('note-dialog').showModal();};$('note-form').onsubmit=event=>{event.preventDefault();$('note-dialog').close();action('comment.add',{contents:$('note-content').value}).catch(()=>{});};
$('text').onclick=()=>action('text.extract').then(value=>{if(value){$('extracted-text').textContent=typeof value.result==='string'?value.result:JSON.stringify(value.result,null,2);$('text-dialog').showModal();}}).catch(()=>{});
$('previous').onclick=()=>action('page.select',{page:state.page-1}).catch(()=>{});$('next').onclick=()=>action('page.select',{page:state.page+1}).catch(()=>{});$('page-number').onchange=()=>action('page.select',{page:Number($('page-number').value)}).catch(()=>{});
$('documents').onchange=()=>action('doc.select',{doc:Number($('documents').value)}).catch(()=>{});
$('close-document').onclick=()=>{const discard=state.document.document.dirty;if(discard&&!confirm('Discard unsaved changes to this PDF?'))return;action('doc.close',{discard}).catch(()=>{});};
$('save').onclick=()=>{$('save-path').value=`${(state.document.document.name||'document').replace(/\.pdf$/i,'')}-edited.pdf`;$('download').hidden=true;$('save-result').textContent='';$('save-destination').textContent=laptop()?'Save a new PDF in the chosen laptop folder. Keep this tab connected until the server confirms saving.':'Save a new copy on the server. Existing files are not overwritten.';$('save-submit').textContent=laptop()?'Save to laptop folder':'Save on server';$('save-dialog').showModal();};
$('save-form').onsubmit=async event=>{event.preventDefault();const path=$('save-path').value;try{const value=await action('doc.save',{path},laptop()?'Saving PDF to laptop folder…':'Saving a PDF copy on server…');if(value){$('download').href=`/api/pdfcraft/sessions/${sessionId}/output?path=${encodeURIComponent(path)}`;$('download').hidden=false;$('save-result').textContent=laptop()?'Saved to laptop folder · acknowledged':'Saved on server';}}catch{}};
$('recovery').onclick=()=>openRecovery({app:'pdfcraft',apps:[{id:'pdfcraft',name:'PdfCraft'}]}).catch(report);
function zoom(){const fixed=$('zoom').value!=='fit';$('preview').classList.toggle('fixed',fixed);$('stage').classList.toggle('fixed',fixed);$('preview').style.width=fixed?`${$('preview').naturalWidth*Number($('zoom').value)/100}px`:'';}
$('zoom').onchange=zoom;$('preview').onload=zoom;
function showSource(){$('source').textContent=sourceShare?.caption||'Server workspace';$('reconnect').hidden=!sourceShare;$('server-source').hidden=!sourceShare;}
async function changeSource(next){if(busy||!clean())throw new Error('Save all open PDFs before changing their file source');const old=sourceShare;if(sessionId)await request(`/api/pdfcraft/sessions/${sessionId}`,'DELETE',{});if(old&&old.id!==next?.id)await stopLocalFolder(old.id).catch(()=>{});sourceShare=next;folder='';sessionStorage.setItem('cw-pdfcraft-source',JSON.stringify(next));const created=await request('/api/pdfcraft/sessions','POST',next?{sourceShareId:next.id,saveDestination:next.saveDestination}:{});sessionId=created.id;sessionStorage.setItem('cw-pdfcraft-session',sessionId);apply(await rpc('state'));showSource();status('Source ready. Open a PDF from this folder.');}
$('local-folder').onclick=()=>{if(!clean()){report(new Error('Save all open PDFs before changing their file source'));return;}chooseLocalFolder({app:'pdfcraft',onReady:changeSource,onStatus:status}).catch(report);};$('server-source').onclick=()=>changeSource(null).catch(report);$('reconnect').onclick=()=>reconnectLocalFolder(sourceShare.id).then(()=>status('Laptop folder reconnected')).catch(report);
try{const stored=sessionStorage.getItem('cw-pdfcraft-session');if(stored){sessionId=stored;try{apply(await rpc('state'));}catch{sessionId=null;}}if(!sessionId){const created=await request('/api/pdfcraft/sessions','POST',sourceShare?{sourceShareId:sourceShare.id,saveDestination:sourceShare.saveDestination}:{});sessionId=created.id;sessionStorage.setItem('cw-pdfcraft-session',sessionId);apply(await rpc('state'));}showSource();status('Ready · native PdfCraft engine on server');}catch(error){report(error);status('Engine unavailable');}
window.addEventListener('beforeunload',event=>{if(!clean()){event.preventDefault();event.returnValue='';}});
setInterval(()=>{if(sessionId)rpc('heartbeat').catch(()=>{});},60000);
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){event.preventDefault();(event.shiftKey?$('redo'):$('undo')).click();}});
