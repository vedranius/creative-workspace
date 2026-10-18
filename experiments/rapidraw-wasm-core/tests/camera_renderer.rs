use cw_rapidraw_wasm_probe::{
    camera_as_shot::AsShot,
    camera_renderer::camera_adjustments,
    exposure::{BaselineOptions, RawExposure},
    white_balance::WhiteBalance,
};
use sha2::{Digest, Sha256};

#[test]
fn original_visibility_and_gpu_matrix_source_excerpts_are_preserved() {
    let src = (include_str!("../src/camera_renderer.rs").to_string()
        + include_str!("../src/renderer_adjustments.rs"))
    .split_whitespace()
    .collect::<String>();
    let native = include_str!("../examples/develop_reference.rs")
        .split_whitespace()
        .collect::<String>();
    let meta = include_str!("../UPSTREAM.json");
    for text in [
        include_str!("reference/wb-target.txt"),
        include_str!("reference/wb-gpu-matrix.rs"),
    ] {
        assert!(meta.contains(&format!("{:x}", Sha256::digest(text.as_bytes()))));
        assert!(src.contains(&text.split_whitespace().collect::<String>()));
        let tokens = text
            .replace("is_tool_active(", "native_ui::is_tool_active(")
            .split_whitespace()
            .collect::<String>();
        assert!(native.contains(&tokens));
    }
}

#[test]
fn disabled_wb_resets_only_original_gains_and_keeps_camera_matrices() {
    let shot = AsShot {
        white_balance: WhiteBalance {
            temperature: 6133.300425391969,
            tint: 39.766891841657326,
        },
        exposure: RawExposure {
            scene_referred: true,
            dng_baseline: -0.5,
            highlight_preservation: 0.0,
        },
    };
    let options = BaselineOptions {
        baseline_exposure: Some(0.0),
        compensate_highlight_preservation: true,
    };
    let active = camera_adjustments(
        "{\"temperature\":10,\"tint\":-3,\"baselineExposure\":true}",
        &shot,
        options,
    )
    .unwrap();
    assert_eq!(active.global.exposure, -0.5);
    assert_ne!(active.global.wb_log_gain_s, 0.0);
    for input in [
        "{\"temperature\":10,\"tint\":-3,\"baselineExposure\":true,\"activeTools\":{\"whiteBalance\":false}}",
        "{\"temperature\":10,\"tint\":-3,\"baselineExposure\":true,\"sectionVisibility\":{\"color\":false}}",
    ] {
        let value = camera_adjustments(input, &shot, options).unwrap();
        assert_eq!(
            [
                value.global.wb_log_gain_l,
                value.global.wb_log_gain_m,
                value.global.wb_log_gain_s
            ],
            [0.0; 3]
        );
        assert_eq!(value.global.exposure, -0.5);
        assert_eq!(
            bytemuck::bytes_of(&value.global.wb_rgb_to_lms_matrix),
            bytemuck::bytes_of(&active.global.wb_rgb_to_lms_matrix)
        );
        assert_eq!(
            bytemuck::bytes_of(&value.global.wb_lms_to_rgb_matrix),
            bytemuck::bytes_of(&active.global.wb_lms_to_rgb_matrix)
        );
    }
    assert!(
        camera_adjustments(
            "{\"whiteBalance\":{\"temperature\":0,\"tint\":0}}",
            &shot,
            options
        )
        .is_err()
    );
}
