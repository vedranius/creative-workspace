//! Independent original orientation/flip and final encoder on actual Quality preview.
#[path="../tests/reference/orientation_flip.rs"]
#[rustfmt::skip]
mod native;
#[path="../tests/reference/preview.rs"]
#[rustfmt::skip]
mod codec;
use image::{DynamicImage, Rgb32FImage};
use sha2::{Digest, Sha256};
use std::{io::Write, path::Path};
fn hash(b: &[u8]) -> String {
    format!("{:x}", Sha256::digest(b))
}
fn write(p: &Path, b: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    let mut f = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(p)?;
    f.write_all(b)?;
    f.flush()?;
    Ok(())
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let a = std::env::args().collect::<Vec<_>>();
    if a.get(1).is_some_and(|s| s == "prepare") {
        if a.len() != 9 {
            return Err("prepare RGB_F32 WIDTH HEIGHT STEPS HORIZONTAL VERTICAL NEW_DIR".into());
        }
        let w: u32 = a[3].parse()?;
        let h: u32 = a[4].parse()?;
        let steps: u32 = a[5].parse()?;
        let horizontal: bool = a[6].parse()?;
        let vertical: bool = a[7].parse()?;
        if w == 0 || h == 0 || steps > 3 || w as u64 * h as u64 * 12 > 64 * 1024 * 1024 {
            return Err("Bounded image and quarter turn required".into());
        }
        let raw = std::fs::read(&a[2])?;
        if raw.len() != w as usize * h as usize * 12 {
            return Err("Input shape mismatch".into());
        }
        let values = raw
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes(b.try_into().unwrap()))
            .collect::<Vec<_>>();
        let image = DynamicImage::ImageRgb32F(Rgb32FImage::from_raw(w, h, values).unwrap());
        let geometry = serde_json::json!({"orientationSteps":steps,"flipHorizontal":horizontal,"flipVertical":vertical});
        let result = native::apply_orientation_and_flip(image, &geometry)
            .into_owned()
            .into_rgb32f();
        let data = result
            .as_raw()
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect::<Vec<_>>();
        let out = Path::new(&a[8]);
        std::fs::create_dir_all(out)?;
        write(&out.join("rgb.f32"), &data)?;
        let meta = serde_json::json!({"source":"b39884b38d8f148caef6fd0d52afd264951be329","geometry":geometry,"width":result.width(),"height":result.height(),"rgbSha256":hash(&data),"baseRgbSha256":hash(&raw),"scope":"Original quarter turn then horizontal/vertical flips after original area preview; crop/fine rotation/warp/effects unsupported"});
        write(
            &out.join("input.json"),
            serde_json::to_string_pretty(&meta)?.as_bytes(),
        )?;
        println!("{meta}");
    } else if a.get(1).is_some_and(|s| s == "encode") {
        if a.len() != 5 {
            return Err("encode PREPARED_DIR NATIVE_RENDER_JSON NATIVE_PNG_DIR".into());
        }
        let out = Path::new(&a[2]);
        let mut meta: serde_json::Value =
            serde_json::from_slice(&std::fs::read(out.join("input.json"))?)?;
        let render: serde_json::Value = serde_json::from_slice(&std::fs::read(&a[3])?)?;
        let image = image::open(Path::new(&a[4]).join("frame-0.png"))?.into_rgba8();
        let w = meta["width"].as_u64().ok_or("width")? as u32;
        let h = meta["height"].as_u64().ok_or("height")? as u32;
        if image.dimensions() != (w, h) || hash(image.as_raw()) != render["frames"][0]["sha256"] {
            return Err("Native pixel reference mismatch".into());
        }
        let response = codec::encode(&image, 94, None);
        meta["jpegSha256"] = hash(&response).into();
        meta["bytes"] = response.len().into();
        meta["rgbaSha256"] = render["frames"][0]["sha256"].clone();
        meta["adjustmentSha256"] = render["frames"][0]["adjustmentSha256"].clone();
        write(&out.join("response.jpg"), &response)?;
        write(
            &out.join("reference.json"),
            serde_json::to_string_pretty(&meta)?.as_bytes(),
        )?;
        println!("{meta}");
    } else {
        return Err("Expected prepare or encode".into());
    }
    Ok(())
}
