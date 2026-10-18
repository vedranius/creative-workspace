use cw_rapidraw_wasm_probe::preview_geometry::orient_preview;
use image::{DynamicImage, Rgb32FImage};
use sha2::{Digest, Sha256};
#[path="reference/orientation_flip.rs"]
#[rustfmt::skip]
mod native;
#[test]
fn all_sixteen_rotation_flip_orders_match_original_bits_and_restore() {
    let pixels = (0..5 * 3 * 3)
        .map(|n| (n as f32 - 9.) / 13.)
        .collect::<Vec<_>>();
    for steps in 0..4 {
        for h in [false, true] {
            for v in [false, true] {
                let image =
                    DynamicImage::ImageRgb32F(Rgb32FImage::from_raw(5, 3, pixels.clone()).unwrap());
                let json = serde_json::json!({"orientationSteps":steps,"flipHorizontal":h,"flipVertical":v});
                let expected = native::apply_orientation_and_flip(image, &json)
                    .into_owned()
                    .into_rgb32f();
                let got = orient_preview(5, 3, &pixels, steps, h, v).unwrap();
                assert_eq!((got.width, got.height), expected.dimensions());
                assert_eq!(
                    got.data.iter().map(|v| v.to_bits()).collect::<Vec<_>>(),
                    expected
                        .as_raw()
                        .iter()
                        .map(|v| v.to_bits())
                        .collect::<Vec<_>>()
                );
            }
        }
    }
    let mut data = pixels.clone();
    let (mut w, mut h) = (5, 3);
    for _ in 0..4 {
        let next = orient_preview(w, h, &data, 1, false, false).unwrap();
        w = next.width;
        h = next.height;
        data = next.data;
    }
    assert_eq!(data, pixels);
}
#[test]
fn bad_shapes_values_and_unsupported_orientation_refuse() {
    for (w, h, p, steps) in [
        (0, 1, vec![], 0),
        (32768, 32768, vec![], 0),
        (1, 1, vec![0.; 2], 0),
        (1, 1, vec![f32::NAN; 3], 0),
        (1, 1, vec![65505.; 3], 0),
        (1, 1, vec![0.; 3], 4),
        (1, 1, vec![0.; 3], 256),
    ] {
        assert!(orient_preview(w, h, &p, steps, false, false).is_err());
    }
}
#[test]
fn exact_original_geometry_source_is_preserved() {
    let text = include_str!("reference/orientation_flip.rs");
    let meta: serde_json::Value = serde_json::from_str(include_str!("../UPSTREAM.json")).unwrap();
    assert_eq!(
        format!("{:x}", Sha256::digest(text.as_bytes())),
        meta["orientationFlip"]["referenceSha256"]
    );
    assert_eq!(text, include_str!("../src/original_geometry.rs"));
}
