import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
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
  const sample=await adapter.execute(session.id,{method:'doc.new',params:{name:'Server Edit Test',width:612,height:792,pages:1},requestId:'native-new-0001',expectedVersion:0});
  if(sample.result?.commandId!=='file.new')throw new Error('The native worker did not run upstream file.new');
  if(sample.stateVersion!==1)throw new Error(`Expected state revision 1, received ${sample.stateVersion}`);
  const before=adapter.preview(session.id,new URL(sample.preview,'http://localhost').searchParams.get('v'));
  const edit=await adapter.execute(session.id,{method:'frame.create',params:{rect:[40,50,250,160],content:'text',text:'Server edited story'},requestId:'native-frame-create-0001',expectedVersion:sample.stateVersion});
  if(edit.result?.commandId!=='frame.create'||edit.stateVersion!==2||!edit.document?.dirty)throw new Error('The native worker did not apply frame.create as revision 2');
  const frame=adapter.preview(session.id,new URL(edit.preview,'http://localhost').searchParams.get('v'));
  const beforeSha256=createHash('sha256').update(before).digest('hex'),afterSha256=createHash('sha256').update(frame).digest('hex');
  if(beforeSha256===afterSha256)throw new Error('The server-rendered page did not change after frame.create');
  const report={
    ownedRuntime:status.ownedRuntime,
    createCommandId:sample.result.commandId,
    editCommandId:edit.result.commandId,
    createStateVersion:sample.stateVersion,
    editStateVersion:edit.stateVersion,
    title:sample.document?.title,
    pageCount:sample.document?.pageCount,
    pngBytes:frame.length,
    pngWidth:frame.readUInt32BE(16),
    pngHeight:frame.readUInt32BE(20),
    beforeRenderSha256:beforeSha256,
    afterRenderSha256:afterSha256,
  };
  if(!report.pngWidth||!report.pngHeight||report.pngWidth>1280||report.pngHeight>1280||report.pngBytes>12*1024*1024)throw new Error('Native render exceeded its PNG bounds');
  if(process.env.CW_PAR03_REPORT){const file=path.resolve(process.env.CW_PAR03_REPORT);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify(report));
}finally{
  if(session)await adapter.close(session.id,{discard:true}).catch(()=>{});
  adapter.shutdown();
  await rm(root,{recursive:true,force:true});
  await rm(stateDir,{recursive:true,force:true});
}
