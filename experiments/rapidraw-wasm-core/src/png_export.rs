//! Pinned RapidRAW PNG codec boundary, not a renderer or complete export.
//! Native source: CyberTimon/RapidRAW b39884b, AGPL-3.0-only.
use image::{DynamicImage, ImageBuffer, ImageEncoder, Rgb, codecs::png::PngEncoder};
use std::io::{self, Write};

const SRGB_ICC_PROFILE: &[u8] = include_bytes!("../assets/sRGB-v2-magic.icc");
const MAX_BYTES: usize = 64 * 1024 * 1024;

// The cap applies to encoded output; it is not a total allocator limit.
struct CappedWriter<'a>(&'a mut Vec<u8>);
impl Write for CappedWriter<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if bytes.len() > MAX_BYTES.saturating_sub(self.0.len()) {
            return Err(io::Error::other("Encoded PNG exceeds 64 MiB"));
        }
        self.0.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

struct ExportSettings {
    dpi: Option<u16>,
}

/// Encode already-rendered RGB f32 using native float->RGB16 + sRGB ICC PNG.
/// No tone mapping, GPU adjustments, metadata copy or file writing is implied.
pub fn encode_rgb32f_png(
    width: u32,
    height: u32,
    pixels: &[f32],
    dpi: Option<u16>,
) -> Result<Vec<u8>, String> {
    let count = (width as usize)
        .checked_mul(height as usize)
        .and_then(|n| n.checked_mul(3))
        .ok_or("PNG dimensions overflow")?;
    if width == 0 || height == 0 || width > 32768 || height > 32768 || count > MAX_BYTES / 4 {
        return Err("PNG input exceeds dimension or 64 MiB RGB-f32 budget".into());
    }
    if pixels.len() != count || pixels.iter().any(|v| !v.is_finite()) {
        return Err("PNG requires finite RGB pixels matching dimensions".into());
    }
    let image = DynamicImage::ImageRgb32F(
        ImageBuffer::<Rgb<f32>, _>::from_raw(width, height, pixels.to_vec())
            .ok_or("Invalid RGB dimensions")?,
    );
    encode_png_image(&image, dpi)
}

fn encode_png_image(image: &DynamicImage, dpi: Option<u16>) -> Result<Vec<u8>, String> {
    let export_settings = ExportSettings { dpi };
    let mut image_bytes = Vec::new();
    let mut cursor = CappedWriter(&mut image_bytes);
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
    if image_bytes.len() > MAX_BYTES {
        return Err("Encoded PNG exceeds 64 MiB".into());
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
