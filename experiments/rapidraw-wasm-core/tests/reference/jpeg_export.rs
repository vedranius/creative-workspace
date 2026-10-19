// Unchanged source types/resize function/JPEG branch from RapidRAW b39884b (AGPL-3.0-only).
use image::{DynamicImage, GenericImageView, ImageEncoder, codecs::jpeg::{JpegEncoder, PixelDensity}};
use serde::{Serialize, Deserialize};
use std::io::Cursor;
const SRGB_ICC_PROFILE: &[u8] = include_bytes!("../../assets/sRGB-v2-magic.icc");
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub enum ResizeMode {
    LongEdge,
    ShortEdge,
    Width,
    Height,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResizeOptions {
    pub mode: ResizeMode,
    pub value: u32,
    pub dont_enlarge: bool,
}

fn calculate_resize_target(
    current_w: u32,
    current_h: u32,
    resize_opts: &ResizeOptions,
) -> (u32, u32) {
    if resize_opts.dont_enlarge {
        let exceeds = match resize_opts.mode {
            ResizeMode::LongEdge => current_w.max(current_h) > resize_opts.value,
            ResizeMode::ShortEdge => current_w.min(current_h) > resize_opts.value,
            ResizeMode::Width => current_w > resize_opts.value,
            ResizeMode::Height => current_h > resize_opts.value,
        };
        if !exceeds {
            return (current_w, current_h);
        }
    }

    let fix_width = match resize_opts.mode {
        ResizeMode::LongEdge => current_w >= current_h,
        ResizeMode::ShortEdge => current_w <= current_h,
        ResizeMode::Width => true,
        ResizeMode::Height => false,
    };

    let value = resize_opts.value;
    if fix_width {
        let h = (value as f32 * (current_h as f32 / current_w as f32)).round() as u32;
        (value, h)
    } else {
        let w = (value as f32 * (current_w as f32 / current_h as f32)).round() as u32;
        (w, value)
    }
}

struct ExportSettings { dpi: Option<u16> }
pub fn encode(mut image: DynamicImage, resize: Option<&ResizeOptions>, jpeg_quality:u8, dpi:Option<u16>) -> Result<Vec<u8>,String> {
    let (src_w,src_h)=image.dimensions();
    let (target_w,target_h)=resize.map(|r|calculate_resize_target(src_w,src_h,r)).unwrap_or((src_w,src_h));
    if target_w != src_w || target_h != src_h {
        image=image.resize(target_w,target_h,image::imageops::FilterType::Lanczos3);
    }
    let export_settings=ExportSettings{dpi};
    let mut image_bytes=Vec::new();
    let mut cursor=Cursor::new(&mut image_bytes);
    match "jpeg" {
        "jpg" | "jpeg" => {
            let rgb_image = image.to_rgb8();
            let mut encoder = JpegEncoder::new_with_quality(&mut cursor, jpeg_quality);
            encoder
                .set_icc_profile(SRGB_ICC_PROFILE.to_vec())
                .map_err(|e| e.to_string())?;
            if let Some(dpi) = export_settings.dpi {
                encoder.set_pixel_density(PixelDensity::dpi(dpi));
            }
            rgb_image
                .write_with_encoder(encoder)
                .map_err(|e| e.to_string())?;
        }
        _=>unreachable!(),
    }
    Ok(image_bytes)
}
