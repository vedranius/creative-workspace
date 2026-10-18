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

#[derive(serde::Serialize)]
struct GpuMat3 {
    col0: [f32; 4],
    col1: [f32; 4],
    col2: [f32; 4],
}
use glam::Mat3;
fn mat3_to_gpu_mat3(m: Mat3) -> GpuMat3 {
    GpuMat3 {
        col0: [m.x_axis.x, m.x_axis.y, m.x_axis.z, 0.0],
        col1: [m.y_axis.x, m.y_axis.y, m.y_axis.z, 0.0],
        col2: [m.z_axis.x, m.z_axis.y, m.z_axis.z, 0.0],
    }
}

#[path = "../tests/reference/global_module.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native_global;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args()
        .nth(1)
        .ok_or("usage: develop_reference RAW_FILE")?;
    let react_render = std::env::args().nth(2).as_deref() == Some("--react-render");
    let full_global = react_render || std::env::args().nth(2).as_deref() == Some("--global-render");
    if full_global || std::env::args().nth(2).as_deref() == Some("--camera-render") {
        let bytes = std::fs::read(path)?;
        let as_shot = raw_processing::read_as_shot(&bytes).ok_or("Original read_as_shot failed")?;
        let mut inputs = [
            serde_json::json!({"exposure":-0.8,"baselineExposure":true}),
            serde_json::json!({"exposure":0,"temperature":10,"tint":-3,"baselineExposure":true}),
            serde_json::json!({"exposure":0.8,"whiteBalance":{"temperature":5500,"tint":12},"temperature":-5,"tint":2,"baselineExposure":true}),
            serde_json::json!({"exposure":0.8,"temperature":10,"tint":-3,"baselineExposure":true,"activeTools":{"whiteBalance":false}}),
            serde_json::json!({"exposure":0,"temperature":10,"tint":-3,"baselineExposure":false,"sectionVisibility":{"color":false}}),
        ];
        if full_global && !react_render {
            inputs[0]["brightness"] = serde_json::json!(12);
            inputs[0]["contrast"] = serde_json::json!(15);
            inputs[0]["highlights"] = serde_json::json!(-10);
            inputs[0]["shadows"] = serde_json::json!(20);
            inputs[0]["whites"] = serde_json::json!(-5);
            inputs[0]["blacks"] = serde_json::json!(8);
            inputs[1]["saturation"] = serde_json::json!(10);
            inputs[1]["vibrance"] = serde_json::json!(20);
            inputs[1]["curves"] = serde_json::json!({"luma":[{"x":0,"y":0},{"x":96,"y":80},{"x":255,"y":255}],"red":[{"x":0,"y":0},{"x":128,"y":140},{"x":255,"y":255}]});
            inputs[2]["hsl"] = serde_json::json!({"reds":{"hue":4,"saturation":10,"luminance":-5}});
            inputs[2]["colorGrading"] =
                serde_json::json!({"global":{"hue":30,"saturation":8,"luminance":2}});
            inputs[2]["colorCalibration"] = serde_json::json!({"redHue":4,"blueSaturation":10});
            inputs[3]["brightness"] = serde_json::json!(25);
            inputs[3]["activeTools"]["basic"] = serde_json::json!(false);
            inputs[4]["toneMapper"] = serde_json::json!("agx");
        }
        if react_render {
            let path = std::env::args()
                .nth(3)
                .ok_or("Original default adjustments JSON required")?;
            let json = std::fs::read(path)?;
            if json.len() > 65536 {
                return Err("Default adjustment input exceeds64KiB".into());
            }
            let defaults: serde_json::Value = serde_json::from_slice(&json)?;
            if !defaults.is_object() {
                return Err("Expected original defaults object".into());
            }
            for (input, exposure) in inputs.iter_mut().zip([0.0, 0.8, -0.8, 1.6, 0.0]) {
                *input = defaults.clone();
                input["exposure"] = serde_json::json!(exposure);
            }
        }
        let mut frames = Vec::new();
        for input in inputs {
            let js_adjustments = &input;
            let target_white_balance = if native_ui::is_tool_active(js_adjustments, "whiteBalance")
            {
                white_balance::from_adjustments(js_adjustments, as_shot.white_balance)
            } else {
                as_shot.white_balance
            };
            let gains =
                white_balance::adaptation_log_gains(as_shot.white_balance, target_white_balance);
            let rgb_to_lms = white_balance::rgb_to_lms();
            let exposure = native_ui::reference_exposure(
                &js_adjustments,
                native_ui::RawExposure {
                    scene_referred: as_shot.exposure.scene_referred,
                    dng_baseline: as_shot.exposure.dng_baseline,
                    highlight_preservation: as_shot.exposure.highlight_preservation,
                },
                native_ui::BaselineOptions {
                    baseline_exposure: Some(0.0),
                    compensate_highlight_preservation: true,
                },
            );
            let mut frame = serde_json::json!({"json":js_adjustments.to_string(),"exposure":exposure,"gains":gains,
                "rgbToLms":mat3_to_gpu_mat3(rgb_to_lms),"lmsToRgb":mat3_to_gpu_mat3(rgb_to_lms.inverse())});
            if full_global {
                frame["global"] = serde_json::to_value(native_global::reference(
                    js_adjustments,
                    gains,
                    exposure,
                    None,
                ))?;
            }
            frames.push(frame);
        }
        println!(
            "{}",
            serde_json::json!({"source":"b39884b38d8f148caef6fd0d52afd264951be329",
            "asShot":{"whiteBalance":as_shot.white_balance,"exposure":{"sceneReferred":as_shot.exposure.scene_referred,"dngBaseline":as_shot.exposure.dng_baseline,"highlightPreservation":as_shot.exposure.highlight_preservation}},
            "options":{"baselineExposure":0.0,"compensateHighlightPreservation":true},"fullGlobal":full_global,"frames":frames})
        );
        return Ok(());
    }
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
