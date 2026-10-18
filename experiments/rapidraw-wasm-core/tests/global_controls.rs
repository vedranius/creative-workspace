use cw_rapidraw_wasm_probe::{
    camera_as_shot::AsShot,
    exposure::{BaselineOptions, RawExposure},
    renderer_adjustments::full_global_adjustments,
    white_balance::WhiteBalance,
};
use sha2::{Digest, Sha256};
#[allow(dead_code)]
mod app_settings {
    pub struct AppSettings {
        pub enable_baseline_exposure: bool,
        pub baseline_exposure: f32,
        pub compensate_highlight_preservation: bool,
    }
}
#[path="reference/wb_color.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod image_processing;
#[path="reference/white_balance.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod white_balance;
#[path="reference/ui_exposure.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native_ui;
#[path="reference/global_module.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native_global;
fn shot() -> AsShot {
    AsShot {
        white_balance: WhiteBalance {
            temperature: 6133.300425391969,
            tint: 39.766891841657326,
        },
        exposure: RawExposure {
            scene_referred: true,
            dng_baseline: -0.5,
            highlight_preservation: 0.0,
        },
    }
}
fn options() -> BaselineOptions {
    BaselineOptions {
        baseline_exposure: Some(0.0),
        compensate_highlight_preservation: true,
    }
}

#[test]
fn full_parser_and_helper_source_are_pinned_without_math_edits() {
    let meta = include_str!("../UPSTREAM.json");
    for (a, b) in [
        (
            include_str!("../src/global_controls.rs"),
            include_str!("reference/global_controls.rs"),
        ),
        (
            include_str!("../src/global_helpers.rs"),
            include_str!("reference/global_helpers.rs"),
        ),
    ] {
        assert_eq!(a, b);
        assert!(meta.contains(&format!("{:x}", Sha256::digest(a.as_bytes()))));
    }
    assert!(meta.contains(&format!(
        "{:x}",
        Sha256::digest(include_bytes!("reference/global_layout.rs"))
    )));
}

#[test]
fn complete_global_bytes_match_independent_original_parser_for_all_controls_defaults_and_visibility()
 {
    let inputs = [
        serde_json::Value::Null,
        serde_json::json!({}),
        serde_json::json!({"exposure":0.8,"baselineExposure":true,"brightness":12,"contrast":15,"highlights":-10,"shadows":20,"whites":-5,"blacks":8,"saturation":10,"vibrance":20,"temperature":10,"tint":-3}),
        serde_json::json!({"toneMapper":"agx","curves":{"luma":[{"x":0,"y":0},{"x":96,"y":80},{"x":255,"y":255}]},"hsl":{"reds":{"hue":4,"saturation":10,"luminance":-5}},"colorGrading":{"global":{"hue":30,"saturation":8,"luminance":2}},"colorCalibration":{"redHue":4,"blueSaturation":10},"sharpness":15,"grainAmount":10,"glowAmount":5,"lensBlurAmount":10}),
        serde_json::json!({"exposure":0.8,"brightness":25,"temperature":10,"activeTools":{"basic":false,"whiteBalance":false,"curves":false}}),
        serde_json::json!({"hue":4,"temperature":10,"sectionVisibility":{"color":false,"effects":false,"details":false}}),
    ];
    for input in inputs {
        for tone in [None, Some(0), Some(1)] {
            let actual =
                full_global_adjustments(&input.to_string(), &shot(), options(), tone).unwrap();
            let wb = white_balance::WhiteBalance {
                temperature: shot().white_balance.temperature,
                tint: shot().white_balance.tint,
            };
            let target = if native_ui::is_tool_active(&input, "whiteBalance") {
                white_balance::from_adjustments(&input, wb)
            } else {
                wb
            };
            let gains = white_balance::adaptation_log_gains(wb, target);
            let exposure = native_ui::reference_exposure(
                &input,
                native_ui::RawExposure {
                    scene_referred: true,
                    dng_baseline: -0.5,
                    highlight_preservation: 0.0,
                },
                native_ui::BaselineOptions {
                    baseline_exposure: Some(0.0),
                    compensate_highlight_preservation: true,
                },
            );
            let expected = native_global::reference(&input, gains, exposure, tone);
            assert_eq!(
                bytemuck::bytes_of(&actual.global),
                bytemuck::bytes_of(&expected),
                "input={input},tone={tone:?}"
            );
        }
    }
}

#[test]
fn untrusted_curve_shapes_overflow_and_unknown_tone_override_refuse_before_upload() {
    for points in [
        vec![serde_json::json!({"x":0,"y":0}); 17],
        vec![serde_json::json!({"x":0,"y":0})],
        vec![
            serde_json::json!({"x":100,"y":0}),
            serde_json::json!({"x":0,"y":255}),
        ],
        vec![
            serde_json::json!({"x":0,"y":0}),
            serde_json::json!({"x":256,"y":255}),
        ],
    ] {
        assert!(
            full_global_adjustments(
                &serde_json::json!({"curves":{"luma":points}}).to_string(),
                &shot(),
                options(),
                None
            )
            .is_err()
        );
    }
    assert!(full_global_adjustments("{\"brightness\":1e300}", &shot(), options(), None).is_err());
    assert!(full_global_adjustments("{}", &shot(), options(), Some(2)).is_err());
}
