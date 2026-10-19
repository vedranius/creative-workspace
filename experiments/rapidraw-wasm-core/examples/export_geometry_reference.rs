//! Independent unchanged native quarter-turn/flip source on full developed RGB.
use image::{DynamicImage, Rgb32FImage};
use std::{fs, io::Write};
#[path="../tests/reference/orientation_flip.rs"]
#[rustfmt::skip]
mod native;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let a: Vec<String> = std::env::args().collect();
    if a.len() != 7 {
        return Err("RGB_FILE WIDTH HEIGHT STEPS FLIP_H NEW_OUTPUT".into());
    }
    let w: u32 = a[2].parse()?;
    let h: u32 = a[3].parse()?;
    if w as u64 * h as u64 * 12 > 64 * 1024 * 1024 {
        return Err("RGB limit".into());
    }
    let raw = fs::read(&a[1])?;
    if raw.len() != w as usize * h as usize * 12 {
        return Err("RGB shape".into());
    }
    let rgb = raw
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes(b.try_into().unwrap()))
        .collect();
    let image =
        DynamicImage::ImageRgb32F(Rgb32FImage::from_raw(w, h, rgb).ok_or("RGB dimensions")?);
    let json = serde_json::json!({"orientationSteps":a[4].parse::<u32>()?,"flipHorizontal":a[5].parse::<bool>()?,"flipVertical":false});
    let out = native::apply_orientation_and_flip(image, &json)
        .into_owned()
        .into_rgb32f();
    fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&a[6])?
        .write_all(bytemuck::cast_slice(out.as_raw()))?;
    Ok(())
}
