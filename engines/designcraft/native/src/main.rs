// Contributor-original MIT OR Apache-2.0 adapter. No desktop/MCP server.
#![forbid(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::todo)]
mod text_selection;
use designcraft_doc::{Content, Document, Item};
use designcraft_engine::DocState;
use designcraft_mcp::{Backend, Headless};
use serde_json::{Value, json};
use std::io::{self, BufRead, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
const LIMIT: usize = 65536;
const MAX: u64 = 64 * 1024 * 1024;
const MAX_CANONICAL_STATE: usize = 16 * 1024 * 1024;
const COMMANDS: &[&str] = &[
    "frame.create",
    "layout.pages.duplicateSpread",
    "layout.pages.move",
    "layout.pages.insert",
    "layout.pages.delete",
    "selection.set",
    "edit.selectAll",
    "edit.deselectAll",
    "transform.move",
    "transform.resize",
    "object.fill",
    "object.stroke",
    "swatch.create",
    "story.setText",
    "text.placeCaret",
    "text.select",
    "text.insert",
    "footnote.insert",
    "endnote.insert",
    "endnote.options",
    "endnote.edit",
    "endnote.delete",
    "footnote.options",
    "footnote.goToReference",
    "text.delete",
    "type.char",
    "edit.clear",
    "edit.undo",
    "edit.redo",
];
fn bounded_read(root: &Path, p: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let file = std::fs::canonicalize(p)?;
    if !file.starts_with(root) {
        return Err("Input is outside the source root".into());
    }
    let mut bytes = Vec::new();
    std::fs::File::open(file)?.take(MAX + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX {
        return Err("Document exceeds 64 MB".into());
    }
    Ok(bytes)
}
fn zip_budget(bytes: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    if !bytes.starts_with(b"PK") {
        return Ok(());
    }
    let mut z = zip::ZipArchive::new(std::io::Cursor::new(bytes))?;
    if z.len() > 2048 {
        return Err("Too many package entries".into());
    }
    let mut total = 0u64;
    for i in 0..z.len() {
        total = total.checked_add(z.by_index(i)?.size()).ok_or("Package size overflow")?;
        if total > MAX {
            return Err("Expanded document exceeds 64 MB".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn original_cell_range_is_blue_transient_and_page_bound() -> Result<(),Box<dyn std::error::Error>> {
        let mut h=Headless::new();let mut saved=None;let root=std::env::temp_dir();
        h.call("engine.execute",json!({"command":"file.new","params":{"pages":3,"facingPages":true}}))?;
        let page_x=h.session.active().and_then(|s|s.doc.page(2)).ok_or("Missing page")?.bounds().x0;
        let created=h.call("engine.execute",json!({"command":"frame.create","params":{"spread":1,"rect":[page_x+60.0,80.0,page_x+360.0,320.0],"content":"text","caret":true}}))?;
        h.call("engine.execute",json!({"command":"table.insert","params":{"rows":2,"cols":2,"width":280}}))?;
        h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Cell text"}}))?;
        let st=h.session.active().ok_or("No doc")?;let ts=st.selection.text.ok_or("No text")?;let cell=ts.cell.ok_or("No cell")?;
        let cs=h.session.cache.get(&st.doc,ts.story,None);
        let (_,x,bl,asc,_)=designcraft_compose::cell_caret(&cs,cell.table,cell.row,cell.col,1).ok_or("No cell caret")?;
        let frame=designcraft_doc::ItemId(created["id"].as_u64().ok_or("Missing frame")?);
        let loc=st.doc.find(frame).ok_or("No frame")?;let m=st.doc.parent_xf(&loc)*st.doc.text_xf(st.doc.item(frame).ok_or("No item")?);
        let point=m*designcraft_geom::Point::new(x,bl-asc/2.0);let doc=st.doc.clone();
        if let Ok(file)=std::env::var("CW_DESIGNCRAFT_CELL_FIXTURE") {
            let bytes=designcraft_format::save(&doc)?;
            let mut output=std::fs::OpenOptions::new().write(true).create_new(true).open(&file)?;output.write_all(&bytes)?;
            std::fs::write(format!("{file}.json"),serde_json::to_vec(&json!({"page":2,"point":[point.x,point.y],"frame":frame,"story":ts.story,"cell":cell}))?)?;
        }
        let caret=caret_geometry(&h,2).ok_or("Missing original cell caret")?;
        assert_eq!(caret["cell"],serde_json::to_value(cell)?);assert_eq!(caret["frame"],serde_json::to_value(frame)?);
        let (_,cx,cbl,casc,cdesc)=designcraft_compose::cell_caret(&cs,cell.table,cell.row,cell.col,ts.focus).ok_or("No expected cell caret")?;
        let expected=[m*designcraft_geom::Point::new(cx,cbl-casc),m*designcraft_geom::Point::new(cx,cbl+cdesc)];
        for (i,p) in expected.iter().enumerate(){assert!((caret["points"][i][0].as_f64().ok_or("Missing caret x")?-p.x).abs()<1e-8);assert!((caret["points"][i][1].as_f64().ok_or("Missing caret y")?-p.y).abs()<1e-8);}
        assert!(caret_geometry(&h,0).is_none());assert!(caret_geometry(&h,1).is_none());
        let plain=answer(&mut h,&mut saved,&root,&root,&json!({"method":"render","params":{"page":2}}))?;
        h.call("engine.execute",json!({"command":"edit.selectAll","params":{}}))?;
        let selected=answer(&mut h,&mut saved,&root,&root,&json!({"method":"render","params":{"page":2}}))?;
        assert!(caret_geometry(&h,2).is_none());
        assert_eq!(selected["textSelection"]["cell"],serde_json::to_value(cell)?);assert_eq!(selected["textSelection"]["focus"],9);
        let png=image::load_from_memory_with_format(&designcraft_engine::cmd::base64_decode(selected["pngBase64"].as_str().ok_or("No PNG")?),image::ImageFormat::Png)?.to_rgba8();
        assert!(png.pixels().any(|p|p[0]>=178&&p[0]<=182&&p[1]>=203&&p[1]<=207&&p[2]==255));
        assert_eq!(h.call("ui.render",json!({"page":2,"scale":1.0}))?["pngBase64"],plain["pngBase64"]);
        assert!(Arc::ptr_eq(&doc,&h.session.active().ok_or("No doc")?.doc));
        let sibling=answer(&mut h,&mut saved,&root,&root,&json!({"method":"render","params":{"page":1}}))?;assert!(sibling["textSelection"].is_null());
        h.call("engine.execute",json!({"command":"text.placeCaret","params":{"frame":frame,"point":[point.x,point.y]}}))?;
        // First press inside a range preserves it for native drag; blank cell space collapses it.
        h.call("engine.execute",json!({"command":"text.placeCaret","params":{"frame":frame,"point":[point.x+100.0,point.y]}}))?;
        let restored=answer(&mut h,&mut saved,&root,&root,&json!({"method":"render","params":{"page":2}}))?;assert_eq!(restored["pngBase64"],plain["pngBase64"]);
        Ok(())
    }
    #[test]
    fn original_range_inversion_is_transient_and_clipped_to_facing_page() -> Result<(), Box<dyn std::error::Error>> {
        let mut h = Headless::new();let mut saved = None;let root = std::env::temp_dir();
        h.call("engine.execute",json!({"command":"file.new","params":{"pages":3,"facingPages":true}}))?;
        let page_x=h.session.active().and_then(|st|st.doc.page(2)).ok_or("Missing page")?.bounds().x0;
        let created=h.call("engine.execute",json!({"command":"frame.create","params":{"spread":1,"rect":[page_x+40.0,80.0,page_x+300.0,180.0],"content":"text","text":"RAW selection\nSecond line","caret":false}}))?;
        let before=h.call("ui.render",json!({"page":2,"scale":1.0}))?;
        let doc=h.session.active().ok_or("No document")?.doc.clone();
        h.call("engine.execute",json!({"command":"text.select","params":{"story":created["story"],"anchor":0,"focus":25}}))?;
        let selected=answer(&mut h,&mut saved,&root,&root,&json!({"method":"render","params":{"page":2}}))?;
        assert_eq!(selected["textSelection"]["page"],2);
        assert!(selected["textSelection"]["quadCount"].as_u64().ok_or("Missing quads")? >= 2);
        assert!(selected["textSelection"]["bounds"][0].as_u64().ok_or("Missing bounds")? < 100);
        assert_ne!(selected["pngBase64"],before["pngBase64"]);
        assert_eq!(h.call("ui.render",json!({"page":2,"scale":1.0}))?["pngBase64"],before["pngBase64"]);
        assert!(Arc::ptr_eq(&doc,&h.session.active().ok_or("No document")?.doc));
        let sibling=answer(&mut h,&mut saved,&root,&root,&json!({"method":"render","params":{"page":1}}))?;
        assert!(sibling["textSelection"].is_null());
        h.call("engine.execute",json!({"command":"text.select","params":{"story":created["story"],"anchor":0,"focus":0}}))?;
        let restored=answer(&mut h,&mut saved,&root,&root,&json!({"method":"render","params":{"page":2}}))?;
        assert!(restored["textSelection"].is_null());assert_eq!(restored["pngBase64"],before["pngBase64"]);
        Ok(())
    }
    #[test]
    fn caret_is_composed_on_its_selected_facing_page() -> Result<(), Box<dyn std::error::Error>> {
        let mut h = Headless::new();
        h.call("engine.execute", json!({"command":"file.new","params":{"pages":3,"facingPages":true}}))?;
        let page_x = h.session.active().and_then(|st|st.doc.page(2)).ok_or("Missing page")?.bounds().x0;
        let frame = h.call("engine.execute", json!({"command":"frame.create","params":{"spread":1,"rect":[page_x+40.0,80.0,page_x+300.0,180.0],"content":"text","text":"Caret","caret":true}}))?;
        let story = frame.get("story").ok_or("Missing story")?;
        h.call("engine.execute", json!({"command":"text.select","params":{"story":story,"anchor":2,"focus":2}}))?;
        let caret = caret_geometry(&h,2).ok_or("Missing composed caret")?;
        assert_eq!(caret["page"],2);
        let page_x = h.session.active().and_then(|st|st.doc.page(2)).ok_or("Missing page")?.bounds().x0;
        assert!(page_x > 0.0);
        assert!(caret["points"][0][0].as_f64().ok_or("Missing x")? >= page_x+40.0);
        assert!(caret_geometry(&h,0).is_none());
        assert!(caret_geometry(&h,1).is_none());
        h.call("engine.execute",json!({"command":"text.select","params":{"story":story,"anchor":0,"focus":3}}))?;
        assert!(caret_geometry(&h,2).is_none());
        Ok(())
    }
    #[test]
    fn owned_page_move_preserves_identity_and_recovers_after_bad_index() -> Result<(), Box<dyn std::error::Error>> {
        let mut h = Headless::new();
        let mut saved = None;
        let root = std::env::temp_dir();
        answer(&mut h, &mut saved, &root, &root, &json!({"method":"new","params":{"pages":3,"facingPages":false}}))?;
        let ids = |h: &Headless| h.session.active().map(|s| s.doc.pages().map(|(_, _, p)| p.id).collect::<Vec<_>>());
        let before = ids(&h).ok_or("Missing document")?;
        assert!(
            answer(
                &mut h,
                &mut saved,
                &root,
                &root,
                &json!({"method":"command","params":{"command":"layout.pages.move","params":{"from":3,"to":0}}})
            )
            .is_err()
        );
        assert_eq!(ids(&h), Some(before.clone()));
        answer(&mut h, &mut saved, &root, &root, &json!({"method":"command","params":{"command":"layout.pages.move","params":{"from":2,"to":0}}}))?;
        assert_eq!(ids(&h), Some(vec![before[2], before[0], before[1]]));
        answer(&mut h, &mut saved, &root, &root, &json!({"method":"command","params":{"command":"layout.pages.move","params":{"from":0,"to":2}}}))?;
        assert_eq!(ids(&h), Some(before));
        Ok(())
    }
    #[test]
    fn canonical_document_snapshot_round_trips() -> Result<(), Box<dyn std::error::Error>> {
        let doc = Document::new(&designcraft_doc::build::NewDocument::default());
        let snapshot = canonical_snapshot(&doc)?;
        let restored: Document = serde_json::from_value(snapshot)?;
        assert_eq!(restored, doc);
        Ok(())
    }
    #[test]
    fn compressed_package_cannot_expand_past_the_document_budget() -> Result<(), Box<dyn std::error::Error>> {
        let mut writer = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        writer.start_file("document.json", zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated))?;
        let zeros = vec![0; 1024 * 1024];
        for _ in 0..65 {
            writer.write_all(&zeros)?;
        }
        let package = writer.finish()?.into_inner();
        assert!(package.len() < 1024 * 1024);
        assert!(zip_budget(&package).is_err());
        Ok(())
    }
    #[test]
    fn an_external_input_cannot_be_read_through_the_native_entrypoint() -> Result<(), Box<dyn std::error::Error>> {
        let root = std::env::temp_dir().join(format!("cw-layout-roots-{}", std::process::id()));
        std::fs::create_dir_all(root.join("read"))?;
        std::fs::write(root.join("private.designcraft"), b"private")?;
        let result = bounded_read(&std::fs::canonicalize(root.join("read"))?, &root.join("private.designcraft").to_string_lossy());
        std::fs::remove_dir_all(&root)?;
        assert!(result.is_err());
        Ok(())
    }
}
fn items_budget(items: &[Arc<Item>], depth: usize, count: &mut usize) -> Result<(), String> {
    if depth > 16 {
        return Err("Document groups exceed 16 levels".into());
    }
    for item in items {
        *count += 1;
        if *count > 5000 {
            return Err("Document exceeds 5,000 items".into());
        }
        if let Content::Group { items } = &item.content {
            items_budget(items, depth + 1, count)?
        }
    }
    Ok(())
}
// Bound the new original command before its Session edit can mutate the document.
fn footnote_insert_budget(h: &Headless, p: &Value) -> Result<(), Box<dyn std::error::Error>> {
    let params=p.as_object().ok_or("footnote.insert requires an object")?;
    if params.keys().any(|k| k!="text") || params.get("text").is_some_and(|v| !v.is_string() || v.as_str().is_some_and(|t| t.len()>4096)) {
        return Err("footnote.insert accepts only optional text up to 4 KiB".into());
    }
    let st=h.session.active().ok_or("No document")?;
    let ts=st.selection.text.ok_or("footnote.insert requires a body insertion point")?;
    if ts.cell.is_some() { return Err("Footnotes cannot be inserted in cells or notes".into()); }
    let story=st.doc.story(ts.story).ok_or("Unknown story")?;
    if story.notes.len()>=1024 || story.notes.iter().any(|n| n.id>=u32::MAX as u64) {
        return Err("Footnote insertion exceeds the note count or wasm32 ID budget".into());
    }
    let r=ts.range();
    if story.len().saturating_sub(r.end.min(story.len()).saturating_sub(r.start.min(story.len())))+3>1024*1024 {
        return Err("Footnote reference would exceed the 1 MiB story limit".into());
    }
    budget(&st.doc)?;
    // This pure source command can duplicate document styles into note text. Run
    // the original command on an isolated COW document, then validate its exact
    // result before changing the real Session or its undo history.
    let mut candidate=designcraft_engine::Session::new();
    let mut state=DocState::new((*st.doc).clone(),None);state.selection=st.selection.clone();candidate.add_document(state);
    candidate.execute("footnote.insert",p)?;
    let doc=&candidate.active().ok_or("No candidate document")?.doc;
    budget(doc)?;canonical_snapshot(doc)?;Ok(())
}
// Original endnote listing is regenerated into its own story after edits.
fn endnote_content_budget(d:&Document,extra:Option<&str>)->Result<(),Box<dyn std::error::Error>> {
 let count=d.stories.values().map(|s|s.endnotes.len()).sum::<usize>()+usize::from(extra.is_some());
 if count>1024 || (d.endnote_options.start_at as u64).checked_add(count as u64).is_none_or(|n|n>u32::MAX as u64) {return Err("Endnotes exceed the count or numbering budget".into());}
 let o=&d.endnote_options;
 if [&o.prefix,&o.suffix,&o.heading,&o.heading_style,&o.para_style,&o.separator].iter().any(|v|v.len()>4096) {return Err("Endnote formatting exceeds 4 KiB per field".into());}
 if d.stories.values().any(|s|s.endnotes.iter().any(|n|n.id==0||n.id>u32::MAX as u64)) {return Err("Endnote ID exceeds the canonical JSON budget".into());}
 let mut bytes=o.heading.len();let mut number=o.start_at as u64;
 for text in d.stories.values().flat_map(|s|s.endnotes.iter().map(|n|n.text.text.as_str())).chain(extra) {
  bytes=bytes.saturating_add(o.label(number as u32).len()).saturating_add(o.separator.len()+1).saturating_add(text.len());number+=1;
  if bytes>1024*1024 {return Err("Composed endnote text exceeds 1 MiB".into());}
 }
 Ok(())
}
// Execute the registered source query on an isolated COW Session. The owned
// live document, saved pointer, selection and history never enter this Session.
fn endnote_list(h:&Headless,p:&Value)->Result<Value,Box<dyn std::error::Error>> {
 let o=p.as_object().ok_or("Invalid bounded endnote.list query")?;
 if o.len()!=2||o.get("command").and_then(Value::as_str)!=Some("endnote.list")||!o.get("params").and_then(Value::as_object).is_some_and(|p|p.is_empty()) {return Err("endnote.list requires only command and empty params".into());}
 let st=h.session.active().ok_or("Open a publication first")?;let d=&st.doc;
 budget(d)?;endnote_content_budget(d,None)?;canonical_snapshot(d)?;
 let count=d.stories.values().map(|s|s.endnotes.len()).sum::<usize>();
 let bytes=d.stories.values().flat_map(|s|&s.endnotes).map(|n|n.text.text.len()).sum::<usize>();
 if count>128||bytes>32768 {return Err("Endnote query exceeds 128 records or 32 KiB text".into());}
 let mut candidate=designcraft_engine::Session::new();candidate.add_document(DocState::new((**d).clone(),None));
 let result=candidate.execute("endnote.list",&json!({}))?;
 if serde_json::to_vec(&result)?.len()>65536 {return Err("Endnote query exceeds 64 KiB JSON".into());}
 Ok(result)
}
#[cfg(test)] mod endnote_list_contract {
 use super::*;
 fn fixture()->Result<Headless,Box<dyn std::error::Error>> {
  let mut h=Headless::new();h.call("engine.execute",json!({"command":"file.new","params":{"pages":2,"facingPages":false}}))?;
  // Create page2's story first, so numbering order differs from story ID order.
  for (page,text) in [(1,"Second page č"),(0,"First page Ω")] {
   let doc=&h.session.active().ok_or("doc")?.doc;let(si,_)=doc.page_loc(page).ok_or("page")?;let px=doc.page(page).ok_or("page")?.bounds().x0;
   h.call("engine.execute",json!({"command":"frame.create","params":{"spread":si,"rect":[px+60.0,80.0,px+360.0,320.0],"content":"text","caret":true}}))?;
   h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Body text"}}))?;
   h.call("engine.execute",json!({"command":"endnote.insert","params":{"text":text}}))?;
  }
  Ok(h)
 }
 #[test]fn original_query_numbering_and_targets_are_exact_without_live_mutation()->Result<(),Box<dyn std::error::Error>> {
  let mut h=fixture()?;let mut saved=Some(h.session.active().ok_or("doc")?.doc.clone());let before=answer(&mut h,&mut saved,Path::new("."),Path::new("."),&json!({"method":"state"}))?;
  let live=h.session.active().ok_or("doc")?.doc.clone();let expected=h.call("engine.execute",json!({"command":"endnote.list","params":{}}))?;
  assert_eq!(expected[0]["text"],"First page Ω");assert_eq!(expected[1]["text"],"Second page č");
  let request=json!({"method":"query","params":{"command":"endnote.list","params":{}}});
  for _ in 0..3 {assert_eq!(answer(&mut h,&mut saved,Path::new("."),Path::new("."),&request)?,expected);}
  assert!(Arc::ptr_eq(&live,&h.session.active().ok_or("doc")?.doc));assert!(Arc::ptr_eq(&live,saved.as_ref().ok_or("saved")?));
  let after=answer(&mut h,&mut saved,Path::new("."),Path::new("."),&json!({"method":"state"}))?;assert_eq!(before,after);
  if let Ok(out)=std::env::var("CW_ENDNOTE_LIST_OUTPUT") {let root=Path::new(&out);std::fs::write(root.join("endnote-list-fixture.designcraft"),designcraft_format::save(&live)?)?;std::fs::write(root.join("endnote-list-native.json"),serde_json::to_vec_pretty(&json!({"commandId":"endnote.list","notes":expected,"originalQueryExact":true,"numberingUsesPageOrderNotStoryId":true,"repeatedQueriesPreserveCanonicalSelectionDirtyHistory":true,"savedPointerPreserved":true,"canonical":canonical_snapshot(&live)?}))?)?;}
  Ok(())
 }
 #[test]fn empty_no_document_and_malformed_queries_are_bounded()->Result<(),Box<dyn std::error::Error>> {
  let mut h=Headless::new();let good=json!({"command":"endnote.list","params":{}});assert!(endnote_list(&h,&good).is_err());h.call("engine.execute",json!({"command":"file.new","params":{}}))?;assert_eq!(endnote_list(&h,&good)?,json!([]));
  for p in [Value::Null,json!([]),json!({}),json!({"command":"endnote.list","params":null}),json!({"command":"endnote.list","params":{"path":"private"}}),json!({"command":"endnote.list","params":{},"path":"private"}),json!({"command":"endnote.delete","params":{}})]{assert!(endnote_list(&h,&p).is_err());}
  Ok(())
 }
 #[test]fn count_text_and_encoded_json_limits_refuse_without_live_mutation()->Result<(),Box<dyn std::error::Error>> {
  for mode in [0,1,2] {
   let mut h=fixture()?;let doc=Arc::make_mut(&mut h.session.active_mut().ok_or("doc")?.doc);let sid=doc.stories.values().find(|s|!s.endnotes.is_empty()).ok_or("story")?.id;let story=doc.story_mut(sid).ok_or("story")?;
   if mode==0 {let note=story.endnotes[0].clone();story.endnotes=(1..130).map(|id|{let mut n=note.clone();Arc::make_mut(&mut n).id=id;n}).collect();}
   else {Arc::make_mut(&mut story.endnotes[0]).text.text=if mode==1 {"x".repeat(32769)}else{"\u{0000}".repeat(12000)};}
   let live=h.session.active().ok_or("doc")?.doc.clone();assert!(endnote_list(&h,&json!({"command":"endnote.list","params":{}})).is_err());assert!(Arc::ptr_eq(&live,&h.session.active().ok_or("doc")?.doc));
  }
  Ok(())
 }
}
fn endnote_insert_budget(h:&Headless,p:&Value)->Result<(),Box<dyn std::error::Error>> {
 let params=p.as_object().ok_or("endnote.insert requires an object")?;
 if params.keys().any(|k|k!="text")||params.get("text").is_some_and(|v|!v.is_string()||v.as_str().is_some_and(|s|s.len()>4096)) {return Err("endnote.insert accepts only optional text up to 4 KiB".into());}
 let st=h.session.active().ok_or("No document")?;let ts=st.selection.text.ok_or("endnote.insert requires a body insertion point")?;
 if ts.cell.is_some()||st.doc.endnote_story==Some(ts.story) {return Err("Endnotes require body text, not cells, notes or the endnote listing".into());}
 let story=st.doc.story(ts.story).ok_or("Unknown endnote story")?;
 if story.endnotes.iter().any(|n|n.id>=u32::MAX as u64)||story.len().saturating_add(designcraft_doc::ENDNOTE_REF.len_utf8())>1024*1024 {return Err("Endnote insertion exceeds the story or ID budget".into());}
 if st.doc.endnote_story.is_none()&&st.doc.page_count()>=64 {return Err("The first endnote would exceed the 64-page limit".into());}
 budget(&st.doc)?;endnote_content_budget(&st.doc,Some(params.get("text").and_then(Value::as_str).unwrap_or("")))?;
 let mut candidate=designcraft_engine::Session::new();let mut state=DocState::new((*st.doc).clone(),None);state.selection=st.selection.clone();candidate.add_document(state);
 candidate.execute("endnote.insert",p)?;let doc=&candidate.active().ok_or("No endnote candidate")?.doc;budget(doc)?;canonical_snapshot(doc)?;Ok(())
}
// Resolve the original target and bound the proposed listing before Session::edit.
// Only an isolated COW candidate runs the original command during validation.
fn endnote_edit_budget(h:&Headless,p:&Value)->Result<(),Box<dyn std::error::Error>> {
 let bad="Invalid bounded endnote.edit parameters";
 let o=p.as_object().ok_or(bad)?;
 if o.keys().any(|k|!matches!(k.as_str(),"story"|"id"|"text")) {return Err(bad.into());}
 let sid=o.get("story").and_then(Value::as_u64).filter(|n|*n>0&&*n<=u32::MAX as u64).ok_or(bad)?;
 let id=o.get("id").and_then(Value::as_u64).filter(|n|*n>0&&*n<=u32::MAX as u64).ok_or(bad)?;
 let text=match o.get("text"){None=>"",Some(v)=>v.as_str().filter(|t|t.len()<=4096).ok_or(bad)?};
 let st=h.session.active().ok_or("No document")?;budget(&st.doc)?;
 let mut proposed=(*st.doc).clone();
 let note=proposed.story_mut(designcraft_doc::StoryId(sid)).and_then(|s|s.endnote_mut(id)).ok_or("Unknown endnote target")?;
 note.text.text=text.to_owned();endnote_content_budget(&proposed,None)?;
 let mut candidate=designcraft_engine::Session::new();let mut state=DocState::new((*st.doc).clone(),None);state.selection=st.selection.clone();candidate.add_document(state);
 candidate.execute("endnote.edit",p)?;let doc=&candidate.active().ok_or("No endnote edit candidate")?.doc;
 budget(doc)?;canonical_snapshot(doc)?;Ok(())
}
// Resolve both the note and its original body-reference ordinal before real edit.
fn endnote_delete_budget(h:&Headless,p:&Value)->Result<(),Box<dyn std::error::Error>> {
 let bad="Invalid bounded endnote.delete parameters";let o=p.as_object().ok_or(bad)?;
 if o.keys().any(|k|!matches!(k.as_str(),"story"|"id")){return Err(bad.into());}
 let sid=o.get("story").and_then(Value::as_u64).filter(|n|*n>0&&*n<=u32::MAX as u64).ok_or(bad)?;
 let id=o.get("id").and_then(Value::as_u64).filter(|n|*n>0&&*n<=u32::MAX as u64).ok_or(bad)?;
 let st=h.session.active().ok_or("No document")?;budget(&st.doc)?;endnote_content_budget(&st.doc,None)?;
 let story=st.doc.story(designcraft_doc::StoryId(sid)).ok_or("Unknown endnote target")?;
 let ordinal=story.endnotes.iter().position(|n|n.id==id).ok_or("Unknown endnote target")?;
 if story.text.match_indices(designcraft_doc::ENDNOTE_REF).nth(ordinal).is_none(){return Err("Endnote target has no body reference".into());}
 let mut candidate=designcraft_engine::Session::new();let mut state=DocState::new((*st.doc).clone(),None);state.selection=st.selection.clone();candidate.add_document(state);
 candidate.execute("endnote.delete",p)?;let doc=&candidate.active().ok_or("No endnote delete candidate")?.doc;
 budget(doc)?;endnote_content_budget(doc,None)?;canonical_snapshot(doc)?;Ok(())
}
// Preflight merged native EndnoteOptions BEFORE original edit regenerates the
// listing: its final increment and aggregate generated text must remain bounded.
fn endnote_options_budget(h:&Headless,p:&Value)->Result<(),Box<dyn std::error::Error>> {
 let bad="Invalid bounded endnote.options parameters";
 let object=p.as_object().ok_or(bad)?;
 if serde_json::to_vec(p)?.len()>4096 {return Err(bad.into());}
 for (k,v) in object {
  let allowed=match k.as_str(){
   "style"=>v.is_string(), // exact native NumberStyle serde below
   "startAt"=>v.as_u64().is_some_and(|n|n<=u32::MAX as u64),
   "prefix"|"suffix"|"heading"|"headingStyle"|"paraStyle"|"separator"=>v.as_str().is_some_and(|s|s.len()<=256),
   _=>false,
  };if !allowed {return Err(bad.into());}
 }
 let st=h.session.active().ok_or("No document")?;
 let mut merged=serde_json::to_value(&st.doc.endnote_options)?;
 for(k,v)in object {merged[k]=v.clone();}
 let mut proposed=(*st.doc).clone();proposed.endnote_options=serde_json::from_value(merged)?;
 endnote_content_budget(&proposed,None)?;
 let mut candidate=designcraft_engine::Session::new();let mut state=DocState::new((*st.doc).clone(),None);state.selection=st.selection.clone();candidate.add_document(state);
 candidate.execute("endnote.options",p)?;let doc=&candidate.active().ok_or("No endnote options candidate")?.doc;
 budget(doc)?;canonical_snapshot(doc)?;Ok(())
}
// Original composition increments once even after the final reference. Keep
// document-wide numbering and that increment inside u32 before original layout.
fn footnote_number_budget(d:&Document,start:u64)->Result<(),Box<dyn std::error::Error>> {
    let steps=d.stories.values().try_fold(0u64,|total,s| total.checked_add(s.notes.len().max(s.text.matches(designcraft_doc::FOOTNOTE_REF).count()) as u64)).ok_or("Footnote count overflow")?;
    if start.checked_add(steps).is_none_or(|n|n>u32::MAX as u64) {return Err("Footnote numbering exceeds the native u32 composition budget".into());}
    Ok(())
}
// Validate an exact isolated original-command result before touching real history.
fn footnote_options_budget(h: &Headless, p: &Value) -> Result<(), Box<dyn std::error::Error>> {
    fn fields(p:&Value, rule:bool)->Result<(),Box<dyn std::error::Error>> {
        let bad="Invalid bounded footnote.options parameters";
        let object=p.as_object().ok_or(bad)?;
        for (k,v) in object {
            let key=k.as_str();
            let allowed=if rule { match key {
                "on"=>v.is_boolean(), "color"=>v.as_str().is_some_and(|s|s.len()<=256),
                "weight"|"width"=>v.as_f64().is_some_and(|n|n.is_finite()&&(0.0..=10000.0).contains(&n)),
                "offset"|"leftIndent"=>v.as_f64().is_some_and(|n|n.is_finite()&&n.abs()<=10000.0),
                "tint"=>v.as_f64().is_some_and(|n|n.is_finite()&&(0.0..=1.0).contains(&n)), _=>false,
            }} else {match key {
                "style"|"restart"|"affixIn"|"refPosition"|"firstBaseline"=>v.is_string(), // exact enums checked by original serde on candidate
                "prefix"|"suffix"|"separator"|"refCharStyle"|"paraStyle"=>v.as_str().is_some_and(|s|s.len()<=256),
                "startAt"=>v.as_u64().is_some_and(|n|n<=u32::MAX as u64),
                "spaceBefore"|"spaceBetween"|"firstBaselineMin"=>v.as_f64().is_some_and(|n|n.is_finite()&&(0.0..=10000.0).contains(&n)),
                "spanColumns"=>v.is_boolean(), "rule"=>{fields(v,true)?;true},_=>false,
            }};
            if !allowed{return Err(bad.into());}
        } Ok(())
    }
    if serde_json::to_vec(p)?.len()>4096 {return Err("Footnote options exceed 4 KiB".into());}
    fields(p,false)?;
    let st=h.session.active().ok_or("No document")?;
    footnote_number_budget(&st.doc,p.get("startAt").and_then(Value::as_u64).unwrap_or(st.doc.footnote_options.start_at as u64))?;
    let mut candidate=designcraft_engine::Session::new();
    let mut state=DocState::new((*st.doc).clone(),None);state.selection=st.selection.clone();candidate.add_document(state);
    candidate.execute("footnote.options",p)?;
    let doc=&candidate.active().ok_or("No candidate document")?.doc;
    budget(doc)?;canonical_snapshot(doc)?;Ok(())
}
fn budget(d: &Document) -> Result<(), Box<dyn std::error::Error>> {
    footnote_number_budget(d,d.footnote_options.start_at as u64)?;
    endnote_content_budget(d,None)?;
    if d.stories.values().any(|s| s.notes.iter().any(|n| n.id == 0 || n.id > u32::MAX as u64)) {
        return Err("Footnote ID exceeds the canonical JSON / wasm32 address budget".into());
    }
    if d.page_count() == 0 || d.page_count() > 64 {
        return Err("Choose 1–64 pages".into());
    }
    for (_, _, p) in d.pages() {
        if !p.width.is_finite() || !p.height.is_finite() || !(1.0..=10000.0).contains(&p.width) || !(1.0..=10000.0).contains(&p.height) {
            return Err("Page size exceeds the prototype limit".into());
        }
    }
    let mut count = 0;
    for sp in d.spreads.iter().chain(d.parents.iter()) {
        items_budget(&sp.items, 0, &mut count)?;
    }
    if d.stories.values().map(|s| s.text.len()).sum::<usize>() > 1024 * 1024 {
        return Err("Story text exceeds 1 MB".into());
    }
    for a in d.assets.values() {
        if a.data.is_empty() {
            return Err("Linked assets need embedded bytes; external link loading is not supported".into());
        }
        let reader = image::ImageReader::new(std::io::Cursor::new(&*a.data)).with_guessed_format()?;
        if !matches!(
            (reader.format(), a.mime.as_str()),
            (Some(image::ImageFormat::Png), "image/png") | (Some(image::ImageFormat::Jpeg), "image/jpeg")
        ) {
            return Err("Only embedded PNG/JPEG assets are supported by this adapter".into());
        }
        let (w, h) = reader.into_dimensions()?;
        if u64::from(w) * u64::from(h) > 16_000_000 {
            return Err("Embedded image exceeds 16 megapixels".into());
        }
    }
    Ok(())
}
fn canonical_snapshot(doc: &Document) -> Result<Value, Box<dyn std::error::Error>> {
    let snapshot = serde_json::to_value(doc)?;
    if serde_json::to_vec(&snapshot)?.len() > MAX_CANONICAL_STATE {
        return Err("Canonical document snapshot exceeds 16 MB".into());
    }
    Ok(snapshot)
}
fn output_path(root: &Path, p: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let p = Path::new(p);
    let parent = std::fs::canonicalize(p.parent().ok_or("Missing output parent")?)?;
    if !parent.starts_with(root) {
        return Err("Output is outside the private root".into());
    }
    let name = p.file_name().ok_or("Missing filename")?;
    let file = parent.join(name);
    if file.symlink_metadata().is_ok() {
        return Err("Private output already exists".into());
    }
    Ok(file)
}
// Original compose::caret and text transform, in spread coordinates (no UI layout).
// Original cell_caret already includes the placed cell origin; do not add it twice.
// The original pseudo-table is u64::MAX. Encode it before any JavaScript JSON parse.
// IDs fit both the canonical JSON number and the original wasm32 CellAddr row.
fn note_address(cell: designcraft_doc::CellAddr) -> Option<Value> {
    let id = cell.footnote_id()?;
    (id > 0 && id <= u32::MAX as u64 && cell.col == 0).then(|| json!({"kind":"footnote","id":id.to_string()}))
}
fn wire_address(value: &mut Value, cell: designcraft_doc::CellAddr) -> Result<(), Box<dyn std::error::Error>> {
    if cell.footnote_id().is_some() {
        let note = note_address(cell).ok_or("Unsupported footnote address")?;
        let object = value.as_object_mut().ok_or("Missing address container")?;
        object.remove("cell"); object.insert("note".into(), note);
    }
    Ok(())
}
fn wire_selection(selection: &designcraft_doc::Selection) -> Result<Value, Box<dyn std::error::Error>> {
    let mut value = serde_json::to_value(selection)?;
    if let Some(cell) = selection.text.and_then(|t| t.cell) { wire_address(&mut value["text"], cell)?; }
    Ok(value)
}
fn caret_geometry(h: &Headless, index: usize) -> Option<Value> {
    let st = h.session.active()?;
    let ts = st.selection.text.filter(|ts| ts.is_caret())?;
    let cs = h.session.cache.get(&st.doc, ts.story, None);
    let (fi, x, bl, asc, desc) = match ts.cell {
        Some(cell) if note_address(cell).is_some() =>
            designcraft_compose::note_caret(&cs, cell.footnote_id()?, ts.focus)?,
        Some(cell) if cell.footnote_id().is_none() && cell.table > 0 && cell.table <= 9007199254740991 && cell.row < 4096 && cell.col < 4096 =>
            designcraft_compose::cell_caret(&cs, cell.table, cell.row, cell.col, ts.focus)?,
        Some(_) => return None,
        None => designcraft_compose::caret(&cs, ts.focus)?,
    };
    let ft = cs.frames.get(fi)?;
    let loc = st.doc.find(ft.frame)?;
    let (spread, _) = st.doc.page_loc(index)?;
    if loc.spread != designcraft_doc::SpreadRef::Doc(spread) { return None; }
    let it = st.doc.item(ft.frame)?;
    let m = st.doc.parent_xf(&loc) * st.doc.text_xf(it);
    let a = m * designcraft_geom::Point::new(x, bl - asc);
    let b = m * designcraft_geom::Point::new(x, bl + desc);
    let bounds = st.doc.page(index)?.bounds();
    if ![a.x,a.y,b.x,b.y].iter().all(|v| v.is_finite() && v.abs() <= 100000.0)
        || !bounds.contains(designcraft_geom::Point::new((a.x+b.x)/2.0,(a.y+b.y)/2.0)) { return None; }
    let mut caret = json!({"page":index,"frame":ft.frame,"story":ts.story,"points":[[a.x,a.y],[b.x,b.y]]});
    if let Some(cell) = ts.cell { caret["cell"] = serde_json::to_value(cell).ok()?; wire_address(&mut caret,cell).ok()?; }
    Some(caret)
}

// Resolve the original body caret on an isolated selection-only candidate.
// No document/history change or filesystem parameter is admitted by this command.
fn footnote_reference_page(h:&Headless,p:&Value)->Result<usize,Box<dyn std::error::Error>> {
    if !p.as_object().is_some_and(|o|o.is_empty()) {return Err("footnote.goToReference takes no parameters".into());}
    let st=h.session.active().ok_or("No document")?;
    let mut candidate=Headless::new();
    let mut mirror=DocState::new((*st.doc).clone(),None);mirror.selection=st.selection.clone();candidate.session.add_document(mirror);
    candidate.call("engine.execute",json!({"command":"footnote.goToReference","params":{}}))?;
    let count=st.doc.spreads.iter().map(|s|s.pages.len()).sum::<usize>();
    if count==0 || count>64 {return Err("Reference page exceeds the 64-page server limit".into());}
    (0..count).find(|&page|caret_geometry(&candidate,page).is_some()).ok_or_else(||"Footnote reference has no visible body caret".into())
}

fn answer(h: &mut Headless, saved: &mut Option<Arc<Document>>, read: &Path, write: &Path, r: &Value) -> Result<Value, Box<dyn std::error::Error>> {
    let method = r.get("method").and_then(Value::as_str).unwrap_or("");
    let p = r.get("params").cloned().unwrap_or(json!({}));
    match method {
        "__cw_identity" => Ok(json!({"runtimeId":"creative-workspace-designcraft-v1","version":"0.5.0"})),
        "state" => {
            let Some(st) = h.session.active() else { return Ok(Value::Null) };
            let doc = st.doc.clone();
            let selection = st.selection.clone();
            let clean = saved.as_ref().is_some_and(|d| Arc::ptr_eq(d, &doc));
            let mut v = h.call("document.inspect", json!({}))?;
            if let Some(o) = v.as_object_mut() {
                o.remove("path");
            }
            v["dirty"] = json!(!clean);
            v["documentSnapshot"] = canonical_snapshot(&doc)?;
            v["selection"] = wire_selection(&selection)?;
            let history = h.call("engine.execute", json!({"command":"document.history","params":{}}))?;
            v["history"] = history;
            if let Some(st) = h.session.active()
                && let Some(stories) = v.get_mut("stories").and_then(Value::as_array_mut)
            {
                for story in stories {
                    if let Some(id) = story.get("id").and_then(Value::as_u64).map(designcraft_doc::StoryId)
                        && let Some(s) = st.doc.story(id)
                    {
                        story["text"] = json!(s.text.chars().take(20000).collect::<String>());
                        story["editable"] = json!(s.text.encode_utf16().count() <= 20000);
                        story["notes"] = json!(s.notes.iter().map(|n| json!({"kind":"footnote","id":n.id.to_string(),"length":n.text.text.len()})).collect::<Vec<_>>());
                    }
                }
            }
            Ok(v)
        }
        "open" | "new" => {
            if h.session.active().is_some() {
                return Err("One document per session; save and close first".into());
            }
            if method == "open" {
                let bytes = bounded_read(read, p.get("path").and_then(Value::as_str).ok_or("Missing input path")?)?;
                zip_budget(&bytes)?;
                // Pure memory import avoids upstream file.open's automatic document fonts,
                // data-merge source resolution and linked-file reads outside the user's root.
                let doc = designcraft_format::load(&bytes)?;
                budget(&doc)?;
                h.session.add_document(DocState::new(doc, None));
                *saved = h.session.active().map(|s| s.doc.clone());
            } else {
                h.call("engine.execute", json!({"command":"file.new","params":p}))?;
            }
            Ok(json!({"warnings":[]}))
        }
        // Preserve the original upstream command ID while keeping its Session on
        // this owned server worker. Browser RPC never forwards an arbitrary ID.
        "sample" => {
            if h.session.active().is_some() {
                return Err("One document per session; save and close first".into());
            }
            h.call("engine.execute", json!({"command":"file.newSample","params":{}}))?;
            let doc = h.session.active().ok_or("Sample command created no document")?.doc.clone();
            budget(&doc)?;
            *saved = None;
            Ok(json!({"commandId":"file.newSample"}))
        }
        "query" => endnote_list(h,&p),
        "command" => {
            let c = p.get("command").and_then(Value::as_str).ok_or("Missing command")?;
            if !COMMANDS.contains(&c) {
                return Err("Unsupported workspace layout command".into());
            }
            if c=="footnote.options" { footnote_options_budget(h,p.get("params").unwrap_or(&Value::Null))?; }
            if c=="footnote.insert" { footnote_insert_budget(h,p.get("params").unwrap_or(&Value::Null))?; }
            if c=="endnote.delete" { endnote_delete_budget(h,p.get("params").unwrap_or(&Value::Null))?; }
            if c=="endnote.edit" { endnote_edit_budget(h,p.get("params").unwrap_or(&Value::Null))?; }
            if c=="endnote.options" { endnote_options_budget(h,p.get("params").unwrap_or(&Value::Null))?; }
            if c=="endnote.insert" { endnote_insert_budget(h,p.get("params").unwrap_or(&Value::Null))?; }
            // Upstream records the old document with the post-edit selection.
            // For admitted note edits, pair that exact history entry with its
            // pre-edit selection, so Undo cannot point beyond an empty/deleted note.
            let note_history = h.session.active().filter(|st| matches!(c,"footnote.insert" | "endnote.insert")
                || (matches!(c,"text.insert" | "text.delete" | "edit.clear")
                    && st.selection.text.is_some_and(|t|t.cell.and_then(|cell|cell.footnote_id()).is_some()||st.doc.story(t.story).is_some_and(|story|!story.endnotes.is_empty()))))
                .map(|st|(st.doc.clone(),st.selection.clone()));
            let reference_page=if c=="footnote.goToReference" {Some(footnote_reference_page(h,p.get("params").unwrap_or(&Value::Null))?)} else {None};
            let mut result = h.call("engine.execute", p)?;
            if let Some(page)=reference_page {result["page"]=json!(page);}
            if let Some((doc,selection))=note_history
                && let Some(entry)=h.session.active_mut().and_then(|st|st.history.undo.last_mut())
                && Arc::ptr_eq(&entry.doc,&doc) { entry.selection=selection; }
            if let Some(cell) = result.get("cell").filter(|c| !c.is_null()) {
                let cell: designcraft_doc::CellAddr = serde_json::from_value(cell.clone())?;
                wire_address(&mut result, cell)?;
            }
            Ok(result)
        }
        "render" => {
            let st = h.session.active().ok_or("No document")?;
            let index = p.get("page").and_then(Value::as_u64).unwrap_or(0) as usize;
            let page = st.doc.page(index).ok_or("Unknown page")?;
            let scale = (1280.0/page.width.max(page.height)).min(1.0);
            let caret = caret_geometry(h, index);
            let mut frame = h.call("ui.render", json!({"page":index,"scale":scale}))?;
            frame["caret"] = caret.unwrap_or(Value::Null);
            text_selection::apply(h,index,scale,&mut frame)?;
            Ok(frame)
        }
        "export" => {
            let file = output_path(write, p.get("path").and_then(Value::as_str).ok_or("Missing export filename")?)?;
            let format = p.get("format").and_then(Value::as_str).ok_or("Missing export format")?;
            budget(&h.session.active().ok_or("No document")?.doc)?;
            let mut value = match format {
                "designcraft" => {
                    let bytes = designcraft_format::save(&h.session.active().ok_or("No document")?.doc)?;
                    let mut f = std::fs::OpenOptions::new().write(true).create_new(true).open(&file)?;
                    f.write_all(&bytes)?;
                    json!({"bytes":bytes.len()})
                }
                "pdf" => h.call("engine.execute", json!({"command":"file.exportPdf","params":{"path":file,"tagged":true}}))?,
                "png" => h.call("app.export", json!({"path":file,"page":p.get("page"),"scale":p.get("scale")}))?,
                _ => return Err("Unsupported export format".into()),
            };
            if let Some(o) = value.as_object_mut() {
                o.remove("path");
            }
            Ok(value)
        }
        "save_copy" => {
            let file = output_path(write, p.get("path").and_then(Value::as_str).ok_or("Missing copy filename")?)?;
            budget(&h.session.active().ok_or("No document")?.doc)?;
            let mut value = h.call("engine.execute", json!({"command":"file.saveACopy","params":{"path":file}}))?;
            if let Some(o) = value.as_object_mut() {
                o.remove("path");
            }
            Ok(value)
        }
        "mark_saved" => {
            *saved = Some(h.session.active().ok_or("No document")?.doc.clone());
            Ok(json!({"saved":true}))
        }
        _ => Err("Unsupported workspace layout method".into()),
    }
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let read = std::fs::canonicalize(std::env::args_os().nth(1).ok_or("Pass the source root")?)?;
    let write = std::fs::canonicalize(std::env::args_os().nth(2).ok_or("Pass the private output root")?)?;
    let mut h = Headless::new();
    let mut saved = None;
    let mut input = io::stdin().lock();
    let mut output = io::stdout().lock();
    loop {
        let mut line = Vec::new();
        if Read::by_ref(&mut input).take((LIMIT + 1) as u64).read_until(b'\n', &mut line)? == 0 {
            break;
        }
        let reply = if line.len() > LIMIT {
            if line.last() != Some(&b'\n') {
                loop {
                    let chunk = input.fill_buf()?;
                    if chunk.is_empty() {
                        break;
                    }
                    let end = chunk.iter().position(|b| *b == b'\n');
                    let length = end.map_or(chunk.len(), |at| at + 1);
                    input.consume(length);
                    if end.is_some() {
                        break;
                    }
                }
            }
            json!({"id":null,"ok":false,"error":"Request exceeds 64 KB"})
        } else {
            match serde_json::from_slice::<Value>(&line) {
                Err(_) => json!({"id":null,"ok":false,"error":"Invalid JSON request"}),
                Ok(r) => match answer(&mut h, &mut saved, &read, &write, &r) {
                    Ok(result) => json!({"id":r.get("id"),"ok":true,"result":result}),
                    Err(e) => json!({"id":r.get("id"),"ok":false,"error":e.to_string()}),
                },
            }
        };
        let bytes = serde_json::to_vec(&reply)?;
        if bytes.len() > 32 * 1024 * 1024 {
            serde_json::to_writer(&mut output, &json!({"id":reply.get("id"),"ok":false,"error":"Reply exceeds 32 MB"}))?;
        } else {
            output.write_all(&bytes)?;
        }
        output.write_all(b"\n")?;
        output.flush()?;
    }
    Ok(())
}

#[cfg(test)] mod footnote_contract {
 use super::*;
 #[test] fn original_note_fixture() -> Result<(),Box<dyn std::error::Error>> {
  let output=std::env::var("CW_FOOTNOTE_OUTPUT").ok().map(PathBuf::from);
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
  let doc=st.doc.clone();let fixture=designcraft_format::save(&doc)?;if let Some(output)=&output { std::fs::write(output.join("fixture.designcraft"),&fixture)?; }
  let selection=serde_json::to_value(&st.selection)?;
  let wire=wire_selection(&st.selection)?;
  assert_eq!(wire["text"]["note"],json!({"kind":"footnote","id":"1"}));assert!(wire["text"].get("cell").is_none());
  assert!(!serde_json::to_string(&wire)?.contains("1844674407370955"));
  let plain=answer(&mut h,&mut saved,output.as_deref().unwrap_or(Path::new(".")),output.as_deref().unwrap_or(Path::new(".")),&json!({"method":"render","params":{"page":2}}))?;
  h.call("engine.execute",json!({"command":"text.placeCaret","params":{"frame":frame,"point":[point.x,point.y]}}))?;
  assert_eq!(h.session.active().and_then(|s|s.selection.text).and_then(|t|t.cell),Some(addr));
  h.call("engine.execute",json!({"command":"edit.selectAll","params":{}}))?;
  let range=h.session.active().and_then(|s|s.selection.text).ok_or("No note range")?;assert_eq!(range.range(),0..13);assert_eq!(range.cell,Some(addr));
  let selected=answer(&mut h,&mut saved,output.as_deref().unwrap_or(Path::new(".")),output.as_deref().unwrap_or(Path::new(".")),&json!({"method":"render","params":{"page":2}}))?;
  assert_eq!(plain["caret"]["note"],json!({"kind":"footnote","id":"1"}));
  assert_eq!(selected["textSelection"]["note"],plain["caret"]["note"]);assert_ne!(plain["pngBase64"],selected["pngBase64"]);
  assert!(caret_geometry(&h,1).is_none());
  let sibling=answer(&mut h,&mut saved,output.as_deref().unwrap_or(Path::new(".")),output.as_deref().unwrap_or(Path::new(".")),&json!({"method":"render","params":{"page":1}}))?;
  assert!(sibling["textSelection"].is_null());
  assert!(Arc::ptr_eq(&doc,&h.session.active().ok_or("No doc")?.doc));
  h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Z"}}))?;
  let note_list=h.call("engine.execute",json!({"command":"footnote.list","params":{}}))?;
  assert!(note_list.to_string().contains("Z"));assert!(!note_list.to_string().contains("Footnote text"));
  let edited_doc=h.session.active().ok_or("No edited document")?.doc.clone();let bytes=designcraft_format::save(&edited_doc)?;
  let reopened=designcraft_format::load(&bytes)?;assert_eq!(canonical_snapshot(&reopened)?,canonical_snapshot(&edited_doc)?);
  assert!(canonical_snapshot(&reopened)?.to_string().contains("Body text"));if let Some(output)=&output {std::fs::write(output.join("saved.designcraft"),bytes)?;}
  if let Some(output)=&output { std::fs::write(output.join("fixture.designcraft.json"),serde_json::to_vec_pretty(&json!({"page":2,"frame":frame,"story":ts.story,"noteId":id,"point":[point.x,point.y],"nativeSentinel":u64::MAX.to_string(),"range":[0,13],"originalNoteCaret":[x,bl,asc],"currentAdapterCaret":plain["caret"],"currentAdapterSelection":selected["textSelection"],"canonicalUnchangedBySelection":true,"nativeTextHitAndEdit":true,"nativeSaveReopenCanonicalExact":true}))?)?; }
  Ok(())
 }
}

#[cfg(test)] mod footnote_insert_contract {
 use super::*;
 fn body() -> Result<(Headless,Option<Arc<Document>>,Value),Box<dyn std::error::Error>> {
  let mut h=Headless::new();h.call("engine.execute",json!({"command":"file.new","params":{"pages":3,"facingPages":true}}))?;
  let px=h.session.active().and_then(|s|s.doc.page(2)).ok_or("No page")?.bounds().x0;
  let frame=h.call("engine.execute",json!({"command":"frame.create","params":{"spread":1,"rect":[px+60.0,80.0,px+360.0,320.0],"content":"text","caret":true}}))?;
  h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Body text"}}))?;Ok((h,None,frame))
 }
 #[test] fn original_insert_command_enters_empty_note_and_saves_reopens() -> Result<(),Box<dyn std::error::Error>> {
  let (mut h,mut saved,frame)=body()?;let output=std::env::var("CW_FOOTNOTE_OUTPUT").ok().map(PathBuf::from);
  let old=h.session.active().ok_or("No doc")?.doc.clone();let original=canonical_snapshot(&old)?;
  let caret=caret_geometry(&h,2).ok_or("No body caret")?;
  if let Some(o)=&output { std::fs::write(o.join("insert-body.designcraft"),designcraft_format::save(&old)?)?;std::fs::write(o.join("insert-body.designcraft.json"),serde_json::to_vec_pretty(&json!({"page":2,"story":frame["story"],"frame":frame["id"],"point":[caret["points"][0][0],(caret["points"][0][1].as_f64().ok_or("No y")?+caret["points"][1][1].as_f64().ok_or("No y")?)/2.0]}))?)?; }
  let result=answer(&mut h,&mut saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"footnote.insert","params":{}}}))?;
  assert_eq!(result,json!({"story":frame["story"],"id":1}));let selected=wire_selection(&h.session.active().ok_or("No inserted doc")?.selection)?;
  assert_eq!(selected["text"]["note"],json!({"kind":"footnote","id":"1"}));assert_eq!(selected["text"]["focus"],0);
  let story=h.session.active().ok_or("No doc")?.doc.story(serde_json::from_value(frame["story"].clone())?).ok_or("No story")?;assert_eq!(story.text,format!("Body text{}",designcraft_doc::FOOTNOTE_REF));assert!(story.notes[0].text.text.is_empty());
  assert!(answer(&mut h,&mut saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"footnote.insert","params":{}}})).is_err());
  answer(&mut h,&mut saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"text.insert","params":{"text":"N"}}}))?;let edited=h.session.active().ok_or("No doc")?.doc.clone();let bytes=designcraft_format::save(&edited)?;let reopened=designcraft_format::load(&bytes)?;assert_eq!(canonical_snapshot(&reopened)?,canonical_snapshot(&edited)?);
  h.call("engine.execute",json!({"command":"edit.undo","params":{}}))?;
  let undo_selection=wire_selection(&h.session.active().ok_or("No undo note")?.selection)?;
  assert_eq!(undo_selection["text"]["focus"],0);assert_eq!(undo_selection["text"]["note"],json!({"kind":"footnote","id":"1"}));
  assert!(caret_geometry(&h,2).is_some());
  h.call("engine.execute",json!({"command":"edit.undo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("No undo doc")?.doc)?,original);
  let body_selection=wire_selection(&h.session.active().ok_or("No body")?.selection)?;assert!(body_selection["text"].get("note").is_none());assert_eq!(body_selection["text"]["focus"],9);
  h.call("engine.execute",json!({"command":"edit.redo","params":{}}))?;h.call("engine.execute",json!({"command":"edit.redo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("No redo doc")?.doc)?,canonical_snapshot(&edited)?);
  assert_eq!(wire_selection(&h.session.active().ok_or("No redo note")?.selection)?["text"]["focus"],1);
  if let Some(o)=&output { std::fs::write(o.join("insert-contract.json"),serde_json::to_vec_pretty(&json!({"emptyOriginalCommand":result,"selectedNote":selected,"bodyReferenceOnly":true,"nestedRefused":true,"typingInNote":true,"undoBodyRestored":true,"undoNoteAndBodySelectionRestored":true,"redoCanonicalAndSelectionExact":true,"nativeSaveReopenCanonicalExact":true}))?)?; }Ok(())
 }
 #[test] fn insertion_preflight_rejects_bad_params_and_exhausted_id_without_edit() -> Result<(),Box<dyn std::error::Error>> {
  let (mut h,mut saved,frame)=body()?;let prior=h.session.active().ok_or("No doc")?.doc.clone();
  for p in [json!({"text":7}),json!({"text":"x","path":"outside"}),json!({"text":"é".repeat(2049)}),Value::Null] {
   assert!(answer(&mut h,&mut saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"footnote.insert","params":p}})).is_err());assert!(Arc::ptr_eq(&prior,&h.session.active().ok_or("No doc")?.doc));
  }
  h.call("engine.execute",json!({"command":"footnote.insert","params":{"text":"prior"}}))?;h.call("engine.execute",json!({"command":"text.select","params":{"story":frame["story"],"anchor":0,"focus":0}}))?;
  {let st=h.session.active_mut().ok_or("No mutable doc")?;let doc=Arc::make_mut(&mut st.doc);let story=doc.story_mut(serde_json::from_value(frame["story"].clone())?).ok_or("No story")?;Arc::make_mut(&mut story.notes[0]).id=u32::MAX as u64;}
  let prior=h.session.active().ok_or("No doc")?.doc.clone();assert!(answer(&mut h,&mut saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"footnote.insert","params":{}}})).is_err());assert!(Arc::ptr_eq(&prior,&h.session.active().ok_or("No doc")?.doc));Ok(())
 }
}

#[cfg(test)] mod footnote_candidate_budget {
 use super::*;
 #[test] fn exact_original_candidate_bounds_duplicated_note_style_before_edit() -> Result<(),Box<dyn std::error::Error>> {
  let mut h=Headless::new();let mut saved=None;
  h.call("engine.execute",json!({"command":"file.new","params":{}}))?;
  h.call("engine.execute",json!({"command":"frame.create","params":{"rect":[40.0,40.0,300.0,300.0],"content":"text","caret":true}}))?;
  {let st=h.session.active_mut().ok_or("No doc")?;Arc::make_mut(&mut st.doc).footnote_options.para_style="x".repeat(8*1024*1024);}
  let prior=h.session.active().ok_or("No doc")?.doc.clone();canonical_snapshot(&prior)?;
  assert!(answer(&mut h,&mut saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"footnote.insert","params":{}}})).is_err());
  assert!(Arc::ptr_eq(&prior,&h.session.active().ok_or("No doc")?.doc));Ok(())
 }
}

#[cfg(test)] mod footnote_options_contract {
 use super::*;
 #[test] fn original_options_guard_history_render_and_save_reopen()->Result<(),Box<dyn std::error::Error>> {
  let mut h=Headless::new();let mut saved=None;
  h.call("engine.execute",json!({"command":"file.new","params":{"pages":3,"facingPages":true}}))?;
  let px=h.session.active().ok_or("doc")?.doc.page(2).ok_or("page")?.bounds().x0;
  let frame=h.call("engine.execute",json!({"command":"frame.create","params":{"spread":1,"rect":[px+60.0,80.0,px+360.0,320.0],"content":"text","caret":true}}))?;
  h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Body text"}}))?;
  h.call("engine.execute",json!({"command":"footnote.insert","params":{"text":"Footnote text"}}))?;
  let old=h.session.active().ok_or("doc")?.doc.clone();let original=canonical_snapshot(&old)?;
  let selection=wire_selection(&h.session.active().ok_or("doc")?.selection)?;
  let execute=|h:&mut Headless,saved:&mut Option<Arc<Document>>,p:Value|answer(h,saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"footnote.options","params":p}}));
  for p in [json!({"bogus":true}),json!({"style":"bogus"}),json!({"rule":{"width":10001}}),json!({"rule":{"tint":1.1}}),json!({"startAt":4294967296u64}),json!({"startAt":4294967295u64}),json!({"prefix":"é".repeat(129)}),json!({"spaceBetween":-1}),json!({"rule":[]}),Value::Null] {
   assert!(execute(&mut h,&mut saved,p).is_err());assert!(Arc::ptr_eq(&old,&h.session.active().ok_or("doc")?.doc));
  }
  let params=json!({"style":"lowerRoman","startAt":3,"prefix":"[","suffix":"]","affixIn":"both","separator":" — ","spaceBefore":8.0,"spaceBetween":3.0,"firstBaseline":"leading","spanColumns":true,"rule":{"on":true,"weight":2.0,"width":100.0,"offset":4.0,"leftIndent":5.0,"tint":0.5}});
  let result=execute(&mut h,&mut saved,params.clone())?;assert_eq!(result["startAt"],3);assert_eq!(result["rule"]["tint"],0.5);
  let changed=h.session.active().ok_or("doc")?.doc.clone();let changed_json=canonical_snapshot(&changed)?;
  assert_eq!(wire_selection(&h.session.active().ok_or("doc")?.selection)?,selection);
  assert_ne!(changed_json,original);
  for key in ["stories","spreads","parents"] {assert_eq!(changed_json[key],original[key]);}
  h.call("engine.execute",json!({"command":"edit.undo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("doc")?.doc)?,original);
  h.call("engine.execute",json!({"command":"edit.redo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("doc")?.doc)?,changed_json);
  let reopened=designcraft_format::load(&designcraft_format::save(&changed)?)?;assert_eq!(canonical_snapshot(&reopened)?,changed_json);
  if let Ok(out)=std::env::var("CW_FOOTNOTE_OUTPUT") {
   let root=PathBuf::from(out);std::fs::write(root.join("options-fixture.designcraft"),designcraft_format::save(&old)?)?;
   std::fs::write(root.join("options-native.json"),serde_json::to_vec_pretty(&json!({"params":params,"result":result,"sourceCommand":"footnote.options","frame":frame,"rejectedBeforeMutation":10,"selectionUnchanged":true,"storyAndPageUnchanged":true,"undoRedoCanonicalExact":true,"saveReopenCanonicalExact":true}))?)?;
  }Ok(())
 }
}

#[cfg(test)] mod footnote_reference_contract {
 use super::*;
 #[test] fn reference_is_selection_only_utf8_page_bound_and_rejects_before_mutation()->Result<(),Box<dyn std::error::Error>> {
  let mut h=Headless::new();let mut saved=None;
  h.call("engine.execute",json!({"command":"file.new","params":{"pages":3,"facingPages":true}}))?;
  let px=h.session.active().ok_or("doc")?.doc.page(2).ok_or("page")?.bounds().x0;
  let f=h.call("engine.execute",json!({"command":"frame.create","params":{"spread":1,"rect":[px+60.0,80.0,px+360.0,320.0],"content":"text","caret":true}}))?;
  h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Body é text after"}}))?;
  h.call("engine.execute",json!({"command":"text.select","params":{"story":f["story"],"anchor":7,"focus":7}}))?;
  let execute=|h:&mut Headless,saved:&mut Option<Arc<Document>>,p:Value|answer(h,saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"footnote.goToReference","params":p}}));
  let before=h.session.active().ok_or("doc")?.selection.clone();assert!(execute(&mut h,&mut saved,json!({})).is_err());assert_eq!(h.session.active().ok_or("doc")?.selection.text,before.text);
  h.call("engine.execute",json!({"command":"footnote.insert","params":{"text":"Footnote text"}}))?;
  let doc=h.session.active().ok_or("doc")?.doc.clone();saved=Some(doc.clone());let canonical=canonical_snapshot(&doc)?;
  let selection=wire_selection(&h.session.active().ok_or("doc")?.selection)?;
  let history=h.call("engine.execute",json!({"command":"document.history","params":{}}))?;
  let caret=caret_geometry(&h,2).ok_or("note caret")?;
  if let Ok(root)=std::env::var("CW_FOOTNOTE_OUTPUT") {let root=Path::new(&root);std::fs::write(root.join("reference-fixture.designcraft"),designcraft_format::save(&doc)?)?;std::fs::write(root.join("reference-fixture.designcraft.json"),serde_json::to_vec_pretty(&json!({"frame":f["id"],"story":f["story"],"page":2,"referencePos":10,"point":[caret["points"][0][0],(caret["points"][0][1].as_f64().ok_or("y")?+caret["points"][1][1].as_f64().ok_or("y")?)/2.0]}))?)?;}
  for p in [Value::Null,json!([]),json!({"path":"private"}),json!({"page":2})] {assert!(execute(&mut h,&mut saved,p).is_err());assert_eq!(wire_selection(&h.session.active().ok_or("doc")?.selection)?,selection);assert!(Arc::ptr_eq(&doc,&h.session.active().ok_or("doc")?.doc));}
  let result=execute(&mut h,&mut saved,json!({}))?;assert_eq!(result["page"],2);assert_eq!(result["pos"],10);assert_eq!(result["story"],f["story"]);
  let state=answer(&mut h,&mut saved,Path::new("."),Path::new("."),&json!({"method":"state"}))?;assert_eq!(state["dirty"],false);assert_eq!(state["documentSnapshot"],canonical);assert!(state["selection"]["text"].get("note").is_none());assert!(state["selection"]["text"]["cell"].is_null());assert_eq!(state["selection"]["text"]["focus"],10);assert_eq!(state["history"],history);assert!(Arc::ptr_eq(&doc,&h.session.active().ok_or("doc")?.doc));assert!(caret_geometry(&h,2).is_some());assert!(caret_geometry(&h,1).is_none());
  let old=wire_selection(&h.session.active().ok_or("doc")?.selection)?;assert!(execute(&mut h,&mut saved,json!({})).is_err());assert_eq!(wire_selection(&h.session.active().ok_or("doc")?.selection)?,old);
  if let Ok(root)=std::env::var("CW_FOOTNOTE_OUTPUT") {std::fs::write(Path::new(&root).join("reference-native.json"),serde_json::to_vec_pretty(&json!({"command":"footnote.goToReference","params":{},"result":result,"noteSelectionBefore":selection,"bodySelectionAfter":old,"canonicalDocumentExact":true,"arcIdentityPreserved":true,"dirtyAfter":state["dirty"],"historyExact":true,"invalidParamsAndBodySelectionRejectedBeforeMutation":true,"originalUtf8ReferencePos":10,"originalCaretPage":2,"nonReferencePageHasNoCaret":true}))?)?;}Ok(())
 }
}

#[cfg(test)] mod endnote_insert_contract {
 use super::*;
 fn body(pages:u64)->Result<(Headless,Option<Arc<Document>>,Value),Box<dyn std::error::Error>>{
  let mut h=Headless::new();h.call("engine.execute",json!({"command":"file.new","params":{"pages":pages,"facingPages":true}}))?;
  let px=h.session.active().and_then(|s|s.doc.page(2)).ok_or("No page")?.bounds().x0;
  let frame=h.call("engine.execute",json!({"command":"frame.create","params":{"spread":1,"rect":[px+60.0,80.0,px+360.0,320.0],"content":"text","caret":true}}))?;
  h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Body text"}}))?;Ok((h,None,frame))
 }
 fn insert(h:&mut Headless,saved:&mut Option<Arc<Document>>,p:Value)->Result<Value,Box<dyn std::error::Error>>{
  answer(h,saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"endnote.insert","params":p}}))
 }
 #[test] fn original_endnote_page_body_caret_undo_and_save_reopen()->Result<(),Box<dyn std::error::Error>>{
  let(mut h,mut saved,frame)=body(3)?;let prior=h.session.active().ok_or("No doc")?.doc.clone();let original=canonical_snapshot(&prior)?;
  let caret=caret_geometry(&h,2).ok_or("No body caret")?;
  if let Ok(root)=std::env::var("CW_ENDNOTE_OUTPUT") {let root=Path::new(&root);std::fs::write(root.join("endnote-body.designcraft"),designcraft_format::save(&prior)?)?;std::fs::write(root.join("endnote-body.designcraft.json"),serde_json::to_vec_pretty(&json!({"page":2,"story":frame["story"],"frame":frame["id"],"point":[caret["points"][0][0],(caret["points"][0][1].as_f64().ok_or("No y")?+caret["points"][1][1].as_f64().ok_or("No y")?)/2.0]}))?)?;}
  let result=insert(&mut h,&mut saved,json!({}))?;assert_eq!(result["id"],1);assert!(result["frame"].is_u64());
  let st=h.session.active().ok_or("No inserted doc")?;let ts=st.selection.text.ok_or("No body selection")?;assert!(ts.cell.is_none());assert_eq!(ts.focus,12);assert_eq!(st.doc.page_count(),4);
  let story=st.doc.story(ts.story).ok_or("No story")?;assert_eq!(story.text,format!("Body text{}",designcraft_doc::ENDNOTE_REF));assert!(story.endnotes[0].text.text.is_empty());
  let listing=st.doc.endnote_story.ok_or("No listing")?;assert_ne!(listing,ts.story);let listing_text=st.doc.story(listing).ok_or("No listing story")?.text.clone();assert!(listing_text.contains("Endnotes"));
  assert!(caret_geometry(&h,2).is_some());assert!(caret_geometry(&h,3).is_none());
  answer(&mut h,&mut saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"text.insert","params":{"text":"N"}}}))?;
  let edited=h.session.active().ok_or("No edited doc")?.doc.clone();let canonical=canonical_snapshot(&edited)?;let bytes=designcraft_format::save(&edited)?;assert_eq!(canonical_snapshot(&designcraft_format::load(&bytes)?)?,canonical);
  h.call("engine.execute",json!({"command":"edit.undo","params":{}}))?;assert_eq!(h.session.active().and_then(|s|s.selection.text).ok_or("No undo caret")?.focus,12);
  h.call("engine.execute",json!({"command":"edit.undo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("No undo doc")?.doc)?,original);assert_eq!(h.session.active().and_then(|s|s.selection.text).ok_or("No body")?.focus,9);
  h.call("engine.execute",json!({"command":"edit.redo","params":{}}))?;h.call("engine.execute",json!({"command":"edit.redo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("No redo doc")?.doc)?,canonical);
  if let Ok(root)=std::env::var("CW_ENDNOTE_OUTPUT") {std::fs::write(Path::new(&root).join("endnote-native.json"),serde_json::to_vec_pretty(&json!({"command":"endnote.insert","result":result,"pagesBefore":3,"pagesAfter":4,"originalUtf8BodyCaret":12,"listingStory":listing,"listingText":listing_text,"bodyCaretStaysInBody":true,"undoRedoCanonicalAndCaretExact":true,"nativeSaveReopenCanonicalExact":true}))?)?;}
  Ok(())
 }
 #[test] fn endnote_preflight_rejects_bad_params_nested_listing_and_format_before_mutation()->Result<(),Box<dyn std::error::Error>>{
  let(mut h,mut saved,_)=body(3)?;let prior=h.session.active().ok_or("No doc")?.doc.clone();
  for p in [Value::Null,json!({"path":"outside"}),json!({"text":7}),json!({"text":"é".repeat(2049)})] {assert!(insert(&mut h,&mut saved,p).is_err());assert!(Arc::ptr_eq(&prior,&h.session.active().ok_or("No doc")?.doc));}
  {let st=h.session.active_mut().ok_or("No doc")?;Arc::make_mut(&mut st.doc).endnote_options.separator="x".repeat(4097);}
  let prior=h.session.active().ok_or("No doc")?.doc.clone();assert!(insert(&mut h,&mut saved,json!({})).is_err());assert!(Arc::ptr_eq(&prior,&h.session.active().ok_or("No doc")?.doc));
  {let st=h.session.active_mut().ok_or("No doc")?;Arc::make_mut(&mut st.doc).endnote_options.separator="\t".into();}
  insert(&mut h,&mut saved,json!({"text":"Source"}))?;let listing=h.session.active().ok_or("No doc")?.doc.endnote_story.ok_or("No listing")?;
  h.call("engine.execute",json!({"command":"text.select","params":{"story":listing,"anchor":0,"focus":0}}))?;let prior=h.session.active().ok_or("No doc")?.doc.clone();assert!(insert(&mut h,&mut saved,json!({})).is_err());assert!(Arc::ptr_eq(&prior,&h.session.active().ok_or("No doc")?.doc));Ok(())
 }
 #[test] fn first_endnote_respects_page_limit_and_existing_frame_is_reused()->Result<(),Box<dyn std::error::Error>>{
  let(mut h,mut saved,_)=body(64)?;let prior=h.session.active().ok_or("No doc")?.doc.clone();assert!(insert(&mut h,&mut saved,json!({})).is_err());assert!(Arc::ptr_eq(&prior,&h.session.active().ok_or("No doc")?.doc));
  let(mut h,mut saved,_)=body(63)?;let first=insert(&mut h,&mut saved,json!({"text":"First"}))?;assert!(first["frame"].is_u64());let second=insert(&mut h,&mut saved,json!({"text":"Second"}))?;assert!(second["frame"].is_null());assert_eq!(h.session.active().ok_or("No doc")?.doc.page_count(),64);Ok(())
 }
}

#[cfg(test)] mod endnote_options_contract {
 use super::*;
 #[test] fn original_endnote_options_preflight_listing_history_and_save_reopen()->Result<(),Box<dyn std::error::Error>> {
  let mut h=Headless::new();let mut saved=None;
  h.call("engine.execute",json!({"command":"file.new","params":{"pages":2,"facingPages":true}}))?;
  let st=h.session.active().ok_or("doc")?;let(si,_)=st.doc.page_loc(1).ok_or("body page")?;let px=st.doc.page(1).ok_or("page")?.bounds().x0;
  let frame=h.call("engine.execute",json!({"command":"frame.create","params":{"spread":si,"rect":[px+60.0,80.0,px+360.0,320.0],"content":"text","caret":true}}))?;
  h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Body text"}}))?;
  h.call("engine.execute",json!({"command":"endnote.insert","params":{"text":"Endnote text"}}))?;
  let old=h.session.active().ok_or("doc")?.doc.clone();let original=canonical_snapshot(&old)?;let listing=old.endnote_story.ok_or("listing")?;
  let selection=wire_selection(&h.session.active().ok_or("doc")?.selection)?;
  let execute=|h:&mut Headless,saved:&mut Option<Arc<Document>>,p:Value|answer(h,saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"endnote.options","params":p}}));
  let invalid=vec![json!({"bogus":true}),json!({"style":"bogus"}),json!({"rule":{}}),json!({"heading":7}),json!({"prefix":"é".repeat(129)}),json!({"headingStyle":"x".repeat(257)}),json!({"startAt":4294967296u64}),json!({"startAt":4294967295u64}),json!({"startAt":-1}),json!({"style":1}),json!([]),Value::Null];
  for params in &invalid {assert!(execute(&mut h,&mut saved,params.clone()).is_err());assert!(Arc::ptr_eq(&old,&h.session.active().ok_or("doc")?.doc));assert_eq!(wire_selection(&h.session.active().ok_or("doc")?.selection)?,selection);}
  let params=json!({"style":"lowerRoman","startAt":3,"prefix":"[","suffix":"]","heading":"Sources","separator":"—"});
  let result=execute(&mut h,&mut saved,params.clone())?;assert_eq!(result["startAt"],3);
  let changed=h.session.active().ok_or("doc")?.doc.clone();let changed_json=canonical_snapshot(&changed)?;
  assert_eq!(changed.page_count(),3);assert_eq!(changed.endnote_story,Some(listing));assert_eq!(changed.story(listing).ok_or("listing")?.text,"Sources\n[iii]—Endnote text");
  for(id,story)in &old.stories {if *id!=listing {assert_eq!(serde_json::to_value(story)?,serde_json::to_value(changed.story(*id).ok_or("body")?)?);}}
  assert_eq!(wire_selection(&h.session.active().ok_or("doc")?.selection)?,selection);
  h.call("engine.execute",json!({"command":"edit.undo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("doc")?.doc)?,original);
  h.call("engine.execute",json!({"command":"edit.redo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("doc")?.doc)?,changed_json);
  let reopened=designcraft_format::load(&designcraft_format::save(&changed)?)?;assert_eq!(canonical_snapshot(&reopened)?,changed_json);
  if let Ok(out)=std::env::var("CW_ENDNOTE_OPTIONS_OUTPUT") {let root=Path::new(&out);std::fs::write(root.join("endnote-options-fixture.designcraft"),designcraft_format::save(&old)?)?;std::fs::write(root.join("endnote-options-native.json"),serde_json::to_vec_pretty(&json!({"sourceCommand":"endnote.options","params":params,"result":result,"frame":frame,"listingStory":listing,"rejectedBeforeMutation":invalid.len(),"bodyPageSelectionUnchanged":true,"originalListingRegenerated":true,"undoRedoCanonicalExact":true,"saveReopenCanonicalExact":true}))?)?;}
  Ok(())
 }
 #[test] fn empty_document_partial_endnote_options_remain_original()->Result<(),Box<dyn std::error::Error>> {
  let mut h=Headless::new();let mut saved=None;h.call("engine.execute",json!({"command":"file.new","params":{}}))?;
  let result=answer(&mut h,&mut saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"endnote.options","params":{"startAt":4294967295u64,"style":"symbols"}}}))?;
  assert_eq!(result["startAt"],4294967295u64);assert_eq!(result["heading"],"Endnotes");Ok(())
 }
}

#[cfg(test)] mod endnote_edit_contract {
 use super::*;
 #[test] fn original_target_text_edit_rejects_before_mutation_and_roundtrips()->Result<(),Box<dyn std::error::Error>> {
  let mut h=Headless::new();let mut saved=None;
  h.call("engine.execute",json!({"command":"file.new","params":{"pages":2,"facingPages":true}}))?;
  let st=h.session.active().ok_or("doc")?;let(si,_)=st.doc.page_loc(1).ok_or("page")?;let px=st.doc.page(1).ok_or("page")?.bounds().x0;
  let frame=h.call("engine.execute",json!({"command":"frame.create","params":{"spread":si,"rect":[px+60.0,80.0,px+360.0,320.0],"content":"text","caret":true}}))?;
  h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Body text"}}))?;
  let inserted=h.call("engine.execute",json!({"command":"endnote.insert","params":{"text":"Endnote text"}}))?;
  let sid=inserted["story"].as_u64().ok_or("story")?;let id=inserted["id"].as_u64().ok_or("id")?;
  let old=h.session.active().ok_or("doc")?.doc.clone();let initial=canonical_snapshot(&old)?;let listing=old.endnote_story.ok_or("listing")?;
  let selection=wire_selection(&h.session.active().ok_or("doc")?.selection)?;let history=h.session.active().ok_or("doc")?.history.undo.len();
  let execute=|h:&mut Headless,saved:&mut Option<Arc<Document>>,p:Value|answer(h,saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"endnote.edit","params":p}}));
  let invalid=vec![json!({}),json!({"story":sid}),json!({"story":0,"id":id}),json!({"story":sid,"id":0}),json!({"story":4294967296u64,"id":id}),json!({"story":sid,"id":4294967296u64}),json!({"story":sid,"id":id,"text":false}),json!({"story":sid,"id":id,"text":"é".repeat(2049)}),json!({"story":sid,"id":id,"path":"private"}),json!({"story":9999,"id":id}),json!({"story":sid,"id":9999}),json!({"story":listing.0,"id":id}),Value::Null,json!([])];
  for p in &invalid {assert!(execute(&mut h,&mut saved,p.clone()).is_err());let st=h.session.active().ok_or("doc")?;assert!(Arc::ptr_eq(&st.doc,&old));assert_eq!(wire_selection(&st.selection)?,selection);assert_eq!(st.history.undo.len(),history);}
  let params=json!({"story":sid,"id":id,"text":"Revised č source"});let result=execute(&mut h,&mut saved,params.clone())?;
  let changed=h.session.active().ok_or("doc")?.doc.clone();let canonical=canonical_snapshot(&changed)?;
  assert_eq!(changed.page_count(),3);assert_eq!(changed.endnote_story,Some(listing));assert!(changed.story(listing).ok_or("listing")?.text.ends_with("Revised č source"));
  assert_eq!(changed.story(designcraft_doc::StoryId(sid)).ok_or("body")?.text,old.story(designcraft_doc::StoryId(sid)).ok_or("body")?.text);
  let mut expected=initial.clone();assert_eq!(canonical["stories"][sid.to_string()]["rev"].as_u64(),initial["stories"][sid.to_string()]["rev"].as_u64().map(|n|n+1));expected["stories"][sid.to_string()]["rev"]=canonical["stories"][sid.to_string()]["rev"].clone();expected["stories"][sid.to_string()]["endnotes"][0]["text"]=canonical["stories"][sid.to_string()]["endnotes"][0]["text"].clone();expected["stories"][listing.0.to_string()]=canonical["stories"][listing.0.to_string()].clone();assert_eq!(expected,canonical);
  assert_eq!(wire_selection(&h.session.active().ok_or("doc")?.selection)?,selection);
  h.call("engine.execute",json!({"command":"edit.undo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("doc")?.doc)?,initial);assert_eq!(wire_selection(&h.session.active().ok_or("doc")?.selection)?,selection);
  h.call("engine.execute",json!({"command":"edit.redo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("doc")?.doc)?,canonical);
  let reopened=designcraft_format::load(&designcraft_format::save(&changed)?)?;assert_eq!(canonical_snapshot(&reopened)?,canonical);
  // Original missing/empty text clears the existing note; its reference stays.
  execute(&mut h,&mut saved,json!({"story":sid,"id":id}))?;assert!(h.session.active().ok_or("doc")?.doc.story(designcraft_doc::StoryId(sid)).ok_or("body")?.endnotes[0].text.text.is_empty());
  if let Ok(out)=std::env::var("CW_ENDNOTE_EDIT_OUTPUT") {let root=Path::new(&out);std::fs::write(root.join("endnote-edit-fixture.designcraft"),designcraft_format::save(&old)?)?;std::fs::write(root.join("endnote-edit-native.json"),serde_json::to_vec_pretty(&json!({"sourceCommand":"endnote.edit","target":{"story":sid,"id":id},"params":params,"result":result,"frame":frame,"listingStory":listing,"rejectedBeforeMutation":invalid.len(),"bodyReferencePageSelectionPreserved":true,"onlyTargetAndListingChange":true,"undoRedoCanonicalExact":true,"saveReopenCanonicalExact":true,"missingTextClearsOriginal":true}))?)?;}
  Ok(())
 }
 #[test] fn exact_edit_candidate_bounds_duplicated_style_without_touching_history()->Result<(),Box<dyn std::error::Error>> {
  let mut h=Headless::new();h.call("engine.execute",json!({"command":"file.new","params":{}}))?;
  h.call("engine.execute",json!({"command":"frame.create","params":{"rect":[60,80,360,320],"content":"text","caret":true}}))?;
  let n=h.call("engine.execute",json!({"command":"endnote.insert","params":{"text":"old"}}))?;
  {let st=h.session.active_mut().ok_or("doc")?;Arc::make_mut(&mut st.doc).endnote_options.para_style="x".repeat(4097);}
  let before=h.session.active().ok_or("doc")?.doc.clone();let count=h.session.active().ok_or("doc")?.history.undo.len();
  assert!(endnote_edit_budget(&h,&json!({"story":n["story"],"id":n["id"],"text":"new"})).is_err());assert!(Arc::ptr_eq(&before,&h.session.active().ok_or("doc")?.doc));assert_eq!(h.session.active().ok_or("doc")?.history.undo.len(),count);Ok(())
 }
}

#[cfg(test)] mod endnote_delete_contract {
 use super::*;
 #[test] fn original_reference_and_note_delete_are_bounded_and_roundtrip()->Result<(),Box<dyn std::error::Error>> {
  let mut h=Headless::new();let mut saved=None;
  h.call("engine.execute",json!({"command":"file.new","params":{"pages":2,"facingPages":true}}))?;
  let st=h.session.active().ok_or("doc")?;let(si,_)=st.doc.page_loc(1).ok_or("page")?;let px=st.doc.page(1).ok_or("page")?.bounds().x0;
  let frame=h.call("engine.execute",json!({"command":"frame.create","params":{"spread":si,"rect":[px+60.0,80.0,px+360.0,320.0],"content":"text","caret":true}}))?;
  h.call("engine.execute",json!({"command":"text.insert","params":{"text":"Body text"}}))?;
  let first=h.call("engine.execute",json!({"command":"endnote.insert","params":{"text":"First removed"}}))?;
  let second=h.call("engine.execute",json!({"command":"endnote.insert","params":{"text":"Second kept"}}))?;
  let sid=first["story"].as_u64().ok_or("story")?;let id=first["id"].as_u64().ok_or("id")?;let body=designcraft_doc::StoryId(sid);
  // The native command preserves the source selection; exercise an object selection.
  h.session.active_mut().ok_or("doc")?.selection.text=None;
  let old=h.session.active().ok_or("doc")?.doc.clone();let initial=canonical_snapshot(&old)?;let listing=old.endnote_story.ok_or("listing")?;
  let selection=wire_selection(&h.session.active().ok_or("doc")?.selection)?;let history=h.session.active().ok_or("doc")?.history.undo.len();
  let execute=|h:&mut Headless,saved:&mut Option<Arc<Document>>,p:Value|answer(h,saved,Path::new("."),Path::new("."),&json!({"method":"command","params":{"command":"endnote.delete","params":p}}));
  let invalid=vec![json!({}),json!({"story":sid}),json!({"story":0,"id":id}),json!({"story":sid,"id":0}),json!({"story":-1,"id":id}),json!({"story":"1","id":id}),json!({"story":4294967296u64,"id":id}),json!({"story":sid,"id":4294967296u64}),json!({"story":sid,"id":id,"text":"extra"}),json!({"story":sid,"id":id,"path":"private"}),json!({"story":9999,"id":id}),json!({"story":sid,"id":9999}),json!({"story":listing.0,"id":id}),Value::Null,json!([])];
  for p in &invalid {assert!(execute(&mut h,&mut saved,p.clone()).is_err());let st=h.session.active().ok_or("doc")?;assert!(Arc::ptr_eq(&st.doc,&old));assert_eq!(wire_selection(&st.selection)?,selection);assert_eq!(st.history.undo.len(),history);}
  let params=json!({"story":sid,"id":id});
  let mut original=designcraft_engine::Session::new();let mut expected=DocState::new((*old).clone(),None);expected.selection=h.session.active().ok_or("doc")?.selection.clone();original.add_document(expected);original.execute("endnote.delete",&params)?;
  let result=execute(&mut h,&mut saved,params.clone())?;let changed=h.session.active().ok_or("doc")?.doc.clone();let canonical=canonical_snapshot(&changed)?;
  assert_eq!(canonical,canonical_snapshot(&original.active().ok_or("original")?.doc)?);assert_eq!(changed.page_count(),3);assert_eq!(changed.endnote_story,Some(listing));
  let old_body=old.story(body).ok_or("body")?;let new_body=changed.story(body).ok_or("body")?;
  assert_eq!(new_body.text,old_body.text.replacen(designcraft_doc::ENDNOTE_REF,"",1));assert_eq!(new_body.endnotes.len(),1);assert_eq!(new_body.endnotes[0].id,second["id"].as_u64().ok_or("second")?);assert_eq!(serde_json::to_value(&new_body.endnotes[0])?,serde_json::to_value(&old_body.endnotes[1])?);
  assert!(!changed.story(listing).ok_or("listing")?.text.contains("First removed"));assert!(changed.story(listing).ok_or("listing")?.text.ends_with("Second kept"));
  let mut remaining=canonical.clone();let mut prior=initial.clone();for key in [body.0.to_string(),listing.0.to_string()]{remaining["stories"].as_object_mut().ok_or("stories")?.remove(&key);prior["stories"].as_object_mut().ok_or("stories")?.remove(&key);}assert_eq!(remaining,prior);
  assert_eq!(wire_selection(&h.session.active().ok_or("doc")?.selection)?,selection);
  h.call("engine.execute",json!({"command":"edit.undo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("doc")?.doc)?,initial);assert_eq!(wire_selection(&h.session.active().ok_or("doc")?.selection)?,selection);
  h.call("engine.execute",json!({"command":"edit.redo","params":{}}))?;assert_eq!(canonical_snapshot(&h.session.active().ok_or("doc")?.doc)?,canonical);
  assert_eq!(canonical_snapshot(&designcraft_format::load(&designcraft_format::save(&changed)?)?)?,canonical);
  if let Ok(out)=std::env::var("CW_ENDNOTE_DELETE_OUTPUT"){let root=Path::new(&out);std::fs::write(root.join("endnote-delete-fixture.designcraft"),designcraft_format::save(&old)?)?;std::fs::write(root.join("endnote-delete-native.json"),serde_json::to_vec_pretty(&json!({"sourceCommand":"endnote.delete","target":{"story":sid,"id":id},"params":params,"result":result,"frame":frame,"listingStory":listing,"rejectedBeforeMutation":invalid.len(),"originalNativeCandidateExact":true,"oneBodyReferenceAndNoteRemoved":true,"otherNotesPagesSelectionPreserved":true,"undoRedoCanonicalExact":true,"saveReopenCanonicalExact":true,"expectedCanonical":canonical}))?)?;}
  // Last-note behavior remains exactly the original engine result, without invented page cleanup.
  execute(&mut h,&mut saved,json!({"story":sid,"id":second["id"]}))?;assert!(h.session.active().ok_or("doc")?.doc.story(body).ok_or("body")?.endnotes.is_empty());
  Ok(())
 }
 #[test] fn missing_reference_or_excess_formatting_cannot_mutate_live_document_or_history()->Result<(),Box<dyn std::error::Error>> {
  for fault in ["reference","format"] {
   let mut h=Headless::new();h.call("engine.execute",json!({"command":"file.new","params":{}}))?;
   h.call("engine.execute",json!({"command":"frame.create","params":{"rect":[60,80,360,320],"content":"text","caret":true}}))?;
   let n=h.call("engine.execute",json!({"command":"endnote.insert","params":{"text":"old"}}))?;
   {let st=h.session.active_mut().ok_or("doc")?;let doc=Arc::make_mut(&mut st.doc);if fault=="format"{doc.endnote_options.para_style="x".repeat(4097);}else{doc.story_mut(designcraft_doc::StoryId(n["story"].as_u64().ok_or("story")?)).ok_or("story")?.text.clear();}}
   let before=h.session.active().ok_or("doc")?.doc.clone();let count=h.session.active().ok_or("doc")?.history.undo.len();assert!(endnote_delete_budget(&h,&json!({"story":n["story"],"id":n["id"]})).is_err());assert!(Arc::ptr_eq(&before,&h.session.active().ok_or("doc")?.doc));assert_eq!(h.session.active().ok_or("doc")?.history.undo.len(),count);
  }Ok(())
 }
}
