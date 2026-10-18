//! Independently compiled original filter, on real native Quality RGB input.
#[path="../tests/reference/downscale_f32.rs"]
#[rustfmt::skip]
mod native;
use image::{DynamicImage, Rgb32FImage};
use sha2::{Digest, Sha256};
use std::io::Write;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let a = std::env::args().collect::<Vec<_>>();
    if a.len() != 6 {
        return Err("RGB_F32 WIDTH HEIGHT TARGET NEW_PREVIEW_F32".into());
    }
    let width: u32 = a[2].parse()?;
    let height: u32 = a[3].parse()?;
    let target: u32 = a[4].parse()?;
    if width == 0
        || height == 0
        || width > 32768
        || height > 32768
        || target == 0
        || target > 32768
        || width as u64 * height as u64 * 12 > 64 * 1024 * 1024
    {
        return Err("Bounded RGB dimensions required".into());
    }
    let raw = std::fs::read(&a[1])?;
    if raw.len() != width as usize * height as usize * 12 {
        return Err("RGB length mismatch".into());
    }
    let values = raw
        .chunks_exact(4)
        .map(|v| f32::from_le_bytes(v.try_into().unwrap()))
        .collect::<Vec<_>>();
    if values.iter().any(|v| !v.is_finite()) {
        return Err("Nonfinite RGB".into());
    }
    let source = DynamicImage::ImageRgb32F(Rgb32FImage::from_raw(width, height, values).unwrap());
    // Neutral-geometry compute_transformed_preview dimension order, original f64 math.
    let full_w = width as f64;
    let full_h = height as f64;
    let target_scale = (target as f64 / full_w.max(full_h)).min(1.0);
    let preview = if target_scale < 1.0 {
        let working_w = ((width as f64 * target_scale).round() as u32).max(1);
        let working_h = ((height as f64 * target_scale).round() as u32).max(1);
        native::downscale_f32_image(&source, working_w, working_h)
    } else {
        source
    };
    let preview = preview.into_rgb32f();
    let data = preview
        .as_raw()
        .iter()
        .flat_map(|v| v.to_le_bytes())
        .collect::<Vec<_>>();
    let mut f = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&a[5])?;
    f.write_all(&data)?;
    f.flush()?;
    println!(
        "{}",
        serde_json::json!({"source":"b39884b38d8f148caef6fd0d52afd264951be329","originalWidth":width,"originalHeight":height,"originalRgbSha256":format!("{:x}",Sha256::digest(raw)),"target":target,"width":preview.width(),"height":preview.height(),"rgbSha256":format!("{:x}",Sha256::digest(&data)),"scaleForGpu":(preview.width() as f64/full_w) as f32,"scope":"Original neutral geometry dimensions and exact area downscale; no crop/rotation/patch/effects"})
    );
    Ok(())
}
