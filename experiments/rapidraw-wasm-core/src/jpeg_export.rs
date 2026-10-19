//! Post-render JPEG slice of RapidRAW b39884b export_processing.rs (AGPL-3.0-only).
//! Full-resolution rendering must happen BEFORE this resize. This is not export_images.
use image::{
    DynamicImage, ImageEncoder, RgbaImage,
    codecs::jpeg::{JpegEncoder, PixelDensity},
};
use serde::Deserialize;
use std::io::{self, Write};

const MAX_BYTES: usize = 64 * 1024 * 1024;
const ICC: &[u8] = include_bytes!("../assets/sRGB-v2-magic.icc");

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    pub jpeg_quality: u8,
    pub dpi: Option<u16>,
    pub resize: Option<Resize>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Resize {
    mode: Mode,
    value: u32,
    dont_enlarge: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
enum Mode {
    LongEdge,
    ShortEdge,
    Width,
    Height,
}

fn bounded(w: u32, h: u32) -> Result<usize, String> {
    let n = (w as usize)
        .checked_mul(h as usize)
        .and_then(|n| n.checked_mul(4));
    if w == 0 || h == 0 || w > 32768 || h > 32768 || n.is_none_or(|n| n > MAX_BYTES) {
        return Err("JPEG requires nonzero dimensions <=32768 and RGBA8 <=64 MiB".into());
    }
    Ok(n.unwrap())
}

// Preserve native f32 ratio/rounding and mode-specific dontEnlarge behavior.
fn target(w: u32, h: u32, opts: Option<&Resize>) -> (u32, u32) {
    let Some(r) = opts else { return (w, h) };
    let dimension = match r.mode {
        Mode::LongEdge => w.max(h),
        Mode::ShortEdge => w.min(h),
        Mode::Width => w,
        Mode::Height => h,
    };
    if r.dont_enlarge && dimension <= r.value {
        return (w, h);
    }
    let fix_width = match r.mode {
        Mode::LongEdge => w >= h,
        Mode::ShortEdge => w <= h,
        Mode::Width => true,
        Mode::Height => false,
    };
    if fix_width {
        (
            r.value,
            (r.value as f32 * (h as f32 / w as f32)).round() as u32,
        )
    } else {
        (
            (r.value as f32 * (w as f32 / h as f32)).round() as u32,
            r.value,
        )
    }
}

struct Capped<'a>(&'a mut Vec<u8>);
impl Write for Capped<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if bytes.len() > MAX_BYTES.saturating_sub(self.0.len()) {
            return Err(io::Error::other("Encoded JPEG exceeds64 MiB"));
        }
        self.0.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

fn plan(w: u32, h: u32, json: &str) -> Result<(Settings, u32, u32), String> {
    bounded(w, h)?;
    if json.len() > 4096 {
        return Err("JPEG settings exceed4096 bytes".into());
    }
    let settings: Settings = serde_json::from_str(json).map_err(|e| e.to_string())?;
    if !(1..=100).contains(&settings.jpeg_quality)
        || settings.dpi == Some(0)
        || settings
            .resize
            .as_ref()
            .is_some_and(|r| r.value == 0 || r.value > 32768)
    {
        return Err("JPEG quality, DPI or resize value outside supported range".into());
    }
    let (tw, th) = target(w, h, settings.resize.as_ref());
    bounded(tw, th)?;
    // image0.25.10 samples vertically into an RGBA-f32 source-width × target-height
    // intermediate. Aspect fitting can only reduce the requested target rectangle.
    if (tw, th) != (w, h) && u64::from(w) * u64::from(th) * 16 > MAX_BYTES as u64 {
        return Err("JPEG Lanczos intermediate exceeds64 MiB".into());
    }
    Ok((settings, tw, th))
}
/// Validate source/target/intermediate/settings without cloning pixels or rendering.
pub fn preflight(w: u32, h: u32, json: &str) -> Result<(), String> {
    plan(w, h, json).map(|_| ())
}

/// Exact already-rendered RGBA8 only. No metadata copy, border/pad/watermark,
/// path access, file write or preview fallback. Per-buffer caps are not peak RAM protection.
pub fn encode(w: u32, h: u32, pixels: &[u8], json: &str) -> Result<Vec<u8>, String> {
    if pixels.len() != bounded(w, h)? {
        return Err("JPEG input length mismatch".into());
    }
    let (settings, tw, th) = plan(w, h, json)?;
    let mut image =
        DynamicImage::ImageRgba8(RgbaImage::from_raw(w, h, pixels.to_vec()).ok_or("Invalid RGBA")?);
    if (tw, th) != (w, h) {
        image = image.resize(tw, th, image::imageops::FilterType::Lanczos3);
    }
    let rgb_image = image.to_rgb8();
    let mut bytes = Vec::new();
    let mut cursor = Capped(&mut bytes);
    let mut encoder = JpegEncoder::new_with_quality(&mut cursor, settings.jpeg_quality);
    encoder
        .set_icc_profile(ICC.to_vec())
        .map_err(|e| e.to_string())?;
    if let Some(dpi) = settings.dpi {
        encoder.set_pixel_density(PixelDensity::dpi(dpi));
    }
    rgb_image
        .write_with_encoder(encoder)
        .map_err(|e| e.to_string())?;
    Ok(bytes)
}
