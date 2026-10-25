// Explicit host fixture for the browser Web Locks contract; never imported by runtime code.
export function createTestLocks(){
 const held=new Set();return {
  held:()=>held.size,
  async request(name,options,callback){
   if(held.has(name))return callback(null);
   held.add(name);try{return await callback({name,mode:'exclusive'});}finally{held.delete(name);}
  },
 };
}
