import {chooseLocalFolder,reconnectLocalFolder,stopLocalFolder,openRecovery} from '/storage/folders.js';
const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(className)item.className=className;return item;};
let sourceShare=JSON.parse(sessionStorage.getItem('cw-photocraft-source')||'null');
let sessionId,stateVersion,documentState=null,sessionState=null,commands=[],currentCommand=null,folder='',tool='brush',busy=false,points=[];
const readMethods=new Set(['state','heartbeat','engine.commands','doc.inspect','doc.render','session.list']);
async function request(url,method='GET',data){const response=await fetch(url,{method,headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error||'Request failed'),{status:response.status,code:value.code});return value;}
function report(error){$('error').textContent=error.message||String(error);$('error').hidden=false;setTimeout(()=>$('error').hidden=true,8000);}
function status(text){$('activity').textContent=text;}
$('save-recovery').onclick=()=>openRecovery({app:'photocraft',apps:[{id:'photocraft',name:'PhotoCraft'}]}).catch(report);
const hasUnsavedDocuments=()=>sessionState?.documents?.some(document=>document.dirty);
const savingToLaptop=()=>sourceShare?.saveDestination==='laptop';
async function rpc(method,params={}){return request(`/api/photocraft/sessions/${sessionId}/rpc`,'POST',{method,params,requestId:crypto.randomUUID(),...(!readMethods.has(method)&&stateVersion!==undefined?{expectedVersion:stateVersion}:{})});}
async function action(method,params={},label='Processing on server…'){
  if(busy)return;busy=true;document.body.classList.add('busy');status(label);
  try{const result=await rpc(method,params);if(result.document!==undefined)applyState(result);status('Ready · processing stays on the server');return result;}
  catch(error){
    if(error.status===409&&(error.code==='STATE_VERSION_CONFLICT'||error.message.startsWith('Document or session changed.'))){
      if(method==='doc.save')$('save-dialog').close();
      try{applyState(await rpc('state'));status('Document changed elsewhere · refreshed. Review it before trying again.');}catch{status('State changed · refresh unavailable');}
    }else status(method==='doc.save'&&savingToLaptop()?'Save not confirmed · check Save recovery':'Operation failed');
    report(error);throw error;
  }
  finally{busy=false;document.body.classList.remove('busy');}
}
function flatten(layers,depth=0){return layers.flatMap(layer=>[{...layer,depth},...flatten(layer.children||[],depth+1)]);}
function applyState(result){
  documentState=result.document;sessionState=result.session;stateVersion=result.stateVersion;
  $('documents').replaceChildren(...(sessionState?.documents||[]).map(doc=>{const option=node('option',`${doc.name}${doc.dirty?' •':''}`);option.value=doc.index;return option;}));$('documents').value=sessionState?.active??'';$('documents').hidden=(sessionState?.documents?.length||0)<2;$('close-document').hidden=!documentState;
  $('empty').hidden=!!documentState;$('image-wrap').hidden=!documentState;
  $('document-name').textContent=documentState?.name||'No document open';
  $('document-meta').textContent=documentState?`${documentState.width} × ${documentState.height} · ${documentState.mode} / ${documentState.depth}`:'';
  const active=result.session?.documents?.find(doc=>doc.index===result.session.active);
  $('dirty').textContent=active?.dirty?'Unsaved changes':'';
  if(active?.path&&/\.(pcraft|psd|psb)$/i.test(active.path))sessionStorage.setItem('cw-photocraft-saved-document',active.path);
  $('undo').disabled=!documentState?.canUndo;$('redo').disabled=!documentState?.canRedo;
  for(const id of ['save','add-layer','duplicate-layer','delete-layer','opacity','blend','brightness','hue','adjustment-layer','resize'])$(id).disabled=!documentState;
  if(result.preview){$('preview').src=result.preview;$('overlay').setAttribute('viewBox',`0 0 ${documentState.width} ${documentState.height}`);}
  const layers=documentState?flatten(documentState.layers):[];
  $('layers').replaceChildren(...layers.map(layer=>{
    const row=node('div',undefined,`layer-row${layer.id===documentState.activeLayer?' active':''}`);
    const eye=node('button',layer.visible?'◉':'○');eye.setAttribute('aria-label',`${layer.visible?'Hide':'Show'} ${layer.name}`);eye.onclick=event=>{event.stopPropagation();execute('layer.setProps',{layer:layer.id,visible:!layer.visible}).catch(()=>{});};
    const label=node('span',`${'↳ '.repeat(layer.depth)}${layer.name}`,'layer-name');row.append(eye,label,node('span',layer.kind,'layer-kind'));
    row.onclick=()=>execute('layer.select',{layer:layer.id,mode:'replace'}).catch(()=>{});return row;
  }));
  if(!layers.length)$('layers').append(node('p','No layers yet'));
  const selected=layers.find(layer=>layer.id===documentState?.activeLayer);$('opacity').value=selected?Math.round(selected.opacity*100):100;$('opacity-label').textContent=`${$('opacity').value}%`;$('blend').value=selected?.blend||'Normal';
  $('history').replaceChildren(...(documentState?.history||[]).slice(-12).map(entry=>node('li',typeof entry==='string'?entry:entry.label||entry.name||JSON.stringify(entry))));
  fitCanvas();
  const selection=documentState?.selectionBounds;
  for(const [key,value]of Object.entries({x:selection?.[0]||0,y:selection?.[1]||0,width:selection?.[2]||0,height:selection?.[3]||0}))$('selection').setAttribute(key,value);
}
async function execute(command,params={}){return action('engine.execute',{command,params,wait:true});}
async function loadFiles(){
  const result=await request(sourceShare?`/api/storage/shares/${sourceShare.id}/files?app=photocraft&path=${encodeURIComponent(folder)}`:`/api/files?app=photocraft&path=${encodeURIComponent(folder)}`);$('folder-path').textContent=`/${folder}`;$('parent').disabled=!folder;
  $('file-list').replaceChildren(...result.entries.filter(file=>file.directory||/\.(png|jpe?g|webp|tiff?|psd|psb|pcraft|svg|pdf|bmp|gif|exr)$/i.test(file.name)).map(file=>{
    const button=node('button',`${file.directory?'▤':'▧'}  ${file.name}`,'file-choice');button.onclick=async()=>{const relative=[folder,file.name].filter(Boolean).join('/');if(file.directory){folder=relative;await loadFiles();}else{$('file-dialog').close();await action('doc.open',{path:relative},'Opening document on server…');}};return button;
  }));
  if(!$('file-list').children.length)$('file-list').append(node('p','No supported documents in this folder. Import one from your laptop.'));
}
function showCommand(command,defaults={}){
  currentCommand=command;const specification=commands.find(item=>item.id===command);
  $('command-title').textContent=specification?.label||command;$('command-schema').textContent=specification?.params||'';
  $('command-fields').replaceChildren();const params=specification?.params||'';
  for(const match of params.matchAll(/"([\w]+)":(-?[\d.]+)\.\.(-?[\d.]+)(?:=(-?[\d.]+))?/g)){
    const label=node('label',match[1].replace(/([A-Z])/g,' $1'));const input=node('input');input.type='number';input.name=match[1];input.min=match[2];input.max=match[3];input.step='any';input.value=defaults[match[1]]??match[4]??0;label.append(input);$('command-fields').append(label);
  }
  for(const match of params.matchAll(/"([\w]+)":bool(?:=(true|false))?/g)){
    const label=node('label',match[1]);const input=node('input');input.type='checkbox';input.name=match[1];input.checked=defaults[match[1]]??match[2]==='true';label.append(input);$('command-fields').append(label);
  }
  for(const [name,value]of Object.entries(defaults)){if($('command-fields').querySelector(`[name="${name}"]`))continue;const label=node('label',name.replace(/([A-Z])/g,' $1'));const input=node('input');input.name=name;input.type=typeof value==='number'?'number':typeof value==='boolean'?'checkbox':'text';if(input.type==='number')input.step='any';if(input.type==='checkbox')input.checked=value;else input.value=value;label.append(input);$('command-fields').append(label);}
  $('command-json').value=JSON.stringify(defaults,null,2);$('command-dialog').showModal();
}
function palette(){const term=$('command-search').value.toLowerCase();const list=commands.filter(command=>`${command.label} ${command.id} ${(command.menu||[]).join(' ')}`.toLowerCase().includes(term));$('command-list').replaceChildren(...list.slice(0,70).map(command=>{const button=node('button');button.append(node('span',command.label),node('small',(command.menu||[]).join(' / ')||command.id));button.disabled=!command.enabled;button.className='command-choice';button.onclick=()=>{$('palette').close();showCommand(command.id);};return button;}));}
async function importFile(file){
  if(!file||busy)return;status('Copying selected laptop file to the server…');
  if(sourceShare){report(new Error('Switch to the server workspace to import a separate file, or open a file from the shared laptop folder.'));return;}
  const relative=`imports/${Date.now()}-${crypto.randomUUID().slice(0,8)}/${file.name}`;
  try{const response=await fetch(`/api/files/upload?app=photocraft&path=${encodeURIComponent(relative)}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file});const value=await response.json();if(!response.ok)throw new Error(value.error);await action('doc.open',{path:relative},'Opening imported document…');}
  catch(error){report(error);status('Import failed');}
}
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
$('new').onclick=()=>$('new-dialog').showModal();$('new-form').onsubmit=async event=>{event.preventDefault();$('new-dialog').close();await action('doc.new',{name:$('new-name').value,width:Number($('new-width').value),height:Number($('new-height').value),mode:'rgb',depth:8,background:$('new-background').value}).catch(()=>{});};
$('open').onclick=async()=>{try{await loadFiles();$('file-dialog').showModal();}catch(error){report(error);}};
$('parent').onclick=async()=>{folder=folder.split('/').slice(0,-1).join('/');await loadFiles();};
$('import').onclick=()=>$('local-file').click();$('empty-import').onclick=()=>$('local-file').click();$('local-file').onchange=event=>{importFile(event.target.files[0]);event.target.value='';};
$('undo').onclick=()=>execute('edit.undo').catch(()=>{});$('redo').onclick=()=>execute('edit.redo').catch(()=>{});
$('add-layer').onclick=()=>execute('layer.new.layer',{name:'New layer'}).catch(()=>{});$('duplicate-layer').onclick=()=>execute('layer.duplicate').catch(()=>{});$('delete-layer').onclick=()=>execute('layer.delete').catch(()=>{});
$('opacity').oninput=()=>$('opacity-label').textContent=`${$('opacity').value}%`;$('opacity').onchange=()=>execute('layer.setProps',{opacity:Number($('opacity').value)/100}).catch(()=>{});$('blend').onchange=()=>execute('layer.setProps',{blend:$('blend').value}).catch(()=>{});
$('invert').onclick=()=>execute('image.adjustments.invert').catch(()=>{});$('deselect').onclick=()=>execute('select.deselect').catch(()=>{});
$('blur').onclick=()=>showCommand('filter.blur.gaussianBlur',{radius:5});$('brightness').onclick=()=>showCommand('image.adjustments.brightnessContrast',{brightness:0,contrast:0});$('hue').onclick=()=>showCommand('image.adjustments.hueSaturation',{hue:0,saturation:0,lightness:0});$('adjustment-layer').onclick=()=>showCommand('layer.newAdjustmentLayer.hueSaturation',{hue:0,saturation:0,lightness:0});$('resize').onclick=()=>showCommand('image.imageSize',{width:documentState?.width,height:documentState?.height});
$('command-form').onsubmit=async event=>{event.preventDefault();try{const params=JSON.parse($('command-json').value||'{}');for(const input of $('command-fields').querySelectorAll('input'))params[input.name]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;$('command-dialog').close();await execute(currentCommand,params);}catch(error){report(error);}};
$('commands').onclick=async()=>{try{commands=(await rpc('engine.commands')).result;palette();$('palette').showModal();}catch(error){report(error);}};$('command-search').oninput=palette;
$('save').onclick=()=>{$('download-output').hidden=true;$('save-path').value=`${(documentState?.name||'Untitled').replace(/\.[^.]+$/,'')}.pcraft`;$('save-format').value='pcraft';$('save-destination').textContent=savingToLaptop()?'Save into your chosen laptop folder. Keep this tab connected until saving finishes.':'Save a layered document or export a flattened copy in this application’s server workspace.';$('save-submit').textContent=savingToLaptop()?'Save to laptop folder':'Save on server';$('save-dialog').showModal();};
$('save-format').onchange=()=>{$('save-path').value=$('save-path').value.replace(/\.[^./]+$/,'')+`.${$('save-format').value}`;};
$('save-form').onsubmit=async event=>{event.preventDefault();const filename=$('save-path').value;const label=savingToLaptop()?'Saving to laptop folder…':'Saving document on server…';try{let result;const params={path:filename,format:$('save-format').value,quality:90};try{result=await action('doc.save',params,label);}catch(error){const existing=error.code==='OUTPUT_EXISTS'||error.message==='This file already exists. Confirm replacement or choose another name.';if(error.status!==409||!existing||!confirm(`Replace ${filename} in the ${savingToLaptop()?'chosen laptop folder':'server workspace'}?`))return;$('error').hidden=true;result=await action('doc.save',{...params,overwrite:true},label);}if(result){$('download-output').href=`/api/photocraft/sessions/${sessionId}/output?path=${encodeURIComponent(filename)}`;$('download-output').textContent=`Download ${filename} ↗`;$('download-output').download=filename;$('download-output').hidden=false;status(savingToLaptop()?'Saved to laptop folder · acknowledged':'Saved on server');}}catch{}};
for(const button of document.querySelectorAll('[data-tool]'))button.onclick=()=>{tool=button.dataset.tool;document.querySelectorAll('[data-tool]').forEach(item=>item.classList.toggle('selected',item===button));};
function position(event){const rect=$('preview').getBoundingClientRect();return [Math.max(0,Math.min(documentState.width-1,(event.clientX-rect.left)/rect.width*documentState.width)),Math.max(0,Math.min(documentState.height-1,(event.clientY-rect.top)/rect.height*documentState.height)),event.pointerType==='mouse'?1:event.pressure||1];}
$('preview').onpointerdown=event=>{if(!documentState||busy||event.button!==0)return;event.preventDefault();points=[position(event)];$('preview').setPointerCapture(event.pointerId);$('stroke').setAttribute('stroke',$('colour').value);$('stroke').setAttribute('stroke-width',$('brush-size').value);};
$('preview').onpointermove=event=>{if(!points.length)return;if(points.length<256)points.push(position(event));if(tool==='brush')$('stroke').setAttribute('points',points.map(point=>point.slice(0,2).join(',')).join(' '));else{const first=points[0],last=points.at(-1);for(const [key,value]of Object.entries({x:Math.min(first[0],last[0]),y:Math.min(first[1],last[1]),width:Math.abs(last[0]-first[0]),height:Math.abs(last[1]-first[1])}))$('selection').setAttribute(key,value);}};
$('preview').onpointerup=async event=>{if(!points.length)return;const stroke=points;stroke.push(position(event));points=[];$('stroke').setAttribute('points','');if(tool==='brush')await execute('paint.stroke',{points:stroke,size:Number($('brush-size').value),color:$('colour').value}).catch(()=>{});else{const first=stroke[0],last=stroke.at(-1);await execute('select.rect',{x:Math.round(Math.min(first[0],last[0])),y:Math.round(Math.min(first[1],last[1])),width:Math.max(1,Math.round(Math.abs(last[0]-first[0]))),height:Math.max(1,Math.round(Math.abs(last[1]-first[1]))),mode:'replace'}).catch(()=>{});}};
$('preview').onpointercancel=()=>{points=[];$('stroke').setAttribute('points','');};
function fitCanvas(){if(!documentState)return;const stage=$('stage'),style=getComputedStyle(stage);const width=stage.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=stage.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);const scale=$('zoom').value==='fit'?Math.min(width/documentState.width,height/documentState.height):Number($('zoom').value)/100;$('image-wrap').style.width=`${Math.max(1,documentState.width*scale)}px`;$('image-wrap').style.height=`${Math.max(1,documentState.height*scale)}px`;$('stage').classList.toggle('fixed-stage',$('zoom').value!=='fit');}
$('zoom').onchange=fitCanvas;new ResizeObserver(fitCanvas).observe($('stage'));
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='k'){event.preventDefault();$('commands').click();}if((event.ctrlKey||event.metaKey)&&event.key==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){event.preventDefault();(event.shiftKey?$('redo'):$('undo')).click();}});
try{
  const stored=sessionStorage.getItem('cw-photocraft-session');
  if(stored){sessionId=stored;try{applyState(await rpc('state'));}catch{sessionId=null;}}
  if(!sessionId){const created=await request('/api/photocraft/sessions','POST',sourceShare?{sourceShareId:sourceShare.id,saveDestination:sourceShare.saveDestination}:{});sessionId=created.id;sessionStorage.setItem('cw-photocraft-session',sessionId);applyState(await rpc('state'));const saved=sessionStorage.getItem('cw-photocraft-saved-document');if(saved&&!sourceShare)try{applyState(await rpc('doc.open',{path:saved}));}catch{}}
  commands=(await rpc('engine.commands')).result;$('session-label').textContent='Separate Rust session · server processing';status('Ready · processing stays on the server');
}catch(error){report(error);status('Engine unavailable');}
window.addEventListener('beforeunload',event=>{if(hasUnsavedDocuments()){event.preventDefault();event.returnValue='';}});

$('documents').onchange=()=>action('doc.select',{index:Number($('documents').value)}).catch(()=>{});
$('close-document').onclick=()=>{if($('dirty').textContent&&!confirm('Close this document and discard its unsaved changes?'))return;action('doc.close').catch(()=>{});};
setInterval(()=>{if(sessionId)rpc('heartbeat').catch(()=>{});},60000);

function showSource(){ $('source-caption').textContent=sourceShare?.caption||'Server workspace';$('reconnect-folder').hidden=!sourceShare;$('server-source').hidden=!sourceShare; }
async function changeSource(next){
  if(busy)throw new Error('Wait for the current operation before changing the file source.');
  if(hasUnsavedDocuments())throw new Error('Save all open documents before changing their file source.');
  const previousShare=sourceShare;
  if(sessionId)await request(`/api/photocraft/sessions/${sessionId}`,'DELETE',{});
  if(previousShare&&previousShare.id!==next?.id)await stopLocalFolder(previousShare.id).catch(()=>{});
  sourceShare=next;folder='';sessionStorage.removeItem('cw-photocraft-saved-document');sessionStorage.setItem('cw-photocraft-source',JSON.stringify(next));
  const created=await request('/api/photocraft/sessions','POST',next?{sourceShareId:next.id,saveDestination:next.saveDestination}:{});sessionId=created.id;sessionStorage.setItem('cw-photocraft-session',sessionId);applyState(await rpc('state'));showSource();commands=(await rpc('engine.commands')).result;status('Source ready. Open a document from this folder.');
}
$('local-folder').onclick=()=>{if(hasUnsavedDocuments()){report(new Error('Save all open documents before changing their file source.'));return;}chooseLocalFolder({app:'photocraft',onReady:changeSource,onStatus:status}).catch(report);};
$('server-source').onclick=()=>changeSource(null).catch(report);
$('reconnect-folder').onclick=()=>reconnectLocalFolder(sourceShare.id).then(()=>status('Laptop folder reconnected')).catch(report);
showSource();
