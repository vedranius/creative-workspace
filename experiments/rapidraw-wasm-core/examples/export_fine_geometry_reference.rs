//! Independent full source geometry excerpts; never calls the port transform.
use image::{DynamicImage, Rgb32FImage};
use sha2::{Digest, Sha256};
use std::{fs, io::Write};
#[path="../tests/reference/orientation_flip.rs"]
#[rustfmt::skip]
mod original_geometry;
#[path="../tests/reference/rotation.rs"]
#[rustfmt::skip]
mod native_rotation;
#[path="../tests/reference/crop.rs"]
#[rustfmt::skip]
mod native_crop;
fn hash(b: &[u8]) -> String {
    format!("{:x}", Sha256::digest(b))
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let a: Vec<String> = std::env::args().collect();
    if a.len() != 6 {
        return Err("RGB_FILE WIDTH HEIGHT ADJUSTMENTS_JSON NEW_RGBA_FILE".into());
    }
    let w: u32 = a[2].parse()?;
    let h: u32 = a[3].parse()?;
    if w == 0 || h == 0 || w > 4096 || h > 4096 || w as u64 * h as u64 > 3 * 1024 * 1024 {
        return Err("Bounded full native geometry required".into());
    }
    let raw = fs::read(&a[1])?;
    if raw.len() != w as usize * h as usize * 12 {
        return Err("RGB shape".into());
    }
    let rgb: Vec<f32> = raw
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes(b.try_into().unwrap()))
        .collect();
    if rgb.iter().any(|v| !v.is_finite() || v.abs() > 65504.) {
        return Err("Finite f16 domain required".into());
    }
    let j: serde_json::Value = serde_json::from_str(&a[4])?;
    let source =
        DynamicImage::ImageRgb32F(Rgb32FImage::from_raw(w, h, rgb).ok_or("RGB dimensions")?);
    let oriented = original_geometry::apply_orientation_and_flip(source, &j);
    let rotated =
        native_rotation::apply_rotation(oriented, j["rotation"].as_f64().unwrap_or(0.) as f32);
    let out = native_crop::apply_crop(rotated, &j["crop"])
        .into_owned()
        .into_rgba32f();
    let rgba = bytemuck::cast_slice(out.as_raw());
    fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&a[5])?
        .write_all(rgba)?;
    let rgb: Vec<f32> = out
        .as_raw()
        .chunks_exact(4)
        .flat_map(|p| p[..3].iter().copied())
        .collect();
    println!(
        "{}",
        serde_json::json!({"width":out.width(),"height":out.height(),"rgbaF32Sha256":hash(rgba),"rgbF32Sha256":hash(bytemuck::cast_slice(&rgb)),"alphaZero":out.as_raw().chunks_exact(4).filter(|p|p[3]==0.).count()})
    );
    Ok(())
}
