// Browser recovery composition using the original shared controls. No export replay.
import React,{useEffect,useRef,useState} from 'react';
import Button from '../components/ui/Button';
import Text from '../components/ui/Text';
export default function RecoveryPanel({recovery,onClose}:{recovery:any;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),mounted=useRef(true);
 const [session]=useState(()=>recovery.createSession());
 const [rows,setRows]=useState<any[]>([]),[busy,setBusy]=useState(true),[prepared,setPrepared]=useState<any>(null),[confirm,setConfirm]=useState<any>(null),[confirmed,setConfirmed]=useState(false),[message,setMessage]=useState('Reading recovery copies…'),[error,setError]=useState('');
 const [retention,setRetention]=useState(recovery.getRetention());
 useEffect(()=>{
  const previousFocus=document.activeElement;
  mounted.current=true;dialog.current?.showModal();
  session.list().then((value:any[])=>{if(mounted.current){setRows(value);setMessage(value.length?'Choose a copy to verify before saving.':'No retained recovery copies.');}},(e:Error)=>{if(mounted.current){setError(e.message);setMessage('Recovery copies could not be read.');}}).finally(()=>{if(mounted.current)setBusy(false);});
  return()=>{mounted.current=false;session.close();if(previousFocus instanceof HTMLElement&&previousFocus.isConnected)previousFocus.focus();};
 },[session]);
 const run=(operation:()=>Promise<void>)=>{
  setBusy(true);setError('');
  // operation starts synchronously in this user gesture, including the native chooser.
  void operation().catch((e:Error)=>{if(mounted.current){setPrepared(null);setConfirm(null);setConfirmed(false);setMessage('Action was not acknowledged. Reopen recovery to check current entries before retrying.');setError(e.message);}}).finally(()=>{if(mounted.current)setBusy(false);});
 };
 return <dialog ref={dialog} aria-label="Preset recovery copies" className="bg-surface text-text-primary rounded-xl p-6 m-auto w-[640px] max-w-[95vw] max-h-[85vh] backdrop:bg-black/60" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <div className="flex flex-col gap-4">
   <Text as="h2" className="text-xl font-semibold">Preset recovery copies</Text>
   <Text>Save a verified preset copy to a new empty file. The retained recovery entry stays available.</Text>
   <div className="flex flex-col gap-3 overflow-y-auto max-h-[40vh]">
    {rows.map((row,index)=><div key={row.id+index} className="border border-border-color rounded p-3 flex flex-wrap items-center justify-between gap-3" aria-label="Recovery entry">
     <div className="min-w-0"><Text className="break-all">{row.name}</Text><Text>{row.recoverable?`${row.state} · ${row.bytes} bytes`:'Unavailable or incomplete'}</Text></div>
     <Button disabled={busy||!row.recoverable} onClick={()=>run(async()=>{setPrepared(null);setConfirm(null);setConfirmed(false);setMessage('Verifying retained preset…');const copy=await session.prepare(row.id);if(mounted.current){setPrepared(copy);setMessage('Verified '+copy.name+'. Choose a new destination.');}})}>Verify copy</Button>
    </div>)}
   </div>
   <label className="flex flex-col gap-1">New copy retention <select aria-label="New recovery copy retention" value={retention} disabled={busy} onChange={event=>{recovery.setRetention(event.target.value);setRetention(event.target.value);}}><option value="until-ack">Until file is saved</option><option value="keep">Keep new recovery copy</option></select></label>
   {prepared&&!prepared.canDiscard&&<Text>Older copies can be saved to a new file. Removal is unavailable for those records.</Text>}
   {prepared?.canDiscard&&!confirm&&<Button disabled={busy} onClick={()=>{setConfirm(prepared);setConfirmed(false);}}>Remove retained copy…</Button>}
   {confirm&&<div role="group" aria-label="Confirm recovery removal" className="border border-border-color rounded p-3 flex flex-col gap-3">
    <Text>Permanently remove the retained preset “{confirm.name}” ({confirm.bytes} bytes)? Existing saved files are unaffected.</Text>
    <label><input type="checkbox" aria-label="Confirm permanent recovery removal" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/> I understand this removes the retained copy.</label>
    <div className="flex flex-wrap gap-3">
     <Button disabled={busy} onClick={()=>{setConfirm(null);setConfirmed(false);}}>Keep retained copy</Button>
     <Button disabled={busy||!confirmed} onClick={()=>run(async()=>{setMessage('Removing selected recovery copy…');const result=await session.discardPrepared(confirm.id);if(mounted.current){setRows(previous=>previous.filter(row=>row.id!==result.id));setPrepared(null);setConfirm(null);setConfirmed(false);setMessage('Recovery copy removed.');try{const remaining=await session.list();if(mounted.current)setRows(remaining);}catch{if(mounted.current)setError('Copy removed. Reopen recovery to refresh the remaining entries.');}}})}>Permanently remove copy</Button>
    </div>
   </div>}
   <Text role="status">{message}</Text>
   {error&&<Text role="alert">{error}</Text>}
   <div className="flex flex-wrap gap-3 justify-end">
    <Button disabled={busy} onClick={onClose}>Close recovery</Button>
    <Button disabled={busy||!prepared||!!confirm} onClick={()=>run(async()=>{const pending=session.savePrepared();setPrepared(null);setMessage('Waiting for destination and file acknowledgement…');const result=await pending;if(mounted.current)setMessage(result.cancelled?'Destination cancelled. Retained copy remains available.':'Copy saved and verified. Retained recovery remains available.');})}>Choose destination…</Button>
   </div>
  </div>
 </dialog>;
}
