//! Original WB/exposure projection into an otherwise neutral shader fixture.
//! CyberTimon/RapidRAW b39884b, AGPL-3.0-only; not the full settings parser.
use crate::{camera_as_shot::AsShot, exposure::BaselineOptions, renderer_adjustments::{AllAdjustments}, ui_exposure, white_balance};

pub fn camera_adjustments(json: &str, as_shot: &AsShot, options: BaselineOptions) -> Result<AllAdjustments,String> {
    let exposure = ui_exposure::map_ui_exposure(json, as_shot.exposure, options)?;
    if !as_shot.white_balance.temperature.is_finite() || as_shot.white_balance.temperature <= 0.0 || !as_shot.white_balance.tint.is_finite() {
        return Err("Expected finite as-shot WB with positive temperature".into());
    }
    let parsed: serde_json::Value = serde_json::from_str(json).map_err(|e|e.to_string())?;
    let js_adjustments = &parsed;
    let mut adjustments = crate::renderer_adjustments::neutral_exposure_adjustments(exposure)?;
    let target_white_balance = if is_tool_active(js_adjustments, "whiteBalance") {
        white_balance::from_adjustments(js_adjustments, as_shot.white_balance)
    } else {
        as_shot.white_balance
    };
    if !target_white_balance.temperature.is_finite() || target_white_balance.temperature <= 0.0 || !target_white_balance.tint.is_finite() {
        return Err("Target WB must be finite with positive temperature".into());
    }
    let white_balance_gains = white_balance::adaptation_log_gains(as_shot.white_balance, target_white_balance);
    if white_balance_gains.iter().any(|v|!v.is_finite()) { return Err("WB adaptation gains must be finite".into()); }
    let (forward,inverse) = crate::renderer_adjustments::original_wb_gpu_matrices();
    adjustments.global.wb_log_gain_l = white_balance_gains[0];
    adjustments.global.wb_log_gain_m = white_balance_gains[1];
    adjustments.global.wb_log_gain_s = white_balance_gains[2];
    adjustments.global.wb_rgb_to_lms_matrix = forward;
    adjustments.global.wb_lms_to_rgb_matrix = inverse;
    Ok(adjustments)
}

use ui_exposure::is_tool_active;
