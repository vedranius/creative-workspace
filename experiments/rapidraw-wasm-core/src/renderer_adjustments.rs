//! Byte-layout mirror of pinned RapidRAW `image_processing.rs`.
//! Fields/repr are source-copied; constructor below only supports a neutral fixture.
use bytemuck::{Pod, Zeroable};

#[derive(Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct Point {
    x: f32,
    y: f32,
    _pad1: f32,
    _pad2: f32,
}

#[derive(Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct HslColor {
    hue: f32,
    saturation: f32,
    luminance: f32,
    _pad: f32,
}

#[derive(Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct ColorGradeSettings {
    pub hue: f32,
    pub saturation: f32,
    pub luminance: f32,
    _pad: f32,
}

#[derive(Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct ColorCalibrationSettings {
    pub shadows_tint: f32,
    pub red_hue: f32,
    pub red_saturation: f32,
    pub green_hue: f32,
    pub green_saturation: f32,
    pub blue_hue: f32,
    pub blue_saturation: f32,
    _pad1: f32,
}

#[derive(Debug, Clone, Copy, Pod, Zeroable)]
#[repr(C)]
pub struct GpuMat3 {
    col0: [f32; 4],
    col1: [f32; 4],
    col2: [f32; 4],
}

impl Default for GpuMat3 {
    fn default() -> Self {
        Self {
            col0: [1.0, 0.0, 0.0, 0.0],
            col1: [0.0, 1.0, 0.0, 0.0],
            col2: [0.0, 0.0, 1.0, 0.0],
        }
    }
}

#[derive(Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct GlobalAdjustments {
    pub exposure: f32,
    pub brightness: f32,
    pub contrast: f32,
    pub highlights: f32,
    pub shadows: f32,
    pub whites: f32,
    pub blacks: f32,
    pub saturation: f32,
    pub vibrance: f32,
    pub hue: f32,
    pub wb_log_gain_l: f32,
    pub wb_log_gain_m: f32,
    pub wb_log_gain_s: f32,
    pub centre_x: f32,
    pub centre_y: f32,

    pub sharpness: f32,
    pub luma_noise_reduction: f32,
    pub color_noise_reduction: f32,
    pub clarity: f32,
    pub dehaze: f32,
    pub structure: f32,
    pub centré: f32,
    pub vignette_amount: f32,
    pub vignette_midpoint: f32,
    pub vignette_roundness: f32,
    pub vignette_feather: f32,
    pub grain_amount: f32,
    pub grain_size: f32,
    pub grain_roughness: f32,

    pub chromatic_aberration_red_cyan: f32,
    pub chromatic_aberration_blue_yellow: f32,
    pub show_clipping: u32,
    pub is_raw_image: u32,
    _pad_ca1: f32,

    pub has_lut: u32,
    pub lut_intensity: f32,
    pub tonemapper_mode: u32,
    pub lut_is_scene_referred: u32,
    pub vignette_center_x: f32,
    pub vignette_center_y: f32,
    _pad_lut5: f32,

    _pad_agx1: f32,
    _pad_agx2: f32,
    _pad_agx3: f32,
    pub agx_pipe_to_rendering_matrix: GpuMat3,
    pub agx_rendering_to_pipe_matrix: GpuMat3,
    pub wb_rgb_to_lms_matrix: GpuMat3,
    pub wb_lms_to_rgb_matrix: GpuMat3,

    _pad_cg1: f32,
    _pad_cg2: f32,
    _pad_cg3: f32,
    _pad_cg4: f32,
    pub color_grading_shadows: ColorGradeSettings,
    pub color_grading_midtones: ColorGradeSettings,
    pub color_grading_highlights: ColorGradeSettings,
    pub color_grading_global: ColorGradeSettings,
    pub color_grading_blending: f32,
    pub color_grading_balance: f32,
    _pad2: f32,
    _pad3: f32,

    pub color_calibration: ColorCalibrationSettings,

    pub hsl: [HslColor; 8],
    pub luma_curve: [Point; 16],
    pub red_curve: [Point; 16],
    pub green_curve: [Point; 16],
    pub blue_curve: [Point; 16],
    pub luma_curve_count: u32,
    pub red_curve_count: u32,
    pub green_curve_count: u32,
    pub blue_curve_count: u32,
    _pad_end1: f32,
    _pad_end2: f32,
    _pad_end3: f32,
    _pad_end4: f32,

    pub glow_amount: f32,
    pub halation_amount: f32,
    pub flare_amount: f32,
    pub sharpness_threshold: f32,
}

#[derive(Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct MaskAdjustments {
    pub exposure: f32,
    pub brightness: f32,
    pub contrast: f32,
    pub highlights: f32,
    pub shadows: f32,
    pub whites: f32,
    pub blacks: f32,
    pub saturation: f32,
    pub vibrance: f32,

    pub sharpness: f32,
    pub luma_noise_reduction: f32,
    pub color_noise_reduction: f32,
    pub clarity: f32,
    pub dehaze: f32,
    pub structure: f32,

    pub glow_amount: f32,
    pub halation_amount: f32,
    pub flare_amount: f32,
    pub sharpness_threshold: f32,

    pub hue: f32,
    pub wb_log_gain_l: f32,
    pub wb_log_gain_m: f32,
    pub wb_log_gain_s: f32,
    _pad_wb: f32,
    pub color_grading_shadows: ColorGradeSettings,
    pub color_grading_midtones: ColorGradeSettings,
    pub color_grading_highlights: ColorGradeSettings,
    pub color_grading_global: ColorGradeSettings,
    pub color_grading_blending: f32,
    pub color_grading_balance: f32,
    _pad5: f32,
    _pad6: f32,

    pub hsl: [HslColor; 8],
    pub luma_curve: [Point; 16],
    pub red_curve: [Point; 16],
    pub green_curve: [Point; 16],
    pub blue_curve: [Point; 16],
    pub luma_curve_count: u32,
    pub red_curve_count: u32,
    pub green_curve_count: u32,
    pub blue_curve_count: u32,
    _pad_end4: f32,
    _pad_end5: f32,
    _pad_end6: f32,
    _pad_end7: f32,
}

pub const MAX_MASKS: usize = 32;

#[derive(Debug, Clone, Copy, Pod, Zeroable, Default)]
#[repr(C)]
pub struct AllAdjustments {
    pub global: GlobalAdjustments,
    pub mask_adjustments: [MaskAdjustments; MAX_MASKS],
    pub mask_count: u32,
    pub tile_offset_x: u32,
    pub tile_offset_y: u32,
    pub mask_atlas_cols: u32,
}

/// Build the pinned `AllAdjustments` Pod layout for a source-shader fixture.
/// It preserves the native struct size and offset order; only exposure is varied.
pub fn neutral_exposure_adjustments(exposure: f32) -> Result<AllAdjustments, String> {
    if !exposure.is_finite() {
        return Err("Renderer exposure must be finite".into());
    }
    let identity = GpuMat3 {
        col0: [1.0, 0.0, 0.0, 0.0],
        col1: [0.0, 1.0, 0.0, 0.0],
        col2: [0.0, 0.0, 1.0, 0.0],
    };
    let mut value = AllAdjustments::zeroed();
    value.global.exposure = exposure;
    value.global.centre_x = 0.5;
    value.global.centre_y = 0.5;
    value.global.is_raw_image = 1;
    value.global.tonemapper_mode = 0; // pinned basic/linear tone-map mode
    value.global.vignette_center_x = 0.5;
    value.global.vignette_center_y = 0.5;
    value.global.color_grading_blending = 0.5;
    value.global.agx_pipe_to_rendering_matrix = identity;
    value.global.agx_rendering_to_pipe_matrix = identity;
    value.global.wb_rgb_to_lms_matrix = identity;
    value.global.wb_lms_to_rgb_matrix = identity;
    value.mask_atlas_cols = 1;
    Ok(value)
}

pub fn pack_neutral_exposure(exposure: f32) -> Result<Vec<u8>, String> {
    Ok(bytemuck::bytes_of(&neutral_exposure_adjustments(exposure)?).to_vec())
}

#[cfg(test)]
mod tests {
    use super::{AllAdjustments, neutral_exposure_adjustments, pack_neutral_exposure};
    #[test]
    fn keeps_pinned_source_size_and_exposure_offset() {
        let value = neutral_exposure_adjustments(1.25).unwrap();
        assert_eq!(std::mem::size_of::<AllAdjustments>(), 45232);
        assert_eq!(bytemuck::bytes_of(&value).len(), 45232);
        assert_eq!(value.global.exposure, 1.25);
        assert_eq!(value.global.is_raw_image, 1);
        assert_eq!(value.mask_atlas_cols, 1);
        assert_eq!(value.mask_count, 0);
        assert!(neutral_exposure_adjustments(f32::NAN).is_err());
        assert!(neutral_exposure_adjustments(f32::INFINITY).is_err());
    }

    #[test]
    fn packed_value_matches_native_pod_bytes() {
        let value = neutral_exposure_adjustments(-0.5).unwrap();
        assert_eq!(
            pack_neutral_exposure(-0.5).unwrap(),
            bytemuck::bytes_of(&value)
        );
        assert_eq!(
            &pack_neutral_exposure(-0.5).unwrap()[0..4],
            &(-0.5f32).to_ne_bytes()
        );
    }
}
