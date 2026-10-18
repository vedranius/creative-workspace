//! Executes the byte-identical pinned native RapidRAW develop module.
//! Only desktop host types and the orientation entry point are supplied here.
use sha2::{Digest, Sha256};
use std::io::Write;

mod app_settings {
    #[allow(dead_code)]
    pub struct AppSettings {
        pub enable_baseline_exposure: bool,
        pub baseline_exposure: f32,
        pub compensate_highlight_preservation: bool,
    }
}

#[path = "../tests/reference/baseline_exposure.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod baseline_exposure;

mod white_balance {
    #[derive(Clone, Copy)]
    pub struct WhiteBalance;
    impl WhiteBalance {
        pub fn reference() -> Self {
            Self
        }
        pub fn from_camera_neutral(_: &[f32], _: &[f32]) -> Option<Self> {
            Some(Self)
        }
        pub fn from_dual_illuminant_camera_neutral(
            _: &[f32],
            _: &[f32],
            _: &[f32],
        ) -> Option<Self> {
            Some(Self)
        }
    }
}

mod as_shot {
    use crate::{baseline_exposure::RawExposure, white_balance::WhiteBalance};
    #[allow(dead_code)]
    pub struct AsShot {
        pub white_balance: WhiteBalance,
        pub exposure: RawExposure,
    }
}

mod image_processing {
    use image::DynamicImage;
    use rawler::decoders::Orientation;
    // Exact orientation sequence used by the pinned source's apply_orientation.
    pub fn apply_orientation(image: DynamicImage, orientation: Orientation) -> DynamicImage {
        match orientation {
            Orientation::Normal | Orientation::Unknown => image,
            Orientation::HorizontalFlip => image.fliph(),
            Orientation::Rotate180 => image.rotate180(),
            Orientation::VerticalFlip => image.flipv(),
            Orientation::Transpose => image.rotate90().fliph(),
            Orientation::Rotate90 => image.rotate90(),
            Orientation::Transverse => image.rotate270().fliph(),
            Orientation::Rotate270 => image.rotate270(),
        }
    }
}

#[path = "../tests/reference/multi_exposure.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod multi_exposure;

#[path = "../tests/reference/raw_processing.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod raw_processing;

#[path = "../tests/reference/png_encode.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod png_native;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args()
        .nth(1)
        .ok_or("usage: develop_reference RAW_FILE")?;
    let fast_demosaic = std::env::args().nth(2).as_deref() == Some("fast");
    let bytes = std::fs::read(path)?;
    let image =
        raw_processing::develop_raw_image(&bytes, fast_demosaic, 1000.0, "default".into(), None)?;
    // Optional codec-only proof: original developed RGB, no GPU renderer/tone map.
    if let Some(output) = std::env::args().nth(3) {
        let rgb = image::DynamicImage::ImageRgb32F(image.to_rgb32f());
        let png = png_native::encode(&rgb, Some(300))?;
        let mut output = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(output)?;
        output.write_all(&png)?;
        eprintln!(
            "PNG codec reference: {} bytes, SHA256 {:x}",
            png.len(),
            Sha256::digest(&png)
        );
    }
    let rgba = image.as_rgba32f().ok_or("native result is not RGBA32F")?;
    if let Some(output) = std::env::args().nth(4) {
        let file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(output)?;
        let mut file = std::io::BufWriter::new(file);
        for pixel in rgba.pixels() {
            for channel in &pixel.0[..3] {
                file.write_all(&channel.to_le_bytes())?;
            }
        }
        file.flush()?;
    }
    let mut hash = Sha256::new();
    for pixel in rgba.pixels() {
        for channel in &pixel.0[..3] {
            hash.update(channel.to_bits().to_le_bytes());
        }
    }
    let digest = hash
        .finalize()
        .iter()
        .map(|v| format!("{v:02x}"))
        .collect::<String>();
    println!(
        "{{\"width\":{},\"height\":{},\"components\":3,\"pixelCount\":{},\"fastDemosaic\":{},\"rgbF32BitsSha256\":\"{}\"}}",
        rgba.width(),
        rgba.height(),
        rgba.width() as u64 * rgba.height() as u64,
        fast_demosaic,
        digest
    );
    Ok(())
}
