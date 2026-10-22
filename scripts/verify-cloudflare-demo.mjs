// Serve only the explicit public output, with the same isolation/CSP as Pages.
import {createServer} from 'node:http';
import {readFile,lstat,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {safePath} from './build-cloudflare-demo.mjs';
const [directory,report]=process.argv.slice(2);
if(!directory||!report)throw Error('Usage: node scripts/verify-cloudflare-demo.mjs PUBLIC_OUTPUT REPORT_DIR');
const root=path.resolve(directory),headers=await readFile(path.join(root,'_headers'),'utf8');
const csp=headers.match(/Content-Security-Policy: ([^\n]+)/)[1];
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.wasm':'application/wasm','.gz':'application/gzip','.svg':'image/svg+xml','.png':'image/png','.otf':'font/otf','.txt':'text/plain'};
const server=createServer(async(req,res)=>{
 try{
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);if(!name||name.endsWith('/'))name+='index.html';
  const file=safePath(root,name);for(let p=file;p!==root;p=path.dirname(p))if((await lstat(p)).isSymbolicLink())throw Error('Symlink');
  const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await mkdir(report,{recursive:true});
try{
 const child=spawn(process.execPath,['scripts/smoke-cloudflare-demo.mjs',`http://127.0.0.1:${server.address().port}`,report],{stdio:'inherit'});
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});if(code!==0)throw Error(`Demo browser check failed (${code})`);
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
