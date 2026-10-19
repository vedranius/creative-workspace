//! Original RapidRAW b39884b lib.rs preview JPEG/envelope boundary (AGPL-3.0).
//! The caller supplies actual EightBit GPU pixels, already resized/cropped.
use imgref::ImgRef;
use mozjpeg_rs::{Encoder, Preset};
use rgb::{FromSlice, RGBA8};

const MAX_BYTES: usize = 64 * 1024 * 1024;

/// Original final quality94 or interactive quality65/75/85. The geometry
/// describes an already-rendered patch, not a request to crop/resize pixels.
#[allow(clippy::too_many_arguments)]
pub fn encode_preview_response(
    width: u32,
    height: u32,
    pixels: &[u8],
    quality: u8,
    interactive: bool,
    x: u32,
    y: u32,
    full_width: u32,
    full_height: u32,
) -> Result<Vec<u8>, String> {
    let count = (width as usize)
        .checked_mul(height as usize)
        .and_then(|n| n.checked_mul(4))
        .ok_or("Preview size overflow")?;
    if width == 0
        || height == 0
        || width > 32768
        || height > 32768
        || full_width == 0
        || full_height == 0
        || full_width > 32768
        || full_height > 32768
        || u64::from(full_width) * u64::from(full_height) * 4 > MAX_BYTES as u64
        || count > MAX_BYTES
        || pixels.len() != count
        || x.checked_add(width).is_none_or(|right| right > full_width)
        || y.checked_add(height)
            .is_none_or(|bottom| bottom > full_height)
    {
        return Err(
            "Preview requires exact bounded RGBA8 and an in-bounds rectangle (64 MiB)".into(),
        );
    }
    if (interactive && ![65, 75, 85].contains(&quality))
        || (!interactive
            && (quality != 94 || x != 0 || y != 0 || width != full_width || height != full_height))
    {
        return Err("Expected original final q94 or interactive q65/75/85 preview".into());
    }
    let rgba8_pixels: &[RGBA8] = pixels.as_rgba();
    let img_ref = ImgRef::new(rgba8_pixels, width as usize, height as usize);
    let jpeg_bytes = Encoder::new(Preset::BaselineFastest)
        .quality(quality)
        .fast_color(true)
        .encode_imgref(img_ref)
        .map_err(|e| format!("Failed to encode preview: {}", e))?;
    // Post-encode cap is not a total allocation limit inside the encoder.
    if jpeg_bytes.len() > MAX_BYTES - 24 {
        return Err("Preview output exceeds64MiB".into());
    }
    if interactive {
        let (rx, ry, roi_w, roi_h, preview_width, preview_height) =
            (x, y, width, height, full_width, full_height);
        let mut response = Vec::with_capacity(24 + jpeg_bytes.len());
        response.extend_from_slice(&rx.to_le_bytes());
        response.extend_from_slice(&ry.to_le_bytes());
        response.extend_from_slice(&roi_w.to_le_bytes());
        response.extend_from_slice(&roi_h.to_le_bytes());
        response.extend_from_slice(&preview_width.to_le_bytes());
        response.extend_from_slice(&preview_height.to_le_bytes());
        response.extend_from_slice(&jpeg_bytes);
        Ok(response)
    } else {
        Ok(jpeg_bytes)
    }
}

/// Exact source generate_uncropped_preview codec: RGBA->RGB, q80, default color conversion.
pub fn encode_uncropped_preview(width: u32, height: u32, pixels: &[u8]) -> Result<Vec<u8>, String> {
    let count = (width as usize)
        .checked_mul(height as usize)
        .and_then(|n| n.checked_mul(4))
        .ok_or("Uncropped size overflow")?;
    if width == 0
        || height == 0
        || width > 32768
        || height > 32768
        || count > MAX_BYTES
        || pixels.len() != count
    {
        return Err("Expected exact bounded uncropped RGBA8".into());
    }
    let rgb_pixels = pixels
        .chunks_exact(4)
        .flat_map(|p| p[..3].iter().copied())
        .collect::<Vec<_>>();
    let bytes = Encoder::new(Preset::BaselineFastest)
        .quality(80)
        .encode_rgb(&rgb_pixels, width, height)
        .map_err(|e| e.to_string())?;
    if bytes.len() > MAX_BYTES {
        return Err("Uncropped JPEG exceeds64MiB".into());
    }
    Ok(bytes)
}
