use cw_rapidraw_wasm_probe::{camera_as_shot, white_balance::WhiteBalance};
use sha2::{Digest, Sha256};
#[path = "reference/wb_color.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod image_processing;
#[path = "reference/white_balance.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native;

#[test]
fn complete_original_wb_and_color_helpers_are_unchanged() {
    let meta = include_str!("../UPSTREAM.json");
    for (production, reference) in [
        (
            include_str!("../src/white_balance.rs"),
            include_str!("reference/white_balance.rs"),
        ),
        (
            include_str!("../src/wb_color.rs"),
            include_str!("reference/wb_color.rs"),
        ),
    ] {
        assert_eq!(production, reference);
        assert!(meta.contains(&format!("{:x}", Sha256::digest(reference.as_bytes()))));
    }
    let raw = include_str!("reference/raw_processing.rs");
    let helper = &raw[raw.find("fn as_shot_white_balance(").unwrap()
        ..raw.find("pub fn get_fast_demosaic_scale_factor(").unwrap()];
    assert!(include_str!("../src/camera_as_shot.rs").contains(helper));
    assert!(meta.contains(&format!("{:x}", Sha256::digest(helper.as_bytes()))));
}

#[test]
fn single_dual_and_invalid_camera_matrix_cases_match_independent_native_source() {
    let a = [0.7, 0.2, 0.1, 0.1, 0.9, 0.0, 0.0, 0.3, 0.7];
    let d65 = [0.9, 0.1, 0.0, 0.2, 0.7, 0.1, 0.0, 0.2, 0.8];
    let neutral = [0.5, 1.0, 0.7, 1.0];
    for (matrix, coeffs) in [
        (&d65[..], &neutral[..]),
        (&a[..], &neutral[..]),
        (&[0.0; 9][..], &neutral[..]),
        (&d65[..], &[1.0, 1.0][..]),
    ] {
        let expected = native::WhiteBalance::from_camera_neutral(matrix, coeffs);
        let actual = WhiteBalance::from_camera_neutral(matrix, coeffs);
        assert_eq!(
            actual.map(|v| (v.temperature.to_bits(), v.tint.to_bits())),
            expected.map(|v| (v.temperature.to_bits(), v.tint.to_bits()))
        );
    }
    for (left, right) in [
        (&a[..], &d65[..]),
        (&a[..6], &d65[..]),
        (&[0.0; 9][..], &d65[..]),
    ] {
        let expected =
            native::WhiteBalance::from_dual_illuminant_camera_neutral(left, right, &neutral);
        let actual = WhiteBalance::from_dual_illuminant_camera_neutral(left, right, &neutral);
        assert_eq!(
            actual.map(|v| (v.temperature.to_bits(), v.tint.to_bits())),
            expected.map(|v| (v.temperature.to_bits(), v.tint.to_bits()))
        );
    }
}

#[test]
fn wb_host_boundary_rejects_invalid_input_and_preserves_original_clamps() {
    let shot = WhiteBalance {
        temperature: 6500.0,
        tint: 0.0,
    };
    for json in [
        "[]",
        "true",
        "",
        "{",
        "{\"whiteBalance\":{\"temperature\":0,\"tint\":0}}",
    ] {
        assert!(camera_as_shot::map_white_balance(json, shot).is_err());
    }
    for bad in [
        WhiteBalance {
            temperature: f64::NAN,
            tint: 0.0,
        },
        WhiteBalance {
            temperature: 0.0,
            tint: 0.0,
        },
        WhiteBalance {
            temperature: 6500.0,
            tint: f64::INFINITY,
        },
    ] {
        assert!(camera_as_shot::map_white_balance("{}", bad).is_err());
    }
    assert!(camera_as_shot::map_white_balance(&" ".repeat(65537), shot).is_err());
    let result: serde_json::Value = serde_json::from_str(
        &camera_as_shot::map_white_balance("{\"temperature\":1000000,\"tint\":-1000000}", shot)
            .unwrap(),
    )
    .unwrap();
    assert_eq!(result["whiteBalance"]["temperature"], 50000.0);
    assert_eq!(result["whiteBalance"]["tint"], -150.0);
    assert!(camera_as_shot::read_as_shot(&[]).is_err());
}
