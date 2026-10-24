// Original metadata commands/hooks; only the browser persistence backend changes.
import {createMetadataStorage,createMetadataDatabase} from '/engine/metadata-storage.js';
(globalThis as any).rapidRawMetadataFactory=(defaults:any)=>{
 const raw=createMetadataDatabase(),backend=(globalThis as any).metadataQa?.wrap?.(raw)??raw;
 return createMetadataStorage({defaults,backend});
};
await import('./export-main');
export {};
