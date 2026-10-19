//! Independent source crop-specific working resize, orientation/flip/crop and final encoder.
#[path="../tests/reference/orientation_flip.rs"]
#[rustfmt::skip]
mod original_geometry;
#[path="../tests/reference/crop.rs"]
#[rustfmt::skip]
mod original_crop;
#[path="../tests/reference/rotation.rs"]
#[rustfmt::skip]
mod original_rotation;
#[path="../tests/reference/downscale_f32.rs"]
#[rustfmt::skip]
mod original_downscale;
#[path="../tests/reference/fine_pipeline.rs"]
#[rustfmt::skip]
mod pipeline;
#[path="../tests/reference/preview.rs"]
#[rustfmt::skip]
mod codec;
#[path="../tests/reference/interactive.rs"]
#[rustfmt::skip]
mod native_interactive;
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
        if a.len() != 11 && a.len() != 12 {
            return Err(
                "prepare RGB_F32 WIDTH HEIGHT STEPS HORIZONTAL VERTICAL CROP_JSON ROTATION NEW_DIR [LIVE_QUALITY]"
                    .into(),
            );
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
        let crop: serde_json::Value = serde_json::from_str(&a[8])?;
        let geometry = serde_json::json!({"orientationSteps":steps,"flipHorizontal":horizontal,"flipVertical":vertical,"crop":crop,"rotation":a[9].parse::<f32>()?});
        let (base, scale, offset) = pipeline::compute(image, &geometry, 512);
        let base_width = base.width();
        let interactive = a.len() == 12;
        let (divisor, quality) = if interactive {
            native_interactive::select(&a[11], false)
        } else {
            (1., 94)
        };
        let result = if divisor > 1. {
            let (w, h) = native_interactive::bounds(512, divisor, base.width(), base.height());
            original_downscale::downscale_f32_image(&base, w, h)
        } else {
            base
        };
        let alpha_preserved = matches!(&result, DynamicImage::ImageRgba32F(_));
        let scale = scale * (result.width() as f32 / base_width as f32);
        let rgba = result
            .to_rgba32f()
            .into_raw()
            .into_iter()
            .flat_map(|v| v.to_le_bytes())
            .collect::<Vec<_>>();
        let result = result.into_rgb32f();
        let data = result
            .as_raw()
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect::<Vec<_>>();
        let out = Path::new(&a[10]);
        std::fs::create_dir_all(out)?;
        write(&out.join("rgb.f32"), &data)?;
        write(&out.join("rgba.f32"), &rgba)?;
        let meta = serde_json::json!({"source":"b39884b38d8f148caef6fd0d52afd264951be329","interactive":interactive,"preset":a.get(11),"quality":quality,"divisor":divisor,"alphaPreserved":alpha_preserved,"geometry":geometry,"scaleForGpu":scale,"cropOffset":[offset.0,offset.1],"width":result.width(),"height":result.height(),"rgbSha256":hash(&data),"rgbaInputSha256":hash(&rgba),"baseRgbSha256":hash(&raw),"scope":"Original crop-specific area resize then quarter turn, flips and crop; fine rotation original bilinear fixed-canvas; warp/effects unsupported"});
        write(
            &out.join("input.json"),
            serde_json::to_string_pretty(&meta)?.as_bytes(),
        )?;
        println!("{meta}");
    } else if a.get(1).is_some_and(|s| s == "encode") {
        if a.len() != 5 && a.len() != 6 {
            return Err(
                "encode PREPARED_DIR NATIVE_RENDER_JSON NATIVE_PNG_DIR [FRAME_INDEX]".into(),
            );
        }
        let out = Path::new(&a[2]);
        let mut meta: serde_json::Value =
            serde_json::from_slice(&std::fs::read(out.join("input.json"))?)?;
        let render: serde_json::Value = serde_json::from_slice(&std::fs::read(&a[3])?)?;
        let interactive = meta["interactive"].as_bool().unwrap_or(false);
        let index: usize = if let Some(value) = a.get(5) {
            value.parse()?
        } else if interactive {
            1
        } else {
            0
        };
        let image = image::open(Path::new(&a[4]).join(format!("frame-{index}.png")))?.into_rgba8();
        let w = meta["width"].as_u64().ok_or("width")? as u32;
        let h = meta["height"].as_u64().ok_or("height")? as u32;
        if image.dimensions() != (w, h) || hash(image.as_raw()) != render["frames"][index]["sha256"]
        {
            return Err("Native pixel reference mismatch".into());
        }
        let quality = meta["quality"].as_u64().unwrap_or(94) as u8;
        let response = codec::encode(
            &image,
            quality,
            if interactive {
                Some((0, 0, w, h))
            } else {
                None
            },
        );
        meta["frameIndex"] = index.into();
        if interactive {
            meta["responseSha256"] = hash(&response).into();
            meta["rect"] = serde_json::json!([0, 0, w, h, w, h]);
        }
        meta["inputRgbaF16Sha256"] = render["inputRgbaF16Sha256"].clone();
        meta["jpegSha256"] = hash(if interactive {
            &response[24..]
        } else {
            &response
        })
        .into();
        meta["bytes"] = response.len().into();
        meta["rgbaSha256"] = render["frames"][index]["sha256"].clone();
        meta["adjustmentSha256"] = render["frames"][index]["adjustmentSha256"].clone();
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
