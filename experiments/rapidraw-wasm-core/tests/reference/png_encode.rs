// Native RapidRAW b39884b PNG branch/ICC/DPI helpers, AGPL-3.0-only.
use image::{DynamicImage, ImageEncoder, codecs::png::PngEncoder};
use std::io::Cursor;
const SRGB_ICC_PROFILE: &[u8] = include_bytes!("../../assets/sRGB-v2-magic.icc");
struct ExportSettings { dpi: Option<u16> }
pub fn encode(image: &DynamicImage, dpi: Option<u16>) -> Result<Vec<u8>, String> {
    let export_settings = ExportSettings { dpi };
    let mut image_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut image_bytes);
    match "png" {
        "png" => {
            let image_to_encode = if image.as_rgb32f().is_some() {
                DynamicImage::ImageRgb16(image.to_rgb16())
            } else {
                image.clone()
            };

            let mut encoder = PngEncoder::new(&mut cursor);
            encoder
                .set_icc_profile(SRGB_ICC_PROFILE.to_vec())
                .map_err(|e| e.to_string())?;
            image_to_encode
                .write_with_encoder(encoder)
                .map_err(|e| e.to_string())?;
            if let Some(dpi) = export_settings.dpi {
                insert_png_phys_chunk(&mut image_bytes, dpi);
            }
        }
        _ => unreachable!(),
    }
    Ok(image_bytes)
}

fn insert_png_phys_chunk(image_bytes: &mut Vec<u8>, dpi: u16) {
    let pixels_per_meter = (f64::from(dpi) / 0.0254).round() as u32;
    let mut data = Vec::with_capacity(9);
    data.extend_from_slice(&pixels_per_meter.to_be_bytes());
    data.extend_from_slice(&pixels_per_meter.to_be_bytes());
    data.push(1);
    exif_processing::insert_png_chunk(image_bytes, b"pHYs", &data);
}

mod exif_processing {
pub fn insert_png_chunk(image_bytes: &mut Vec<u8>, chunk_type: &[u8; 4], data: &[u8]) {
    const IHDR_END: usize = 33;

    if image_bytes.len() < IHDR_END || &image_bytes[12..16] != b"IHDR" {
        return;
    }

    let mut crc = crc32fast::Hasher::new();
    crc.update(chunk_type);
    crc.update(data);

    let mut chunk = Vec::with_capacity(data.len() + 12);
    chunk.extend_from_slice(&(data.len() as u32).to_be_bytes());
    chunk.extend_from_slice(chunk_type);
    chunk.extend_from_slice(data);
    chunk.extend_from_slice(&crc.finalize().to_be_bytes());
    image_bytes.splice(IHDR_END..IHDR_END, chunk);
}
}
