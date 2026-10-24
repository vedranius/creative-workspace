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
fn budget(d: &Document) -> Result<(), Box<dyn std::error::Error>> {
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
        "command" => {
            let c = p.get("command").and_then(Value::as_str).ok_or("Missing command")?;
            if !COMMANDS.contains(&c) {
                return Err("Unsupported workspace layout command".into());
            }
            if c=="footnote.insert" { footnote_insert_budget(h,p.get("params").unwrap_or(&Value::Null))?; }
            // Upstream records the old document with the post-edit selection.
            // For admitted note edits, pair that exact history entry with its
            // pre-edit selection, so Undo cannot point beyond an empty/deleted note.
            let note_history = h.session.active().filter(|st| c=="footnote.insert"
                || (matches!(c,"text.insert" | "text.delete" | "edit.clear")
                    && st.selection.text.and_then(|t|t.cell).and_then(|cell|cell.footnote_id()).is_some()))
                .map(|st|(st.doc.clone(),st.selection.clone()));
            let mut result = h.call("engine.execute", p)?;
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
