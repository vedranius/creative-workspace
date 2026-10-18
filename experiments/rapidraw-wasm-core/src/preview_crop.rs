//! Source crop-specific preview sizing, guarded before allocations. No fine rotation/warp.
use crate::{
    original_crop::Crop,
    preview_resize::{PreviewPixels, samples},
};
use image::{DynamicImage, Rgb32FImage};
#[derive(Debug)]
pub struct CropPlan {
    pub requested_width: u32,
    pub requested_height: u32,
    pub working_width: u32,
    pub working_height: u32,
    pub output_width: u32,
    pub output_height: u32,
    pub scaled_crop: Option<Crop>,
    pub full_width: f64,
    pub full_height: f64,
    pub offset: [f32; 2],
}
pub struct CroppedPreview {
    pub pixels: PreviewPixels,
    pub scale: f32,
    pub offset: [f32; 2],
}
pub fn plan(
    width: u32,
    height: u32,
    target: u32,
    steps: u32,
    crop: Option<Crop>,
) -> Result<CropPlan, String> {
    samples(width, height)?;
    if steps > 3 || target == 0 || target > 32768 {
        return Err("Invalid crop orientation/target".into());
    }
    let (ow, oh) = if steps % 2 == 1 {
        (height, width)
    } else {
        (width, height)
    };
    let (fw, fh) = if let Some(c) = crop {
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
        (
            ((ow as f64) - c.x).min(c.width),
            ((oh as f64) - c.y).min(c.height),
        )
    } else {
        (ow as f64, oh as f64)
    };
    let target_scale = (target as f64 / fw.max(fh)).min(1.);
    let requested_width = ((width as f64 * target_scale).round() as u32).max(1);
    let requested_height = ((height as f64 * target_scale).round() as u32).max(1);
    let (ww, wh) = if target_scale < 1. {
        let w = ((width as f64 * target_scale).round() as u32).max(1);
        let h = ((height as f64 * target_scale).round() as u32).max(1);
        let ratio = (w as f32 / width as f32).min(h as f32 / height as f32);
        let a = (width as f32 * ratio).round() as u32;
        let b = (height as f32 * ratio).round() as u32;
        if a == 0 || b == 0 {
            (width, height)
        } else {
            (a, b)
        }
    } else {
        (width, height)
    };
    samples(ww, wh)?;
    let scale = ww as f64 / width.max(1) as f64;
    let sc = crop.map(|c| Crop {
        x: c.x * scale,
        y: c.y * scale,
        width: (c.width * scale).min(target as f64),
        height: (c.height * scale).min(target as f64),
    });
    let (mut w, mut h) = if steps % 2 == 1 { (wh, ww) } else { (ww, wh) };
    if let Some(c) = sc {
        let x = c.x.round() as u32;
        let y = c.y.round() as u32;
        let cw = c.width.round() as u32;
        let ch = c.height.round() as u32;
        // Native apply_crop silently keeps the image when rounding erases a crop.
        // Refuse that input explicitly rather than present an uncropped success.
        if x >= w || y >= h || cw == 0 || ch == 0 {
            return Err("Crop disappears at preview resolution".into());
        }
        w = (w - x).min(cw);
        h = (h - y).min(ch);
    }
    samples(w, h)?;
    if w as u64 * h as u64 * 76 + 132 > 64 * 1024 * 1024 {
        return Err("Crop preview exceeds64MiB GPU payload".into());
    }
    Ok(CropPlan {
        requested_width,
        requested_height,
        working_width: ww,
        working_height: wh,
        output_width: w,
        output_height: h,
        scaled_crop: sc,
        full_width: fw,
        full_height: fh,
        offset: crop.map_or([0., 0.], |c| [c.x as f32, c.y as f32]),
    })
}
pub fn crop_preview(
    width: u32,
    height: u32,
    pixels: &[f32],
    target: u32,
    steps: u32,
    horizontal: bool,
    vertical: bool,
    crop: Option<Crop>,
) -> Result<CroppedPreview, String> {
    let p = plan(width, height, target, steps, crop)?;
    if pixels.len() != samples(width, height)?
        || pixels.iter().any(|v| !v.is_finite() || v.abs() > 65504.)
    {
        return Err("Expected exact finite f16-domain RGB".into());
    }
    let source = DynamicImage::ImageRgb32F(
        Rgb32FImage::from_raw(width, height, pixels.to_vec()).ok_or("Crop shape mismatch")?,
    );
    let working = if (p.working_width, p.working_height) != (width, height) {
        crate::original_downscale::downscale_f32_image(
            &source,
            p.requested_width,
            p.requested_height,
        )
    } else {
        source
    };
    let a = serde_json::json!({"orientationSteps":steps,"flipHorizontal":horizontal,"flipVertical":vertical});
    let oriented = crate::original_geometry::apply_orientation_and_flip(working, &a);
    let result = crate::original_crop::apply_crop(
        oriented,
        &serde_json::to_value(p.scaled_crop).map_err(|e| e.to_string())?,
    )
    .into_owned()
    .into_rgb32f();
    if result.dimensions() != (p.output_width, p.output_height) {
        return Err("Original crop dimensions differ from preflight".into());
    }
    Ok(CroppedPreview {
        scale: (result.width() as f64 / p.full_width) as f32,
        offset: p.offset,
        pixels: PreviewPixels {
            width: result.width(),
            height: result.height(),
            data: result.into_raw(),
        },
    })
}
