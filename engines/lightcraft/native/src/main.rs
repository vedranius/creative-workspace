// Contributor-original MIT OR Apache-2.0 engine adapter. No desktop, MCP or model download.
#![forbid(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::todo)]
use lightcraft_catalog::{Op, Photo, PhotoId, Source};
use lightcraft_develop::{DevelopSettings, controls};
use lightcraft_engine::{Selection, Session, export, files};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    io::{self, BufRead, Read, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
const LIMIT: usize = 65536;
const FILE_LIMIT: u64 = 128 * 1024 * 1024;
const PIXELS: u64 = 40_000_000;
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn source_guard_rejects_same_size_changes_and_foreign_paths() -> Result<(), Box<dyn std::error::Error>> {
        let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_nanos();
        let temp = std::env::temp_dir().join(format!("cw-light-guard-{nonce}"));
        std::fs::create_dir_all(temp.join("read"))?;
        let file = temp.join("read/photo.jpg");
        std::fs::write(&file, b"before")?;
        let root = std::fs::canonicalize(temp.join("read"))?;
        let expected = Mutex::new(BTreeMap::from([(std::fs::canonicalize(&file)?, digest(b"before"))]));
        assert!(checked_bytes(&root, &file.to_string_lossy(), &expected).is_ok());
        std::fs::write(&file, b"after!")?;
        assert!(checked_bytes(&root, &file.to_string_lossy(), &expected).is_err());
        std::fs::write(temp.join("private.jpg"), b"private")?;
        assert!(read_source(&root, &temp.join("private.jpg").to_string_lossy()).is_err());
        assert!(read_source(&root, &root.to_string_lossy()).is_err());
        std::fs::remove_dir_all(temp)?;
        Ok(())
    }
    #[test]
    fn every_workspace_slider_has_an_upstream_range() {
        assert_eq!(BASIC.len(), 12);
        for id in BASIC {
            assert!(controls::find(id).is_some());
        }
    }
}
const BASIC: &[&str] = &[
    "light.exposure",
    "light.contrast",
    "light.highlights",
    "light.shadows",
    "light.whites",
    "light.blacks",
    "color.vibrance",
    "color.saturation",
    "effects.texture",
    "effects.clarity",
    "effects.dehaze",
    "detail.sharpenAmount",
];
fn read_source(root: &Path, p: &str) -> Result<(PathBuf, Vec<u8>), String> {
    let file = std::fs::canonicalize(p).map_err(|e| e.to_string())?;
    if !file.starts_with(root) {
        return Err("Input is outside the source root".into());
    }
    let meta = std::fs::metadata(&file).map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err("Choose a regular photo file".into());
    }
    if meta.len() > FILE_LIMIT {
        return Err("Photo exceeds 128 MB".into());
    }
    let mut bytes = Vec::new();
    std::fs::File::open(&file).map_err(|e| e.to_string())?.take(FILE_LIMIT + 1).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() as u64 > FILE_LIMIT {
        return Err("Photo exceeds 128 MB".into());
    }
    Ok((file, bytes))
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn checked_bytes(root: &Path, path: &str, expected: &Mutex<BTreeMap<PathBuf, String>>) -> Result<Vec<u8>, String> {
    let (file, bytes) = read_source(root, path)?;
    let lock = expected.lock().map_err(|_| "Source guard unavailable")?;
    let hash = lock.get(&file).ok_or("This photo was not opened by the workspace session")?;
    if *hash != digest(&bytes) {
        return Err("Original photo changed; reopen it before processing".into());
    }
    Ok(bytes)
}
struct Worker {
    session: Session,
    read: PathBuf,
    write: PathBuf,
    expected: Arc<Mutex<BTreeMap<PathBuf, String>>>,
    saved: Option<Arc<DevelopSettings>>,
}
impl Worker {
    fn new(read: PathBuf, write: PathBuf) -> Self {
        lightcraft_gpu::set_enabled(false);
        let expected = Arc::new(Mutex::new(BTreeMap::new()));
        let mut session = Session::new();
        session.xmp.auto_write = false;
        let guard = expected.clone();
        let root = read.clone();
        session.media.file_loader = Some(Arc::new(move |path, edge| files::load_vec(checked_bytes(&root, path, &guard)?, edge)));
        let guard = expected.clone();
        let root = read.clone();
        session.media.file_bytes = Some(Arc::new(move |path| checked_bytes(&root, path, &guard)));
        Self { session, read, write, expected, saved: None }
    }
    fn state(&self) -> Result<Value, String> {
        let Some(id) = self.session.active() else { return Ok(Value::Null) };
        let Some(photo) = self.session.catalog.photo(id) else { return Ok(Value::Null) };
        let values: BTreeMap<&str, f64> = BASIC.iter().filter_map(|k| controls::get(&photo.develop, k).map(|v| (*k, v))).collect();
        let hash = self.expected.lock().map_err(|_| "Source guard unavailable")?.values().next().cloned().ok_or("Opened source digest is missing")?;
        Ok(
            json!({"name":photo.file_name,"format":photo.format,"width":photo.width,"height":photo.height,"sourceHash":hash,"values":values,"dirty":!self.saved.as_ref().is_some_and(|s|Arc::ptr_eq(s,&photo.develop)),"undo":self.session.undo.last().map(|s|s.label.clone()),"redo":self.session.redo.last().map(|s|s.label.clone())}),
        )
    }
    fn target(&self, p: &Value) -> Result<PathBuf, String> {
        let path = Path::new(p.get("path").and_then(Value::as_str).ok_or("Missing output path")?);
        let parent = std::fs::canonicalize(path.parent().ok_or("Missing output parent")?).map_err(|e| e.to_string())?;
        if !parent.starts_with(&self.write) {
            return Err("Output is outside the private root".into());
        }
        let file = parent.join(path.file_name().ok_or("Missing output filename")?);
        if file.symlink_metadata().is_ok() {
            return Err("Private output already exists".into());
        }
        Ok(file)
    }
    fn answer(&mut self, r: &Value) -> Result<Value, String> {
        let method = r.get("method").and_then(Value::as_str).unwrap_or("");
        let p = r.get("params").cloned().unwrap_or(json!({}));
        match method {
            "__cw_identity" => Ok(json!({"runtimeId":"creative-workspace-lightcraft-v1","version":"0.6.0","processing":"server-cpu"})),
            "controls" => Ok(json!(controls::CONTROLS.iter().filter(|c| BASIC.contains(&c.id)).collect::<Vec<_>>())),
            "state" => self.state(),
            "open" => {
                if self.session.active().is_some() {
                    return Err("One photo per session; close it before opening another".into());
                }
                let input = p.get("path").and_then(Value::as_str).ok_or("Missing input path")?;
                let (file, bytes) = read_source(&self.read, input)?;
                let info = files::probe_bytes(input, &bytes)?;
                if u64::from(info.width) * u64::from(info.height) > PIXELS || info.width == 0 || info.height == 0 {
                    return Err("Photo exceeds the 40 MP prototype limit".into());
                }
                if let Some(reason) = info.preview_only {
                    return Err(format!("This raw format currently has preview-only support: {reason}"));
                }
                self.expected.lock().map_err(|_| "Source guard unavailable")?.insert(file.clone(), digest(&bytes));
                let name = file.file_name().ok_or("Missing input filename")?.to_string_lossy();
                let id = PhotoId(1);
                let mut photo =
                    Photo::new(id, Source::File { path: file.to_string_lossy().into() }, &name, &info.format, info.width, info.height, "");
                photo.kind = info.kind;
                photo.file_size = info.file_size;
                photo.meta = info.meta;
                photo.captured = info.captured;
                photo.as_shot_wb = info.as_shot_wb;
                photo.embedded_lens = info.embedded_lens;
                lightcraft_engine::import::apply_import_defaults(&self.session, &mut photo);
                self.saved = Some(photo.develop.clone());
                self.session.catalog.apply(Op::AddPhoto { photo: Box::new(photo) }).map_err(|e| e.to_string())?;
                self.session.selection = Selection::single(id);
                self.state()
            }
            "set" => {
                let values = p.get("values").and_then(Value::as_object).ok_or("Give numeric control values")?;
                if values.is_empty() || values.len() > BASIC.len() {
                    return Err("Choose 1–12 controls".into());
                }
                for (k, v) in values {
                    let spec = controls::find(k).filter(|_| BASIC.contains(&k.as_str())).ok_or("Unsupported workspace photo control")?;
                    let v = v.as_f64().filter(|v| v.is_finite() && *v >= spec.min && *v <= spec.max).ok_or("Control value is outside its range")?;
                    let _ = v;
                }
                self.session.execute("develop.set", &json!({"values":values})).map_err(|e| e.to_string())?;
                self.state()
            }
            "undo" | "redo" => {
                self.session.execute(if method == "undo" { "edit.undo" } else { "edit.redo" }, &json!({})).map_err(|e| e.to_string())?;
                self.state()
            }
            "render" | "export" => {
                let file = self.target(&p)?;
                let id = self.session.active().ok_or("Open a photo first")?;
                let edge = match p.get("longEdge") {
                    None => {
                        if method == "render" {
                            1280
                        } else {
                            4096
                        }
                    }
                    Some(value) => value.as_u64().ok_or("Output edge must be a positive integer")?,
                };
                if !(16..=4096).contains(&edge) {
                    return Err("Choose an output edge between 16 and 4,096 px".into());
                }
                let format = match p.get("format") {
                    None => "png",
                    Some(value) => value.as_str().ok_or("Output format must be PNG or JPEG")?,
                };
                let format = match format {
                    "png" => export::ExportFormat::Png,
                    "jpeg" => export::ExportFormat::Jpeg,
                    _ => return Err("Choose PNG or JPEG".into()),
                };
                let rendered = self.session.render_now(id, edge as usize, edge as usize)?;
                let opts = export::ExportOptions { format, quality: 92, ..Default::default() };
                let bytes = export::encode_image(&rendered.image, &opts)?;
                let mut output = std::fs::OpenOptions::new().write(true).create_new(true).open(&file).map_err(|e| e.to_string())?;
                output.write_all(&bytes).map_err(|e| e.to_string())?;
                Ok(json!({"width":rendered.image.width,"height":rendered.image.height,"bytes":bytes.len()}))
            }
            "mark_saved" => {
                let id = self.session.active().ok_or("No photo")?;
                self.saved = self.session.develop_of(id);
                self.state()
            }
            _ => Err("Unsupported workspace LightCraft method".into()),
        }
    }
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let read = std::fs::canonicalize(std::env::args_os().nth(1).ok_or("Pass the source root")?)?;
    let write = std::fs::canonicalize(std::env::args_os().nth(2).ok_or("Pass the private output root")?)?;
    let mut worker = Worker::new(read, write);
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
                Ok(r) => match worker.answer(&r) {
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
