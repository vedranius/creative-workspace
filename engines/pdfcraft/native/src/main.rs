// Contributor-original stdio adapter, licensed MIT OR Apache-2.0.
// PdfCraft algorithms remain in the pinned upstream headless engine.
use base64::Engine as _;
use pdfcraft_automation::{Automation, Content};
use serde_json::{Value, json};
use std::io::{self, BufRead, Read, Write};

const LIMIT: usize = 65536;
const TOOLS: &[&str] = &[
    "doc_open",
    "doc_create",
    "doc_list",
    "doc_info",
    "doc_close",
    "doc_save",
    "render_preview",
    "page_rotate",
    "page_delete",
    "page_move",
    "comment_add",
    "comment_list",
    "edit_undo",
    "edit_redo",
    "doc_set_info",
    "text_extract",
];

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = std::env::args_os().nth(1).ok_or("Pass the isolated session directory")?;
    let mut engine = Automation::new().with_root(root)?;
    let mut input = io::stdin().lock();
    let mut output = io::stdout().lock();
    loop {
        let mut line = Vec::new();
        if Read::by_ref(&mut input).take((LIMIT + 1) as u64).read_until(b'\n', &mut line)? == 0 {
            break;
        }
        if line.len() > LIMIT {
            if line.last() != Some(&b'\n') {
                loop {
                    let chunk = input.fill_buf()?;
                    if chunk.is_empty() {
                        break;
                    }
                    let end = chunk.iter().position(|byte| *byte == b'\n');
                    let length = end.map_or(chunk.len(), |at| at + 1);
                    input.consume(length);
                    if end.is_some() {
                        break;
                    }
                }
            }
            serde_json::to_writer(&mut output, &json!({"id":null,"ok":false,"error":"Request exceeds 64 KB"}))?;
        } else {
            let request = serde_json::from_slice::<Value>(&line);
            let reply = match request {
                Err(_) => json!({"id":null,"ok":false,"error":"Invalid JSON request"}),
                Ok(request) => {
                    let id = request.get("id").cloned().unwrap_or(Value::Null);
                    let method = request.get("method").and_then(Value::as_str).unwrap_or("");
                    if method == "__cw_identity" {
                        json!({"id":id,"ok":true,"result":{"runtimeId":"creative-workspace-pdfcraft-v1","version":"0.5.0"}})
                    } else if method == "export_copy" {
                        let result = (|| -> Result<Value, Box<dyn std::error::Error>> {
                            let params = request.get("params").ok_or("Missing export params")?;
                            let doc = params.get("doc").and_then(Value::as_u64).ok_or("Invalid document")?;
                            let path = params.get("path").and_then(Value::as_str).ok_or("Missing output path")?;
                            let bytes = engine.session().save_full_bytes(pdfcraft_engine::DocId(doc))?;
                            engine.write_output(path, &bytes)?;
                            Ok(json!({"content":[{"type":"json","value":{"doc":doc,"bytes":bytes.len()}}]}))
                        })();
                        match result {
                            Ok(value) => json!({"id":id,"ok":true,"result":value}),
                            Err(error) => json!({"id":id,"ok":false,"error":error.to_string()}),
                        }
                    } else if !TOOLS.contains(&method) {
                        json!({"id":id,"ok":false,"error":"Unsupported workspace PDF method"})
                    } else {
                        let params = request.get("params").cloned().unwrap_or(json!({}));
                        match engine.call(method, &params) {
                            Err(error) => json!({"id":id,"ok":false,"error":error.to_string()}),
                            Ok(contents) => {
                                let contents: Vec<Value> = contents.into_iter().map(|item| match item {
                                    Content::Json(value) => json!({"type":"json","value":value}),
                                    Content::Png {data,width,height} => json!({"type":"png","base64":base64::engine::general_purpose::STANDARD.encode(data),"width":width,"height":height}),
                                }).collect();
                                json!({"id":id,"ok":true,"result":{"content":contents}})
                            }
                        }
                    }
                }
            };
            let bytes = serde_json::to_vec(&reply)?;
            if bytes.len() > 32 * 1024 * 1024 {
                serde_json::to_writer(&mut output, &json!({"id":reply.get("id"),"ok":false,"error":"Reply exceeds 32 MB"}))?;
            } else {
                output.write_all(&bytes)?;
            }
        }
        output.write_all(b"\n")?;
        output.flush()?;
    }
    Ok(())
}
