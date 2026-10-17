// Contributor-original MIT OR Apache-2.0 adapter. No desktop/MCP server.
#![forbid(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::todo)]
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
fn budget(d: &Document) -> Result<(), Box<dyn std::error::Error>> {
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
            v["selection"] = serde_json::to_value(selection)?;
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
            Ok(h.call("engine.execute", p)?)
        }
        "render" => {
            let st = h.session.active().ok_or("No document")?;
            let index = p.get("page").and_then(Value::as_u64).unwrap_or(0) as usize;
            let page = st.doc.page(index).ok_or("Unknown page")?;
            Ok(h.call("ui.render", json!({"page":index,"scale":(1280.0/page.width.max(page.height)).min(1.0)}))?)
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
            if let Some(o) = value.as_object_mut() { o.remove("path"); }
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
