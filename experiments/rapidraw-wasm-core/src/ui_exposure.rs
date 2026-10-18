//! Original native exposure-control mapping only; not the complete UI parser.
//! CyberTimon/RapidRAW b39884b, AGPL-3.0-only; exact source helper excerpts below.
use crate::exposure::{BaselineOptions, RawExposure};
use serde_json::Value;
#[derive(Clone, Copy)]
pub struct AsShot {
    pub exposure: RawExposure,
}

/// Interpret original top-level exposure, tool visibility and baseline marker.
/// Camera exposure/settings are explicit inputs; this does not parse a RAW file.
pub fn map_ui_exposure(
    json: &str,
    exposure: RawExposure,
    options: BaselineOptions,
) -> Result<f32, String> {
    if json.len() > 64 * 1024 {
        return Err("UI exposure input exceeds 64 KiB".into());
    }
    if !exposure.dng_baseline.is_finite()
        || !exposure.highlight_preservation.is_finite()
        || options.baseline_exposure.is_some_and(|v| !v.is_finite())
    {
        return Err("Camera exposure/settings must be finite".into());
    }
    let value: Value =
        serde_json::from_str(json).map_err(|e| format!("Invalid adjustment JSON: {e}"))?;
    if !value.is_null() && !value.is_object() {
        return Err("Expected null or an adjustment object".into());
    }
    let stops = mapped_exposure(&value, AsShot { exposure }, options);
    if !stops.is_finite() {
        return Err("Mapped exposure overflows".into());
    }
    Ok(stops)
}

/// Only exposure is mapped; all other fields remain the explicit neutral fixture.
pub fn pack_ui_exposure_fixture(
    json: &str,
    exposure: RawExposure,
    options: BaselineOptions,
) -> Result<Vec<u8>, String> {
    crate::renderer_adjustments::pack_neutral_exposure(map_ui_exposure(json, exposure, options)?)
}

const BASELINE_EXPOSURE_KEY: &str = "baselineExposure";

fn is_section_visible(adjustments: &serde_json::Value, section: &str) -> bool {
    adjustments
        .get("sectionVisibility")
        .and_then(|v| v.get(section))
        .and_then(|s| s.as_bool())
        .unwrap_or(true)
}

const LEGACY_SECTION_TOOLS: &[(&str, &[&str])] = &[
    ("basic", &["basic"]),
    ("curves", &["curves"]),
    (
        "color",
        &[
            "whiteBalance",
            "colorPresence",
            "hue",
            "colorGrading",
            "colorMixer",
            "colorCalibration",
        ],
    ),
    (
        "details",
        &[
            "sharpening",
            "presence",
            "noiseReduction",
            "chromaticAberration",
        ],
    ),
    (
        "effects",
        &[
            "creative", "lensBlur", "relight", "fog", "lut", "vignette", "grain",
        ],
    ),
];

pub fn is_tool_active(adjustments: &serde_json::Value, tool: &str) -> bool {
    match adjustments.get("activeTools") {
        Some(active_tools) => active_tools
            .get(tool)
            .and_then(|active| active.as_bool())
            .unwrap_or(true),
        None => LEGACY_SECTION_TOOLS
            .iter()
            .find(|(_, tools)| tools.contains(&tool))
            .is_none_or(|(section, _)| is_section_visible(adjustments, section)),
    }
}

fn uses_baseline_exposure(adjustments: &Value) -> bool {
    adjustments.is_null()
        || adjustments
            .get(BASELINE_EXPOSURE_KEY)
            .and_then(Value::as_bool)
            .unwrap_or(false)
}

pub fn effective_baseline_exposure(
    adjustments: &Value,
    as_shot: AsShot,
    options: BaselineOptions,
) -> f32 {
    if uses_baseline_exposure(adjustments) {
        as_shot.exposure.compensation(options)
    } else {
        0.0
    }
}

#[allow(dead_code)]
struct AdjustmentScales {
    exposure: f32,
    brightness: f32,
    contrast: f32,
    highlights: f32,
    shadows: f32,
    whites: f32,
    blacks: f32,
    saturation: f32,
    vibrance: f32,

    sharpness: f32,
    sharpness_threshold: f32,
    luma_noise_reduction: f32,
    color_noise_reduction: f32,
    clarity: f32,
    dehaze: f32,
    structure: f32,
    centré: f32,

    vignette_amount: f32,
    vignette_midpoint: f32,
    vignette_roundness: f32,
    vignette_feather: f32,
    grain_amount: f32,
    grain_size: f32,
    grain_roughness: f32,

    chromatic_aberration: f32,

    hsl_hue_multiplier: f32,
    hsl_saturation: f32,
    hsl_luminance: f32,

    color_grading_saturation: f32,
    color_grading_luminance: f32,
    color_grading_blending: f32,
    color_grading_balance: f32,

    color_calibration_hue: f32,
    color_calibration_saturation: f32,

    glow: f32,
    halation: f32,
    flares: f32,
}

const SCALES: AdjustmentScales = AdjustmentScales {
    exposure: 0.8,
    brightness: 0.8,
    contrast: 100.0,
    highlights: 120.0,
    shadows: 120.0,
    whites: 40.0,
    blacks: 40.0,
    saturation: 100.0,
    vibrance: 100.0,

    sharpness: 50.0,
    sharpness_threshold: 100.0,
    luma_noise_reduction: 100.0,
    color_noise_reduction: 100.0,
    clarity: 125.0,
    dehaze: 750.0,
    structure: 125.0,
    centré: 250.0,

    vignette_amount: 100.0,
    vignette_midpoint: 100.0,
    vignette_roundness: 100.0,
    vignette_feather: 100.0,
    grain_amount: 200.0,
    grain_size: 50.0,
    grain_roughness: 100.0,

    chromatic_aberration: 10000.0,

    hsl_hue_multiplier: 0.3,
    hsl_saturation: 100.0,
    hsl_luminance: 100.0,

    color_grading_saturation: 500.0,
    color_grading_luminance: 500.0,
    color_grading_blending: 100.0,
    color_grading_balance: 200.0,

    color_calibration_hue: 400.0,
    color_calibration_saturation: 120.0,

    glow: 100.0,
    halation: 100.0,
    flares: 100.0,
};
fn mapped_exposure(js_adjustments: &Value, as_shot: AsShot, options: BaselineOptions) -> f32 {
    let baseline_exposure = effective_baseline_exposure(js_adjustments, as_shot, options);
    let is_visible = |tool: &str| is_tool_active(js_adjustments, tool);

    let get_val = |tool: &str, key: &str, scale: f32, default: Option<f64>| -> f32 {
        if is_visible(tool) {
            js_adjustments[key]
                .as_f64()
                .unwrap_or(default.unwrap_or(0.0)) as f32
                / scale
        } else {
            if let Some(d) = default {
                d as f32 / scale
            } else {
                0.0
            }
        }
    };
    get_val("basic", "exposure", SCALES.exposure, None) + baseline_exposure
}
