// Contributor-original adapter, MIT OR Apache-2.0. No desktop or MCP server is started.
use serde_json::{Value, json};
use std::io::{self, BufRead, Read, Write};
use std::sync::Arc;
use vectorcraft_doc::Document;
use vectorcraft_engine::file_access::{self, AutomationRoots};
use vectorcraft_mcp::{Backend, Headless};

const LIMIT: usize = 65536;
const COMMANDS: &[&str] = &[
    "shape.rectangle",
    "shape.ellipse",
    "shape.polygon",
    "shape.star",
    "path.create",
    "select.set",
    "select.all",
    "select.deselect",
    "paint.setFill",
    "paint.setStroke",
    "object.transform",
    "edit.clear",
    "edit.undo",
    "edit.redo",
];

fn answer(h: &mut Headless, saved: &mut Option<Arc<Document>>, r: &Value) -> Result<Value, String> {
    let method = r.get("method").and_then(Value::as_str).unwrap_or("");
    let p = r.get("params").cloned().unwrap_or(json!({}));
    match method {
        "__cw_identity" => Ok(json!({"runtimeId":"creative-workspace-vectorcraft-v1","version":"0.8.0"})),
        "state" => {
            let Some(st) = h.session.active() else { return Ok(Value::Null) };
            let clean = saved.as_ref().is_some_and(|d| Arc::ptr_eq(d, &st.doc));
            let v = h.call("document.inspect", json!({"depth":6,"childLimit":200}))?;
            let mut out = json!({"dirty":!clean});
            for k in ["title", "artboards", "layers", "selection", "selectionBounds", "history", "redo", "objects", "paint"] {
                out[k] = v.get(k).cloned().unwrap_or(Value::Null);
            }
            Ok(out)
        }
        "open" | "new" => {
            if h.session.active().is_some() {
                return Err("One document per workspace session; save and close it before opening another".into());
            }
            let out = if method == "open" { h.call("app.open", p)? } else { h.call("engine.execute", json!({"command":"file.new","params":p}))? };
            if method == "open" {
                *saved = h.session.active().map(|s| s.doc.clone());
            }
            // Only return warnings, never engine paths or linked file locations.
            Ok(json!({"warnings":out.get("warnings").cloned().unwrap_or(json!([]))}))
        }
        "command" => {
            let c = p.get("command").and_then(Value::as_str).ok_or("Missing command")?;
            if !COMMANDS.contains(&c) {
                return Err("Unsupported workspace vector command".into());
            }
            h.call("engine.execute", p)
        }
        "render" => {
            let st = h.session.active().ok_or("Open a document first")?;
            let index = p.get("artboard").and_then(Value::as_u64).unwrap_or(0) as usize;
            let rect = st.doc.artboards.get(index).ok_or("Unknown artboard")?.rect;
            let side = rect.width().max(rect.height());
            if !side.is_finite() || side <= 0.0 || side > 100000.0 {
                return Err("Artboard size is outside the preview limit".into());
            }
            // Upstream clamps scale to at least .01, hence this explicit size bound.
            h.call("ui.render", json!({"artboard":index,"scale":(1280.0/side).min(1.0)}))
        }
        "export" => {
            let f = p.get("format").and_then(Value::as_str).ok_or("Choose an export format")?;
            if !["vectorcraft", "svg", "pdf", "png"].contains(&f) {
                return Err("Unsupported export format".into());
            }
            // document.export does not mark the document saved or reset its undo history.
            h.call("app.export", p)
        }
        "mark_saved" => {
            *saved = Some(h.session.active().ok_or("No document")?.doc.clone());
            Ok(json!({"saved":true}))
        }
        _ => Err("Unsupported workspace vector method".into()),
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let read = std::env::args_os().nth(1).ok_or("Pass the source root")?;
    let write = std::env::args_os().nth(2).ok_or("Pass the private output root")?;
    let roots = AutomationRoots::new(Some(std::path::Path::new(&read)), Some(std::path::Path::new(&write)))?.ok_or("Missing confinement roots")?;
    if !file_access::confine_process(roots.clone()) {
        return Err("Could not enable process confinement".into());
    }
    let mut h = Headless::new().with_automation_roots(Some(roots));
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
                Ok(r) => match answer(&mut h, &mut saved, &r) {
                    Ok(result) => json!({"id":r.get("id"),"ok":true,"result":result}),
                    Err(e) => json!({"id":r.get("id"),"ok":false,"error":e}),
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
