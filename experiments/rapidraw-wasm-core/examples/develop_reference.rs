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

#[path = "../tests/reference/white_balance.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod white_balance;

mod as_shot {
    use crate::{baseline_exposure::RawExposure, white_balance::WhiteBalance};
    #[allow(dead_code)]
    pub struct AsShot {
        pub white_balance: WhiteBalance,
        pub exposure: RawExposure,
    }
}

mod image_processing {
    include!("../tests/reference/wb_color.rs");
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

#[path = "../tests/reference/ui_exposure.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native_ui;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args()
        .nth(1)
        .ok_or("usage: develop_reference RAW_FILE")?;
    if std::env::args().nth(2).as_deref() == Some("--as-shot") {
        let bytes = std::fs::read(path)?;
        let shot = raw_processing::read_as_shot(&bytes).ok_or("Original read_as_shot failed")?;
        let cases = [serde_json::json!({}), serde_json::json!({"temperature":10,"tint":-3}),
            serde_json::json!({"whiteBalance":{"temperature":5500,"tint":12},"temperature":-5,"tint":2}),
            serde_json::json!({"temperature":1e6,"tint":-1e6})].map(|adjustments| {
                let wb = white_balance::from_adjustments(&adjustments, shot.white_balance);
                serde_json::json!({"json":adjustments.to_string(), "whiteBalance":wb,
                    "adaptationLogGains":white_balance::adaptation_log_gains(shot.white_balance,wb),
                    "rgbToLms":white_balance::rgb_to_lms().to_cols_array()})
            });
        println!(
            "{}",
            serde_json::json!({"asShot":{"whiteBalance":shot.white_balance,"exposure":{
            "sceneReferred":shot.exposure.scene_referred,"dngBaseline":shot.exposure.dng_baseline,
            "highlightPreservation":shot.exposure.highlight_preservation}},"cases":cases})
        );
        return Ok(());
    }
    if std::env::args().nth(2).as_deref() == Some("--camera-exposure") {
        let bytes = std::fs::read(path)?;
        let shot = raw_processing::read_as_shot(&bytes).ok_or("Original read_as_shot failed")?;
        let exposure = shot.exposure;
        let mut cases = Vec::new();
        for value in [
            serde_json::Value::Null,
            serde_json::json!({"exposure": 0.8}),
            serde_json::json!({"exposure": 0.8, "baselineExposure":true}),
            serde_json::json!({"exposure": 0.8, "baselineExposure":true, "activeTools":{"basic":false}}),
        ] {
            for baseline in [None, Some(0.0), Some(1.25)] {
                let expected = native_ui::reference_exposure(
                    &value,
                    native_ui::RawExposure {
                        scene_referred: exposure.scene_referred,
                        dng_baseline: exposure.dng_baseline,
                        highlight_preservation: exposure.highlight_preservation,
                    },
                    native_ui::BaselineOptions {
                        baseline_exposure: baseline,
                        compensate_highlight_preservation: true,
                    },
                );
                cases.push(serde_json::json!({"json":value.to_string(),"baselineExposure":baseline,"compensateHighlightPreservation":true,"expectedExposureBits":expected.to_bits()}));
            }
        }
        println!(
            "{}",
            serde_json::json!({"exposure": {
            "sceneReferred": exposure.scene_referred,
            "dngBaseline": exposure.dng_baseline,
            "highlightPreservation": exposure.highlight_preservation,
        }, "cases":cases})
        );
        return Ok(());
    }
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
