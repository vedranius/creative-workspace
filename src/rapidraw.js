import http from 'node:http';
import {WebSocket} from 'ws';

export function createRapidRaw({url=process.env.RAPIDRAW_URL||'http://127.0.0.1:8791',auth=process.env.RAPIDRAW_AUTH}={}){
  const target=new URL(url);
  if(target.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw new Error('RAPIDRAW_URL must be a loopback HTTP origin');
  let cached=null,pending=null;
  const authorization=auth?`Basic ${Buffer.from(auth).toString('base64')}`:undefined;
  const rootRoutes=p=>p==='/files'||p.startsWith('/fm/')||p==='/rr/speed'||p.startsWith('/rfs/')||/^\/splash-(light|grey|dark)\.jpg$/.test(p);
  function requestOptions(req,pathname){const headers={...req.headers};if(authorization)headers.authorization=authorization;else delete headers.authorization;delete headers['proxy-authorization'];return {hostname:target.hostname.replace(/^\[|\]$/g,''),port:target.port||80,path:pathname,method:req.method,headers};}
  async function status(){
    if(cached&&Date.now()-cached.at<5000)return cached.value;
    if(pending)return pending;
    pending=new Promise(resolve=>{
      const ws=new WebSocket(`${target.origin.replace('http:','ws:')}/ipc`,{headers:authorization?{Authorization:authorization}:{},maxPayload:4*1024*1024});
      let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);ws.close();cached={at:Date.now(),value};resolve(value);};
      const timer=setTimeout(()=>finish({ready:false,message:'RapidRAW backend is not responding'}),3000);
      ws.on('open',()=>ws.send(JSON.stringify({id:1,cmd:'__cw_runtime_identity',args:{}})));
      ws.on('message',(data,binary)=>{if(binary)return;try{const message=JSON.parse(data);if(message.id===1){if(message.error||message.result?.runtimeId!=='creative-workspace-rapidraw-v1'){finish({ready:false,message:'This is not a Creative Workspace-owned engine'});return;}ws.send(JSON.stringify({id:2,cmd:'load_settings',args:{}}));}else if(message.id===2)finish(message.error?{ready:false,message:String(message.error)}:{ready:true,url:'/apps/rapidraw/',singleSession:true,ownedRuntime:true});}catch{}});
      ws.on('error',()=>finish({ready:false,message:'Install and start the workspace-owned RapidRAW engine to enable the editor'}));
      ws.on('close',()=>finish({ready:false,message:'RapidRAW backend disconnected'}));
    }).finally(()=>{pending=null;});return pending;
  }
  function handles(pathname){return pathname.startsWith('/apps/rapidraw/')||rootRoutes(pathname);}
  function proxy(req,res){
    let pathname=req.url.replace(/^\/apps\/rapidraw/,'');
    if(!pathname.startsWith('/'))pathname=`/${pathname}`;
    const upstream=http.request(requestOptions(req,pathname),reply=>{
      res.removeHeader('Content-Security-Policy');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'");
      for(const [key,value] of Object.entries(reply.headers)){if(value!==undefined&&!['content-length','content-security-policy','set-cookie','transfer-encoding'].includes(key))res.setHeader(key,value);}
      res.statusCode=reply.statusCode||502;
      if((reply.headers['content-type']||'').includes('text/html')){
        let html='';reply.setEncoding('utf8');reply.on('data',chunk=>{html+=chunk;});reply.on('end',()=>{res.end(html.replace(/(src|href)="\/(?!\/)/g,'$1="/apps/rapidraw/'));});
      }else{if(reply.headers['content-length'])res.setHeader('Content-Length',reply.headers['content-length']);reply.pipe(res);}
      reply.on('error',()=>res.destroy());
    });
    upstream.on('error',()=>{if(res.headersSent)res.destroy();else{res.writeHead(502,{'Content-Type':'text/plain'});res.end('RapidRAW service unavailable. Start RapidRAW Web Bridge.');}});
    req.on('aborted',()=>upstream.destroy());res.on('close',()=>upstream.destroy());req.pipe(upstream);
  }
  function upgrade(req,socket,head){
    if(!['/ipc','/rfs'].includes(new URL(req.url,'http://localhost').pathname)){socket.destroy();return;}
    const upstream=http.request(requestOptions(req,req.url));
    upstream.on('upgrade',(reply,peer,payload)=>{
      socket.write(`HTTP/1.1 ${reply.statusCode} ${reply.statusMessage}\r\n${Object.entries(reply.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`);
      if(payload.length)socket.write(payload);if(head.length)peer.write(head);
      peer.pipe(socket);socket.pipe(peer);peer.on('error',()=>socket.destroy());socket.on('error',()=>peer.destroy());socket.on('close',()=>peer.destroy());peer.on('close',()=>socket.destroy());
    });
    upstream.on('response',reply=>{socket.end(`HTTP/1.1 ${reply.statusCode} ${reply.statusMessage}\r\nConnection: close\r\n\r\n`);reply.resume();});
    upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());upstream.end();
  }
  return {status,handles,proxy,upgrade};
}
