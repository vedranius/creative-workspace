//! Full native rendered PNG -> independent source JPEG vs bounded codec.
use cw_rapidraw_wasm_probe::jpeg_export;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::Path,
};
#[path="../tests/reference/jpeg_export.rs"]
#[rustfmt::skip]
mod native;
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn save(p: &Path, bytes: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(p)?
        .write_all(bytes)?;
    Ok(())
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 && args.len() != 4 {
        return Err(
            "usage: jpeg_export_reference FULL_NATIVE_RENDER.png NEW_OUTPUT_DIR [SETTINGS_JSON]"
                .into(),
        );
    }
    let out = Path::new(&args[2]);
    fs::create_dir(out)?;
    let image = image::open(&args[1])?;
    let rgba = image.to_rgba8();
    let (w, h) = rgba.dimensions();
    save(&out.join("input.rgba8"), rgba.as_raw())?;
    let settings = if let Some(custom) = args.get(3) {
        if custom.len() > 4096 {
            return Err("Settings exceed4KiB".into());
        }
        jpeg_export::preflight(w, h, custom)?;
        vec![serde_json::from_str(custom)?]
    } else {
        vec![
            json!({"jpegQuality":90,"dpi":300}),
            json!({"jpegQuality":90}),
            json!({"jpegQuality":75,"dpi":72,"resize":{"mode":"longEdge","value":1024,"dontEnlarge":true}}),
            json!({"jpegQuality":100,"dpi":65535,"resize":{"mode":"shortEdge","value":384,"dontEnlarge":false}}),
            json!({"jpegQuality":1,"resize":{"mode":"width","value":777,"dontEnlarge":false}}),
            json!({"jpegQuality":90,"dpi":300,"resize":{"mode":"height","value":333,"dontEnlarge":false}}),
            json!({"jpegQuality":90,"resize":{"mode":"longEdge","value":4096,"dontEnlarge":true}}),
        ]
    };
    let mut cases = Vec::new();
    for (i, s) in settings.iter().enumerate() {
        let resize = s
            .get("resize")
            .filter(|r| !r.is_null())
            .map(|r| serde_json::from_value(r.clone()).unwrap());
        let reference = native::encode(
            image.clone(),
            resize.as_ref(),
            s["jpegQuality"].as_u64().unwrap() as u8,
            s.get("dpi").and_then(|v| v.as_u64()).map(|v| v as u16),
        )?;
        assert_eq!(
            reference,
            jpeg_export::encode(w, h, rgba.as_raw(), &s.to_string())?
        );
        save(&out.join(format!("case-{i}.jpg")), &reference)?;
        cases.push(json!({"settings":s,"bytes":reference.len(),"sha256":hash(&reference),"file":format!("case-{i}.jpg")}));
    }
    let report = json!({"scope":"post-render codec only; full native rendered public DNG input, not browser full export_images","width":w,"height":h,"inputRgba8Sha256":hash(rgba.as_raw()),"cases":cases});
    save(
        &out.join("reference.json"),
        serde_json::to_string_pretty(&report)?.as_bytes(),
    )?;
    println!("{}", report);
    Ok(())
}
