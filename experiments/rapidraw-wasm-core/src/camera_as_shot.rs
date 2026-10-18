//! Original RapidRAW as-shot metadata boundary, b39884b, AGPL-3.0-only.
use crate::{camera_exposure, exposure::RawExposure, white_balance::WhiteBalance};
use rawler::{
    decoders::RawDecodeParams,
    imgop::xyz::Illuminant,
    rawimage::{RawImage, RawPhotometricInterpretation},
    rawsource::RawSource,
};

pub struct AsShot {
    pub white_balance: WhiteBalance,
    pub exposure: RawExposure,
}

/// Original metadata/dummy decode, with host input/dimension/finite guards.
pub fn read_as_shot(file_bytes: &[u8]) -> Result<AsShot, String> {
    let preflight = crate::preflight_sensor_bytes(file_bytes)?;
    let source = RawSource::new_from_slice(file_bytes);
    let decoder = rawler::get_decoder(&source).map_err(|e| e.to_string())?;
    let raw_image = decoder
        .raw_image(&source, &RawDecodeParams::default(), true)
        .map_err(|e| e.to_string())?;
    if raw_image.width != preflight.width
        || raw_image.height != preflight.height
        || raw_image.cpp != preflight.cpp
    {
        return Err("Dummy decoded dimensions differ from the RAW preflight".into());
    }
    let is_monochrome = raw_image.cpp == 1
        && !matches!(raw_image.photometric, RawPhotometricInterpretation::Cfa(_));
    let shot = AsShot {
        white_balance: (!is_monochrome)
            .then(|| as_shot_white_balance(&raw_image, file_bytes))
            .flatten()
            .unwrap_or_else(WhiteBalance::reference),
        exposure: camera_exposure::read(decoder.as_ref(), file_bytes, is_monochrome),
    };
    if !shot.white_balance.temperature.is_finite()
        || shot.white_balance.temperature <= 0.0
        || !shot.white_balance.tint.is_finite()
        || !shot.exposure.dng_baseline.is_finite()
        || !shot.exposure.highlight_preservation.is_finite()
    {
        return Err("As-shot metadata must be finite with positive temperature".into());
    }
    Ok(shot)
}

/// Original UI WB/relative shifts and Bradford adaptation, bounded host inputs.
/// This maps no other controls and does not itself run the GPU shader.
pub fn map_white_balance(json: &str, as_shot: WhiteBalance) -> Result<String, String> {
    if json.len() > 65536
        || !as_shot.temperature.is_finite()
        || as_shot.temperature <= 0.0
        || !as_shot.tint.is_finite()
    {
        return Err("Expected bounded JSON and finite positive as-shot WB".into());
    }
    let value: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    if !value.is_null() && !value.is_object() {
        return Err("Expected null or adjustment object".into());
    }
    let target = crate::white_balance::from_adjustments(&value, as_shot);
    let gains = crate::white_balance::adaptation_log_gains(as_shot, target);
    if !target.temperature.is_finite()
        || target.temperature <= 0.0
        || !target.tint.is_finite()
        || gains.iter().any(|v| !v.is_finite())
    {
        return Err("Mapped white balance must be finite with positive temperature".into());
    }
    Ok(serde_json::json!({"whiteBalance":target,"adaptationLogGains":gains,"rgbToLms":crate::white_balance::rgb_to_lms().to_cols_array()}).to_string())
}

fn as_shot_white_balance(raw_image: &RawImage, file_bytes: &[u8]) -> Option<WhiteBalance> {
    let wb_coeffs =
        crate::multi_exposure::neutralize_wb_if_multiexposure(raw_image.wb_coeffs, file_bytes);
    let neutral = if wb_coeffs[0].is_nan() {
        [1.0; 4]
    } else {
        wb_coeffs.map(|c| 1.0 / c)
    };

    let matrices = &raw_image.color_matrix;
    if let (Some(matrix_a), Some(matrix_d65)) =
        (matrices.get(&Illuminant::A), matrices.get(&Illuminant::D65))
    {
        return WhiteBalance::from_dual_illuminant_camera_neutral(matrix_a, matrix_d65, &neutral);
    }

    let color_matrix = matrices
        .get(&Illuminant::D65)
        .or_else(|| matrices.values().next())?;
    WhiteBalance::from_camera_neutral(color_matrix, &neutral)
}

