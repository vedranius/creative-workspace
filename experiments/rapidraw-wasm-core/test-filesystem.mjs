const encoder=new TextEncoder();
export class MemoryFile{
 constructor(name){this.kind='file';this.name=name;this.bytes=new Uint8Array();this.modified=1;this.permission='granted';this.hooks={};this.opens=0;}
 replace(bytes){this.bytes=new Uint8Array(typeof bytes==='string'?encoder.encode(bytes):bytes);this.modified++;}
 async queryPermission(){return this.permission;}
 async getFile(){await this.hooks.get?.();return new File([this.bytes],this.name,{lastModified:this.modified});}
 async createWritable(options){
  this.opens++;await this.hooks.open?.(options);let bytes=new Uint8Array(),aborted=false;
  return {
   write:async value=>{await this.hooks.write?.();bytes=new Uint8Array(typeof value==='string'?encoder.encode(value):value);},
   close:async()=>{await this.hooks.close?.();if(aborted)throw Error('Already aborted');this.replace(bytes);await this.hooks.afterClose?.();},
   abort:async()=>{aborted=true;await this.hooks.abort?.();},
  };
 }
}
export class MemoryDirectory{
 constructor(){this.kind='directory';this.children=new Map();this.failRemove=false;}
 async getDirectoryHandle(name,{create=false}={}){if(!this.children.has(name)&&create)this.children.set(name,new MemoryDirectory());const value=this.children.get(name);if(!value||value.kind!=='directory')throw new DOMException('Directory not found','NotFoundError');return value;}
 async getFileHandle(name,{create=false}={}){if(!this.children.has(name)&&create)this.children.set(name,new MemoryFile(name));const value=this.children.get(name);if(!value||value.kind!=='file')throw Error('File not found');return value;}
 async *entries(){yield* this.children.entries();}
 async removeEntry(id){if(this.failRemove)throw Error('Storage cleanup failed');this.children.delete(id);}
}
