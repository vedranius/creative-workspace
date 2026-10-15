export const catalog = [
  {id:'rapidraw',name:'RapidRAW',category:'Photography',description:'RAW development and photographic workflows.',repo:'vedranius/rapidraw-web',adapter:'external-service',status:'bridge-available',color:'#c9de8c',symbol:'R'},
  {id:'photocraft',name:'PhotoCraft',category:'Image editing',description:'Layers, masks, retouching and PSD documents.',repo:'storytold/photocraft',adapter:'server-engine',status:'prototype-limited',originalPort:'pending',color:'#a8b9ee',symbol:'P'},
  {id:'vectorcraft',name:'VectorCraft',category:'Illustration',description:'Vector artwork, paths and illustration.',repo:'storytold/vectorcraft',adapter:'server-engine',status:'prototype-limited',originalPort:'pending',color:'#eea893',symbol:'V'},
  {id:'filmcraft',name:'FilmCraft',category:'Video',description:'Editing, timelines, colour and audio.',repo:'storytold/filmcraft',adapter:'server-engine',status:'adapter-required',originalPort:'pending',color:'#c4a8ee',symbol:'F'},
  {id:'lightcraft',name:'LightCraft',category:'Photography',description:'Photo libraries and RAW development.',repo:'storytold/lightcraft',adapter:'server-engine',status:'adapter-required',originalPort:'pending',color:'#ead99c',symbol:'L'},
  {id:'pdfcraft',name:'PdfCraft',category:'Documents',description:'Read, organise and annotate PDF documents.',repo:'storytold/pdfcraft',adapter:'server-engine',status:'prototype-limited',originalPort:'pending',color:'#eda8ad',symbol:'Pd'},
  {id:'effectcraft',name:'EffectCraft',category:'Motion & VFX',description:'Compositions, keyframes and visual effects.',repo:'storytold/effectcraft',adapter:'server-engine',status:'adapter-required',originalPort:'pending',color:'#97d6d2',symbol:'E'},
  {id:'designcraft',name:'DesignCraft',category:'Publishing',description:'Page layout, typography and publications.',repo:'storytold/designcraft',adapter:'server-engine',status:'prototype-limited',originalPort:'pending',color:'#afd5ab',symbol:'D'},
  {id:'figcraft',name:'FigCraft',category:'Interface design',description:'Interface design, components and interactive prototypes.',repo:'storytold/figcraft',adapter:'server-engine',status:'adapter-required',originalPort:'pending',color:'#c7a3e9',symbol:'Fg'},
  {id:'wordcraft',name:'WordCraft',category:'Office',description:'Word processing, document styles and review workflows.',repo:'storytold/wordcraft',adapter:'server-engine',status:'adapter-required',originalPort:'pending',color:'#9ab8ef',symbol:'W'},
  {id:'soundcraft',name:'SoundCraft',category:'Audio',description:'Multitrack recording, audio editing and mixing.',repo:'storytold/soundcraft',adapter:'server-engine',status:'adapter-required',originalPort:'pending',color:'#e4a9cb',symbol:'S'},
  {id:'deckcraft',name:'DeckCraft',category:'Office',description:'Slide presentations, layouts and slide shows.',repo:'storytold/deckcraft',adapter:'server-engine',status:'adapter-required',originalPort:'pending',color:'#efa387',symbol:'Dk'},
  {id:'cadcraft',name:'CADCraft',category:'CAD',description:'Computer-aided design, precision drafting and drawings.',repo:'storytold/cadcraft',adapter:'server-engine',status:'adapter-required',originalPort:'pending',color:'#91cdd9',symbol:'C'},
  {id:'gridcraft',name:'GridCraft',category:'Office',description:'Spreadsheets, formulas, charts and data analysis.',repo:'storytold/gridcraft',adapter:'server-engine',status:'adapter-required',originalPort:'pending',color:'#adc8a3',symbol:'G'}
];
for(const app of catalog){
  app.sourceRepo=app.id==='rapidraw'?'CyberTimon/RapidRAW':app.repo;
  app.creator=app.id==='rapidraw'?'CyberTimon':'ArtCraft team';
  if(app.id==='rapidraw')app.webAdaptation={creator:'vedranius',repo:app.repo};
}
