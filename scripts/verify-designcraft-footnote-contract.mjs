// Generated-document diagnostic; exact pinned source, isolated test crate, no upstream edits.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {assertOriginalUiSource} from './original-ui-source.mjs';
import {originalUiPatches,originalUiPins} from '../src/original-ui.js';
const [source,output]=process.argv.slice(2);if(!output)throw Error('PINNED_NATIVE_SOURCE NEW_PRIVATE_OUTPUT');
const hash=b=>createHash('sha256').update(b).digest('hex'),root=path.resolve(import.meta.dirname,'..'),out=path.resolve(output);
assert.equal(spawnSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).stdout.trim(),originalUiPins.designcraft);
const patch=await readFile(path.join(root,originalUiPatches.designcraft.path));assert.equal(hash(patch),originalUiPatches.designcraft.sha256);await assertOriginalUiSource(source,patch,'footnote reference input');
await mkdir(out);const probe=path.join(out,'probe');await mkdir(path.join(probe,'src'),{recursive:true});
for(const f of ['main.rs','text_selection.rs'])assert.equal(hash(await readFile(path.join(root,'engines/designcraft/native/src',f))),hash(await readFile(path.join(source,'apps/cw-designcraft-engine/src',f))));
let toml='[package]\nname="cw-designcraft-footnote-reference"\nversion="0.1.0"\nedition="2024"\nlicense="MIT OR Apache-2.0"\n[workspace]\n[dependencies]\n';
for(const [n,p]of Object.entries({'designcraft-mcp':'mcp','designcraft-engine':'engine','designcraft-compose':'compose','designcraft-geom':'geom','designcraft-doc':'doc','designcraft-fonts':'fonts','designcraft-render':'render','designcraft-format':'format'}))toml+=n+'={path='+JSON.stringify(path.join(path.resolve(source),'crates',p))+'}\n';
toml+='serde_json={version="1",features=["float_roundtrip"]}\nzip={version="3",default-features=false,features=["deflate"]}\nimage={version="0.25",default-features=false,features=["png","jpeg","webp","gif","tiff","bmp"]}\n[profile.dev]\nopt-level=1\n[profile.dev.package."*"]\nopt-level=2\n';
await writeFile(path.join(probe,'Cargo.toml'),toml);await cp(path.join(source,'Cargo.lock'),path.join(probe,'Cargo.lock'));await cp(path.join(root,'engines/designcraft/native/src/text_selection.rs'),path.join(probe,'src/text_selection.rs'));
const oracle=String.raw`
#[cfg(test)] mod footnote_contract {
 use super::*;
 #[test] fn original_note_fixture() -> Result<(),Box<dyn std::error::Error>> {
  let output=PathBuf::from(std::env::var("CW_FOOTNOTE_OUTPUT")?);
  let mut h=Headless::new();let mut saved=None;
  h.call("engine.execute",json!({"command":"file.new","params":{"pages":3,"facingPages":true}}))?;
  let px=h.session.active().and_then(|s|s.doc.page(2)).ok_or("No page")?.bounds().x0;
  let created=h.call("engine.execute",json!({"command":"frame.create","params":{"spread":1,"rect":[px+60.0,80.0,px+360.0,320.0],"content":"text","caret":true}}))?;
  h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Body text"}}))?;
  let inserted=h.call("engine.execute",json!({"command":"footnote.insert","params":{"text":"Footnote text"}}))?;
  let st=h.session.active().ok_or("No document")?;let ts=st.selection.text.ok_or("No selection")?;let addr=ts.cell.ok_or("No footnote address")?;let id=addr.footnote_id().ok_or("Not footnote")?;
  assert_eq!(addr.table,u64::MAX);assert_eq!(inserted["id"],json!(id));
  let cs=h.session.cache.get(&st.doc,ts.story,None);let (_,note)=designcraft_compose::find_note(&cs,id).ok_or("No placed note")?;
  assert_eq!(note.text.frames.len(),1);let (_,x,bl,asc,_)=designcraft_compose::note_caret(&cs,id,1).ok_or("No original note caret")?;
  let frame=designcraft_doc::ItemId(created["id"].as_u64().ok_or("No frame")?);let loc=st.doc.find(frame).ok_or("No frame location")?;
  let m=st.doc.parent_xf(&loc)*st.doc.text_xf(st.doc.item(frame).ok_or("No frame item")?);let point=m*designcraft_geom::Point::new(x,bl-asc/2.0);
  let doc=st.doc.clone();let fixture=designcraft_format::save(&doc)?;std::fs::write(output.join("fixture.designcraft"),&fixture)?;
  let selection=serde_json::to_value(&st.selection)?;
  std::fs::write(output.join("selection-native.json"),serde_json::to_vec(&selection)?)?;
  let decoded:designcraft_doc::Selection=serde_json::from_value(selection.clone())?;assert_eq!(decoded.text.ok_or("No decoded selection")?.cell,Some(addr));
  let plain=answer(&mut h,&mut saved,&output,&output,&json!({"method":"render","params":{"page":2}}))?;
  h.call("engine.execute",json!({"command":"text.placeCaret","params":{"frame":frame,"point":[point.x,point.y]}}))?;
  assert_eq!(h.session.active().and_then(|s|s.selection.text).and_then(|t|t.cell),Some(addr));
  h.call("engine.execute",json!({"command":"edit.selectAll","params":{}}))?;
  let range=h.session.active().and_then(|s|s.selection.text).ok_or("No note range")?;assert_eq!(range.range(),0..13);assert_eq!(range.cell,Some(addr));
  let selected=answer(&mut h,&mut saved,&output,&output,&json!({"method":"render","params":{"page":2}}))?;
  // Current adapter omits note geometry; this is diagnostic evidence, not acceptance.
  assert!(plain["caret"].is_null());assert!(selected["textSelection"].is_null());assert_eq!(plain["pngBase64"],selected["pngBase64"]);
  assert!(Arc::ptr_eq(&doc,&h.session.active().ok_or("No doc")?.doc));
  h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Z"}}))?;
  let note_list=h.call("engine.execute",json!({"command":"footnote.list","params":{}}))?;
  assert!(note_list.to_string().contains("Z"));assert!(!note_list.to_string().contains("Footnote text"));
  let edited_doc=h.session.active().ok_or("No edited document")?.doc.clone();let bytes=designcraft_format::save(&edited_doc)?;
  let reopened=designcraft_format::load(&bytes)?;assert_eq!(canonical_snapshot(&reopened)?,canonical_snapshot(&edited_doc)?);
  assert!(canonical_snapshot(&reopened)?.to_string().contains("Body text"));std::fs::write(output.join("saved.designcraft"),bytes)?;
  std::fs::write(output.join("fixture.designcraft.json"),serde_json::to_vec_pretty(&json!({"page":2,"frame":frame,"story":ts.story,"noteId":id,"point":[point.x,point.y],"nativeSentinel":u64::MAX.to_string(),"range":[0,13],"originalNoteCaret":[x,bl,asc],"currentAdapterCaret":plain["caret"],"currentAdapterSelection":selected["textSelection"],"canonicalUnchangedBySelection":true,"nativeTextHitAndEdit":true,"nativeSaveReopenCanonicalExact":true}))?)?;
  Ok(())
 }
 #[test] fn browser_sentinel_is_rejected_by_original_selection_type() -> Result<(),Box<dyn std::error::Error>> {
  let p=PathBuf::from(std::env::var("CW_FOOTNOTE_OUTPUT")?).join("selection-browser.json");let bytes=std::fs::read(p)?;
  let error=serde_json::from_slice::<designcraft_doc::Selection>(&bytes).err().ok_or("Unsafe rounded sentinel accepted")?;
  std::fs::write(PathBuf::from(std::env::var("CW_FOOTNOTE_OUTPUT")?).join("selection-error.txt"),error.to_string())?;Ok(())
 }
}
`;
await writeFile(path.join(probe,'src/main.rs'),await readFile(path.join(root,'engines/designcraft/native/src/main.rs'),'utf8')+oracle);
const run=name=>{const r=spawnSync('cargo',['test','--offline','--manifest-path',path.join(probe,'Cargo.toml'),name,'--','--exact'],{env:{...process.env,CW_FOOTNOTE_OUTPUT:out},encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);return r.stdout+r.stderr;};
await writeFile(path.join(out,'native.log'),run('footnote_contract::original_note_fixture'));
const raw=await readFile(path.join(out,'selection-native.json'),'utf8'),parsed=JSON.parse(raw);assert.ok(raw.includes('18446744073709551615'));assert.equal(Number.isSafeInteger(parsed.text.cell.table),false);
const rounded=JSON.stringify(parsed);assert.ok(rounded.includes('18446744073709552000'));assert.ok(!rounded.includes('18446744073709551615'));await writeFile(path.join(out,'selection-browser.json'),rounded);
await writeFile(path.join(out,'negative.log'),run('footnote_contract::browser_sentinel_is_rejected_by_original_selection_type'));
const report={source:originalUiPins.designcraft,sourcePatchSha256:originalUiPatches.designcraft.sha256,nativeFixture:JSON.parse(await readFile(path.join(out,'fixture.designcraft.json'))),fixtureSha256:hash(await readFile(path.join(out,'fixture.designcraft'))),savedSha256:hash(await readFile(path.join(out,'saved.designcraft'))),wire:{nativeSentinel:'18446744073709551615',browserDecimal:parsed.text.cell.table.toFixed(0),browserJsonDecimal:'18446744073709552000',safeInteger:false,originalSelectionError:await readFile(path.join(out,'selection-error.txt'),'utf8')},status:'diagnosed unsupported footnote wire/caret/range; not adapter acceptance',next:'Explicit safe tagged footnote address codec before JavaScript parsing, reverse hydration to original CellAddr, original note_caret/find_note geometry, exact note/story/frame/page/ACK validators.'};
await assertOriginalUiSource(source,patch,'after footnote reference');await writeFile(path.join(out,'contract.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
