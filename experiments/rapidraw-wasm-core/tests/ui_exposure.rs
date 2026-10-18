#[allow(dead_code)]
mod app_settings {
    pub struct AppSettings {
        pub enable_baseline_exposure: bool,
        pub baseline_exposure: f32,
        pub compensate_highlight_preservation: bool,
    }
}
use cw_rapidraw_wasm_probe::{
    exposure::{BaselineOptions, RawExposure},
    renderer_adjustments::pack_neutral_exposure,
    ui_exposure::{map_ui_exposure, pack_ui_exposure_fixture},
};
use sha2::{Digest, Sha256};
#[path="reference/ui_exposure.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native;
#[path = "reference/ui_exposure_cases.rs"]
mod fixtures;

#[test]
fn extracted_native_input_helpers_are_unchanged() {
    let metadata = include_str!("../UPSTREAM.json");
    let production = include_str!("../src/ui_exposure.rs")
        .split_whitespace()
        .collect::<String>();
    let reference = include_str!("reference/ui_exposure.rs")
        .split_whitespace()
        .collect::<String>();
    for text in [
        include_str!("reference/ui-exposure-visibility.txt"),
        include_str!("reference/ui-exposure-baseline.txt"),
        include_str!("reference/ui-exposure-get-value.txt"),
        include_str!("reference/ui-exposure-scales.txt"),
    ] {
        assert!(metadata.contains(&format!("{:x}", Sha256::digest(text.as_bytes()))));
        let tokens = text.split_whitespace().collect::<String>();
        assert!(production.contains(&tokens));
        assert!(reference.contains(&tokens));
    }
    let expression = "get_val(\"basic\", \"exposure\", SCALES.exposure, None) + baseline_exposure"
        .split_whitespace()
        .collect::<String>();
    assert!(production.contains(&expression));
    assert!(reference.contains(&expression));
}

#[test]
fn original_visibility_json_and_baseline_cases_match_all_packed_exposure_bits() {
    let neutral = pack_neutral_exposure(0.0).unwrap();
    let mut count = 0;
    for (input, scene, dng, highlight, baseline, compensate) in fixtures::cases() {
        let expected = native::reference_exposure(
            &input,
            native::RawExposure {
                scene_referred: scene,
                dng_baseline: dng,
                highlight_preservation: highlight,
            },
            native::BaselineOptions {
                baseline_exposure: baseline,
                compensate_highlight_preservation: compensate,
            },
        );
        let shot = RawExposure {
            scene_referred: scene,
            dng_baseline: dng,
            highlight_preservation: highlight,
        };
        let settings = BaselineOptions {
            baseline_exposure: baseline,
            compensate_highlight_preservation: compensate,
        };
        let json = input.to_string();
        let actual = map_ui_exposure(&json, shot, settings).unwrap();
        assert_eq!(actual.to_bits(), expected.to_bits(), "input={json}");
        let packed = pack_ui_exposure_fixture(&json, shot, settings).unwrap();
        assert_eq!(packed.len(), 45232);
        assert_eq!(&packed[..4], &expected.to_le_bytes());
        assert_eq!(&packed[4..], &neutral[4..]);
        count += 1;
    }
    assert_eq!(count, 216);
}

#[test]
fn input_bounds_malformed_shapes_and_overflow_are_refused() {
    let shot = RawExposure::default();
    let settings = BaselineOptions::default();
    for json in [
        "",
        "[]",
        "true",
        "1",
        "\"wrong\"",
        "{exposure:1}",
        "{\"exposure\":1e300}",
    ] {
        assert!(map_ui_exposure(json, shot, settings).is_err(), "{json}");
    }
    assert!(map_ui_exposure(&" ".repeat(65537), shot, settings).is_err());
    assert!(
        map_ui_exposure(
            "{}",
            RawExposure {
                dng_baseline: f32::NAN,
                ..shot
            },
            settings
        )
        .is_err()
    );
    assert!(
        map_ui_exposure(
            "{}",
            shot,
            BaselineOptions {
                baseline_exposure: Some(f32::INFINITY),
                ..settings
            }
        )
        .is_err()
    );
    assert!(
        map_ui_exposure(
            "{\"baselineExposure\":true}",
            RawExposure {
                scene_referred: true,
                dng_baseline: f32::MAX,
                highlight_preservation: f32::MAX
            },
            BaselineOptions {
                baseline_exposure: Some(f32::MAX),
                compensate_highlight_preservation: true
            }
        )
        .is_err()
    );
}
