import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createDesignCraft} from '../src/designcraft.js';

const binary=process.env.CW_DESIGNCRAFT_BINARY;
if(!binary)throw new Error('Set CW_DESIGNCRAFT_BINARY to the isolated workspace-owned candidate worker');
const root=await mkdtemp(path.join(os.tmpdir(),'cw-par03-read-'));
const stateDir=await mkdtemp(path.join(os.tmpdir(),'cw-par03-state-'));
const adapter=createDesignCraft({binary,stateDir});
let session;
try{
  const status=await adapter.status();
  if(!status.ready||!status.ownedRuntime)throw new Error('Candidate binary did not pass the workspace runtime identity check');
  session=await adapter.create(root);
  const sample=await adapter.execute(session.id,{method:'doc.sample',requestId:'native-sample-0001',expectedVersion:0});
  if(sample.result?.commandId!=='file.newSample')throw new Error('The native worker did not run upstream file.newSample');
  if(sample.stateVersion!==1)throw new Error(`Expected state revision 1, received ${sample.stateVersion}`);
  const frame=adapter.preview(session.id,new URL(sample.preview,'http://localhost').searchParams.get('v'));
  const report={
    ownedRuntime:status.ownedRuntime,
    commandId:sample.result.commandId,
    stateVersion:sample.stateVersion,
    title:sample.document?.title,
    pageCount:sample.document?.pageCount,
    pngBytes:frame.length,
    pngWidth:frame.readUInt32BE(16),
    pngHeight:frame.readUInt32BE(20),
    pngSha256:createHash('sha256').update(frame).digest('hex'),
  };
  if(!report.pngWidth||!report.pngHeight||report.pngWidth>1280||report.pngHeight>1280||report.pngBytes>12*1024*1024)throw new Error('Native render exceeded its PNG bounds');
  console.log(JSON.stringify(report));
}finally{
  if(session)await adapter.close(session.id,{discard:true}).catch(()=>{});
  adapter.shutdown();
  await rm(root,{recursive:true,force:true});
  await rm(stateDir,{recursive:true,force:true});
}
