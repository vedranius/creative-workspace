const manifest=await fetch('/demo-manifest.json').then(r=>{if(!r.ok)throw Error('Demo manifest unavailable');return r.json();});
const selected=location.pathname.match(/^\/apps\/([a-z]+)\/?$/)?.[1];
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
const link=(text,href)=>{const a=el('a',text);a.href=href;return a;};
if(selected){
 const app=manifest.apps.find(a=>a.id===selected);
 if(!app){location.replace('/');}else{
  document.title=`${app.name} · Creative Workspace demo`;document.body.className='app-view';document.body.replaceChildren();
  const bar=el('header');bar.append(link('← Studio','/'),el('strong',app.name),el('span','BROWSER MODE · Processing uses your computer','mode-label'));
  const source=link('ArtCraft team · Source ↗',`https://github.com/${app.repo}`);source.target='_blank';source.rel='noopener';bar.append(source);document.body.append(bar);
  const consent=el('section',null,'consent');consent.append(el('div','BROWSER PROCESSING PREVIEW','eyebrow'),el('h1',`Try ${app.name}`),el('p','This application runs inside your browser using your computer’s CPU, GPU and memory. Cloudflare serves the app files. No document-upload backend is connected. Save or download your work before leaving; persistence and format support depend on the original application.'));
  if(app.release)consent.append(el('p',`Official ArtCraft release ${app.release}. Browser file and export support depend on the upstream application.`));
  if(app.heldLatest)consent.append(el('p',`${app.heldLatest.tag} update paused: ${app.heldLatest.reason}`));
  const label=el('label');const check=el('input');check.type='checkbox';label.append(check,document.createTextNode('I understand that this demo uses my computer.'));
  const button=el('button','Open original application');button.disabled=true;check.addEventListener('change',()=>button.disabled=!check.checked);
  button.addEventListener('click',async()=>{
   if(!check.checked)return;button.disabled=true;button.textContent='Preparing original application…';
   try{
    if(!('serviceWorker' in navigator)||!('DecompressionStream' in window))throw Error('This demo needs a current browser with Service Worker and gzip DecompressionStream support.');
    const registration=await navigator.serviceWorker.register('/wasm-transport.js',{scope:'/',updateViaCache:'none'});
    const changing=registration.installing||registration.waiting;
    if(changing&&changing.state!=='activated')await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{changing.removeEventListener('statechange',changed);reject(Error('Updated browser transport did not activate. Reload and try again.'));},20000);
     const changed=()=>{if(changing.state==='activated'||changing.state==='redundant'){clearTimeout(timer);changing.removeEventListener('statechange',changed);changing.state==='activated'?resolve():reject(Error('Updated browser transport failed.'));}};
     changing.addEventListener('statechange',changed);changed();
    });
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
     const done=()=>{if(navigator.serviceWorker.controller){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',done);resolve();}};
     const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',done);reject(Error('Browser transport did not activate. Reload and try again.'));},20000);navigator.serviceWorker.addEventListener('controllerchange',done);done();
    });
    const frame=el('iframe');frame.title=`Original ${app.name} interface`;frame.src=`${app.url}?webgl`;frame.allow='fullscreen';consent.remove();document.body.append(frame);
   }catch(error){consent.append(el('p',error.message));button.textContent='Try again';button.disabled=false;}
  });
  consent.append(label,button);document.body.append(consent);
 }
}else{
 document.querySelector('#count').textContent=`${manifest.apps.length} original interfaces · Browser mode`;
 for(const app of manifest.apps){
  const card=el('article',null,'card');card.style.setProperty('--tone',app.color);card.append(el('div',app.symbol,'symbol'),el('span',app.category,'category'),el('h3',app.name),el('p',app.description));
  const launch=link('Try in browser ↗',`/apps/${app.id}/`);launch.className='launch';card.append(launch,el('div','Uses your laptop · Original UI preview','mode'));
  const credits=el('div',null,'credits');const source=link('ArtCraft team · '+app.repo+(app.release?' · '+app.release:''),`https://github.com/${app.repo}`+(app.release?`/releases/tag/${app.release}`:''));source.target='_blank';source.rel='noopener';credits.append(source);card.append(credits);document.querySelector('#apps').append(card);
 }
}
