// Only the original Tauri invoke import is redirected in this isolated proof.
export function invoke(command,args){return globalThis.rapidRawTransport.invoke(command,args);}
export function convertFileSrc(){throw Error('Native path conversion is unavailable in this browser proof');}
