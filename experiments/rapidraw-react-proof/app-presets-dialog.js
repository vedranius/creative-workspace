// Preset-only chooser ABI; the host rejects directory/legacy/unbounded input.
export function save(options){return globalThis.rapidRawTransport.pickExport(options);}
export function open(options){return globalThis.rapidRawTransport.pickPresets(options);}
