//! Independent original global parser/type/helper reference, AGPL-3.0-only.
use bytemuck::{Pod,Zeroable};
use serde::{Serialize,Deserialize};
use glam::{Mat3,Vec2};
use crate::{image_processing::{PRIMARIES_SRGB,WP_D65,primaries_to_xyz_matrix},white_balance};
use crate::native_ui::is_tool_active;
include!("global_layout.rs");
include!("global_helpers.rs");
include!("wb-gpu-matrix.rs");
include!("global_controls.rs");
pub fn reference(value: &serde_json::Value, gains:[f32;3], exposure:f32, tone:Option<u32>) -> GlobalAdjustments {
    get_global_adjustments_from_json(value,true,gains,exposure,tone)
}
