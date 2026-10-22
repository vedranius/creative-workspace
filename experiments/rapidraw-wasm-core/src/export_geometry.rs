//! Full-resolution source geometry; no preview resize or budget enlargement.
use crate::{original_crop::Crop, preview_resize::PreviewPixels};
use image::{DynamicImage, Rgb32FImage};
pub const MAX_PIXELS: u64 = 3 * 1024 * 1024;
pub struct ExportPixels {
    pub pixels: PreviewPixels,
    pub alpha: Option<Vec<f32>>,
}
pub fn plan(
    width: u32,
    height: u32,
    steps: u32,
    rotation: f32,
    crop: Option<Crop>,
) -> Result<(u32, u32), String> {
    if width == 0
        || height == 0
        || width > 4096
        || height > 4096
        || width as u64 * height as u64 > MAX_PIXELS
        || steps > 3
        || !rotation.is_finite()
        || !(-45.0..=45.0).contains(&rotation)
    {
        return Err(
            "Expected bounded full export geometry (4096 axes/3MP, quarter-turn0..3, fine -45..45)"
                .into(),
        );
    }
    let (ow, oh) = if steps % 2 == 1 {
        (height, width)
    } else {
        (width, height)
    };
    if let Some(c) = crop {
        if [c.x, c.y, c.width, c.height]
            .iter()
            .any(|v| !v.is_finite() || v.fract() != 0.)
            || c.x < 0.
            || c.y < 0.
            || c.width < 1.
            || c.height < 1.
            || c.x >= ow as f64
            || c.y >= oh as f64
            || c.width > 32768.
            || c.height > 32768.
        {
            return Err("Expected bounded integer full-image crop".into());
        }
        Ok((
            (ow - c.x as u32).min(c.width as u32),
            (oh - c.y as u32).min(c.height as u32),
        ))
    } else {
        Ok((ow, oh))
    }
}
pub fn transform(
    width: u32,
    height: u32,
    pixels: &[f32],
    steps: u32,
    horizontal: bool,
    vertical: bool,
    rotation: f32,
    crop: Option<Crop>,
) -> Result<ExportPixels, String> {
    // The full input is bounded before any copy, even when output crop is tiny.
    let expected = plan(width, height, steps, rotation, crop)?;
    if pixels.len() != width as usize * height as usize * 3
        || pixels.iter().any(|v| !v.is_finite() || v.abs() > 65504.)
    {
        return Err("Expected exact finite f16-domain full RGB".into());
    }
    // Every RGB/RGBA intermediate stays below64MiB for the3MP slice.
    // This does not bound aggregate live allocations or imageproc internals.
    let image = DynamicImage::ImageRgb32F(
        Rgb32FImage::from_raw(width, height, pixels.to_vec()).ok_or("RGB shape")?,
    );
    let a = serde_json::json!({"orientationSteps":steps,"flipHorizontal":horizontal,"flipVertical":vertical});
    let oriented = crate::original_geometry::apply_orientation_and_flip(image, &a);
    let rotated = crate::original_rotation::apply_rotation(oriented, rotation);
    let result = crate::original_crop::apply_crop(
        rotated,
        &serde_json::to_value(crop).map_err(|e| e.to_string())?,
    )
    .into_owned();
    if (result.width(), result.height()) != expected {
        return Err("Source full geometry dimensions differ from preflight".into());
    }
    let alpha = if rotation != 0. {
        Some(
            result
                .to_rgba32f()
                .as_raw()
                .chunks_exact(4)
                .map(|p| p[3])
                .collect(),
        )
    } else {
        None
    };
    let rgb = result.into_rgb32f();
    Ok(ExportPixels {
        pixels: PreviewPixels {
            width: rgb.width(),
            height: rgb.height(),
            data: rgb.into_raw(),
        },
        alpha,
    })
}
