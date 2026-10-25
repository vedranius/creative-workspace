// Explicit native shell refusal; no fake command/channel or external authority.
export async function open(){
 (globalThis.appRootNativeRefusals??=[]).push('shell.open');
 throw Error('Native shell is unavailable in the browser root');
}
