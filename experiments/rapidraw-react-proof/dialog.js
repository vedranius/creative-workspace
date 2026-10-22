// Only single output-file selection is available in this experiment.
export function save(options){return globalThis.rapidRawTransport.pickExport(options);}
export function open(){return Promise.reject('Directory and watermark selection are unavailable in this browser experiment');}
