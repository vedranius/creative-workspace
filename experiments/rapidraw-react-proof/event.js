// Native event envelope and unsubscribe semantics for the isolated source UI.
export function listen(event,callback){return globalThis.rapidRawTransport.listen(event,callback);}
