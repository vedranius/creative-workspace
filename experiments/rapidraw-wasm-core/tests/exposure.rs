use cw_rapidraw_wasm_probe::baseline_exposure_compensation;
use sha2::{Digest, Sha256};

// Only the settings adapter is stubbed. The reference compensation function is
// compiled directly from the byte-identical, pinned native RapidRAW source.
mod app_settings {
    pub struct AppSettings {
        pub enable_baseline_exposure: bool,
        pub baseline_exposure: f32,
        pub compensate_highlight_preservation: bool,
    }
}
#[path = "reference/baseline_exposure.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native;

#[test]
fn reference_source_is_pinned_and_extracted_formula_is_unchanged() {
    let source = include_str!("reference/baseline_exposure.rs");
    let hash = Sha256::digest(source.as_bytes())
        .iter()
        .map(|v| format!("{v:02x}"))
        .collect::<String>();
    assert_eq!(
        hash,
        "e41793cdea1c72fb468569b7a8e6de0a23246db7b39963f91ac2ea94fbb578b0"
    );
    let start = source
        .find("#[derive(Clone, Copy, Debug, Default)]\npub struct RawExposure")
        .unwrap();
    let end = source[start..].find("\nimpl BaselineOptions {").unwrap() + start;
    let extracted = include_str!("../src/exposure.rs");
    let extracted_start = extracted
        .find("#[derive(Clone, Copy, Debug, Default)]")
        .unwrap();
    let extracted_end = extracted
        .find("\n/// Apply RapidRAW's native exposure helper")
        .unwrap();
    assert_eq!(
        extracted[extracted_start..extracted_end].trim(),
        source[start..end].trim()
    );
}

#[test]
fn finite_compensation_matches_pinned_native_source_bit_for_bit() {
    let mut cases = 0;
    for scene_referred in [false, true] {
        for dng_baseline in [-1.25_f32, 0.0, 0.75] {
            for highlight_preservation in [-1.0_f32, 0.0, 2.5] {
                for baseline_exposure in [None, Some(-0.5_f32), Some(0.0), Some(1.0)] {
                    for compensate in [false, true] {
                        let expected = native::RawExposure {
                            scene_referred,
                            dng_baseline,
                            highlight_preservation,
                        }
                        .compensation(native::BaselineOptions {
                            baseline_exposure,
                            compensate_highlight_preservation: compensate,
                        });
                        let actual = baseline_exposure_compensation(
                            scene_referred,
                            dng_baseline,
                            highlight_preservation,
                            baseline_exposure,
                            compensate,
                        )
                        .unwrap();
                        assert_eq!(actual.to_bits(), expected.to_bits());
                        cases += 1;
                    }
                }
            }
        }
    }
    assert_eq!(cases, 144);
}

#[test]
fn disabled_baseline_also_disables_dng_offset_as_in_original() {
    assert_eq!(
        baseline_exposure_compensation(true, 0.75, 2.5, None, false).unwrap(),
        0.0
    );
    assert_eq!(
        baseline_exposure_compensation(true, 0.75, 2.5, None, true).unwrap(),
        2.5
    );
    assert_eq!(
        baseline_exposure_compensation(false, 0.75, 2.5, Some(1.0), false).unwrap(),
        0.75
    );
    assert_eq!(
        baseline_exposure_compensation(true, 0.75, 2.5, Some(1.0), true).unwrap(),
        4.25
    );
}

#[test]
fn host_boundary_rejects_nonfinite_inputs_and_overflow() {
    for bad in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
        assert!(baseline_exposure_compensation(true, bad, 0.0, None, false).is_err());
        assert!(baseline_exposure_compensation(true, 0.0, bad, None, false).is_err());
        assert!(baseline_exposure_compensation(true, 0.0, 0.0, Some(bad), false).is_err());
    }
    assert!(baseline_exposure_compensation(true, f32::MAX, f32::MAX, Some(1.0), true).is_err());
}

#[test]
fn native_settings_toggle_is_preserved_at_host_independent_boundary() {
    let exposure = native::RawExposure {
        scene_referred: true,
        dng_baseline: 0.75,
        highlight_preservation: 2.5,
    };
    for enabled in [false, true] {
        let settings = app_settings::AppSettings {
            enable_baseline_exposure: enabled,
            baseline_exposure: 1.0,
            compensate_highlight_preservation: true,
        };
        let expected = exposure.compensation(native::BaselineOptions::from_settings(&settings));
        let actual =
            baseline_exposure_compensation(true, 0.75, 2.5, enabled.then_some(1.0), true).unwrap();
        assert_eq!(actual.to_bits(), expected.to_bits());
    }
}
