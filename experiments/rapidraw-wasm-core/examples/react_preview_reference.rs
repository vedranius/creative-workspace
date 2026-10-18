//! Independent original preview encoder on native rendered original UI settings.
#[path = "../tests/reference/preview.rs"]
#[rustfmt::skip]
mod native_preview;
use sha2::{Digest, Sha256};
use std::io::Write;
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 4 {
        return Err("NATIVE_RENDER_JSON NATIVE_PNG_DIR NEW_OUTPUT_DIR".into());
    }
    let raw = std::fs::read(&args[1])?;
    if raw.len() > 32 * 1024 * 1024 {
        return Err("Native reference exceeds32MiB".into());
    }
    let reference: serde_json::Value = serde_json::from_slice(&raw)?;
    if reference["width"] != 512
        || reference["height"] != 384
        || reference["format"] != "rgba8unorm"
        || reference["frames"].as_array().is_none_or(|v| v.len() != 5)
    {
        return Err("Expected bounded five-frame native reference".into());
    }
    let out = std::path::Path::new(&args[3]);
    std::fs::create_dir_all(out)?;
    let mut frames = Vec::new();
    for (i, frame) in reference["frames"].as_array().unwrap().iter().enumerate() {
        let image = image::open(std::path::Path::new(&args[2]).join(format!("frame-{i}.png")))?
            .into_rgba8();
        if image.dimensions() != (512, 384) || hash(image.as_raw()) != frame["sha256"] {
            return Err("Native PNG/pixel reference mismatch".into());
        }
        let jpeg = native_preview::encode(&image, 94, None);
        let name = format!("frame-{i}.jpg");
        let mut f = std::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(out.join(&name))?;
        f.write_all(&jpeg)?;
        f.flush()?;
        frames.push(serde_json::json!({"exposure":([0.0,0.8,-0.8,1.6,0.0][i]),"jpegSha256":hash(&jpeg),"jpegBytes":jpeg.len(),"rgbaSha256":frame["sha256"],"adjustmentSha256":frame["adjustmentSha256"],"file":name}));
    }
    let report =
        serde_json::json!({"source":reference["source"],"width":512,"height":384,"frames":frames});
    let mut f = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(out.join("reference.json"))?;
    f.write_all(serde_json::to_string_pretty(&report)?.as_bytes())?;
    f.flush()?;
    println!("{report}");
    Ok(())
}
