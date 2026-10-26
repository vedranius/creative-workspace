// Bounded format policy, shared recovery lifecycle; no library mutation or discard.
import {serializePresetFile} from './preset-file.js';
import {createRecoverySession} from './export-recovery.js';
export function createPresetRecoverySession(options){
 return createRecoverySession({...options,format:'rrpreset',verifyPresetBytes(bytes){
  let parsed;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('Invalid retained preset JSON');}
  if(parsed?.creator!=='Anonymous'||Object.keys(parsed).sort().join(',')!=='creator,presets'||parsed.presets?.length!==1||parsed.presets[0]?.preset?.presetType!=='tool')throw Error('Only one retained Exposure Tool preset is available');
  const canonical=serializePresetFile(parsed.presets);if(canonical.length!==bytes.length||canonical.some((v,i)=>v!==bytes[i]))throw Error('Retained preset bytes are not canonical');
 }});
}
