//! Bounded wrapper around original neutral-geometry preview sizing and filter.
use image::{DynamicImage, Rgb32FImage};

pub struct PreviewPixels {
    pub width: u32,
    pub height: u32,
    pub data: Vec<f32>,
}
const MAX_BYTES: usize = 64 * 1024 * 1024;
pub(crate) fn samples(width: u32, height: u32) -> Result<usize, String> {
    if width == 0 || height == 0 || width > 32768 || height > 32768 {
        return Err("Preview dimensions must be1..32768".into());
    }
    let count = (width as usize)
        .checked_mul(height as usize)
        .and_then(|n| n.checked_mul(3))
        .ok_or("Preview size overflow")?;
    if count > MAX_BYTES / 4 {
        return Err("Preview RGB exceeds64MiB".into());
    }
    Ok(count)
}
/// Exact compute_transformed_preview size selection for supported neutral geometry.
/// The original downscale helper applies a second f32 aspect/rounding step.
pub fn preview_dimensions(width: u32, height: u32, preview_dim: u32) -> Result<(u32, u32), String> {
    samples(width, height)?;
    if preview_dim == 0 || preview_dim > 32768 {
        return Err("Preview target must be1..32768".into());
    }
    let target_scale = (preview_dim as f64 / (width.max(height) as f64)).min(1.0);
    if target_scale >= 1.0 {
        return Ok((width, height));
    }
    let working_w = ((width as f64 * target_scale).round() as u32).max(1);
    let working_h = ((height as f64 * target_scale).round() as u32).max(1);
    let ratio = (working_w as f32 / width as f32).min(working_h as f32 / height as f32);
    let new_w = (width as f32 * ratio).round() as u32;
    let new_h = (height as f32 * ratio).round() as u32;
    Ok(if new_w == 0 || new_h == 0 {
        (width, height)
    } else {
        (new_w, new_h)
    })
}
pub fn resize_preview(
    width: u32,
    height: u32,
    pixels: &[f32],
    preview_dim: u32,
) -> Result<PreviewPixels, String> {
    let count = samples(width, height)?;
    if pixels.len() != count || pixels.iter().any(|v| !v.is_finite() || v.abs() > 65504.0) {
        return Err("Preview requires exact finite f16-domain RGB input".into());
    }
    let expected = preview_dimensions(width, height, preview_dim)?;
    samples(expected.0, expected.1)?;
    let target_scale = (preview_dim as f64 / (width.max(height) as f64)).min(1.0);
    let source = DynamicImage::ImageRgb32F(
        Rgb32FImage::from_raw(width, height, pixels.to_vec()).ok_or("Preview shape mismatch")?,
    );
    let result = if target_scale < 1.0 {
        let working_w = ((width as f64 * target_scale).round() as u32).max(1);
        let working_h = ((height as f64 * target_scale).round() as u32).max(1);
        crate::original_downscale::downscale_f32_image(&source, working_w, working_h)
    } else {
        source
    };
    let result = result.into_rgb32f();
    if result.dimensions() != expected || result.as_raw().iter().any(|v| !v.is_finite()) {
        return Err("Invalid original preview result".into());
    }
    Ok(PreviewPixels {
        width: result.width(),
        height: result.height(),
        data: result.into_raw(),
    })
}

/// Original generate_uncropped_preview uses square bounds directly, before orientation.
pub fn resize_uncropped(
    width: u32,
    height: u32,
    pixels: &[f32],
    target: u32,
) -> Result<PreviewPixels, String> {
    let count = samples(width, height)?;
    if target == 0
        || target > 32768
        || pixels.len() != count
        || pixels.iter().any(|v| !v.is_finite() || v.abs() > 65504.)
    {
        return Err("Expected bounded uncropped target and finite RGB".into());
    }
    let ratio = (target as f32 / width as f32).min(target as f32 / height as f32);
    let (w, h) = if target >= width && target >= height {
        (width, height)
    } else {
        let w = (width as f32 * ratio).round() as u32;
        let h = (height as f32 * ratio).round() as u32;
        if w == 0 || h == 0 {
            (width, height)
        } else {
            (w, h)
        }
    };
    samples(w, h)?;
    if w as u64 * h as u64 * 76 + 132 > 64 * 1024 * 1024 {
        return Err("Uncropped preview exceeds bounded64MiB GPU payload".into());
    }
    let source = DynamicImage::ImageRgb32F(
        Rgb32FImage::from_raw(width, height, pixels.to_vec()).ok_or("Uncropped shape mismatch")?,
    );
    let result =
        crate::original_downscale::downscale_f32_image(&source, target, target).into_rgb32f();
    if result.dimensions() != (w, h) {
        return Err("Original uncropped size mismatch".into());
    }
    Ok(PreviewPixels {
        width: w,
        height: h,
        data: result.into_raw(),
    })
}
