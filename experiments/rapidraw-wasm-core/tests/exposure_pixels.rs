use cw_rapidraw_wasm_probe::apply_rgb_exposure;
use image::{DynamicImage, ImageBuffer, Rgb};
use sha2::{Digest, Sha256};

#[path = "reference/exposure_pixels.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native;

#[test]
fn reference_copy_is_stable_and_matches_the_native_exposure_equation() {
    let source = include_str!("reference/exposure_pixels.rs");
    let hash = Sha256::digest(source.as_bytes())
        .iter()
        .map(|v| format!("{v:02x}"))
        .collect::<String>();
    assert_eq!(
        hash,
        "49f8dcf64b4e7baa594bd913c4f9eda107190246b9506f9aff5b4d9917942f42"
    );

    let pixels = vec![0.0, 0.001, 0.04, 0.18, 0.5, 0.75, 1.0, 1.5, 8.0];
    for stops in [-8.0_f32, -2.0, -0.5, 0.0, 0.25, 1.0, 3.0, 8.0] {
        let image = DynamicImage::ImageRgb32F(
            ImageBuffer::<Rgb<f32>, _>::from_raw(3, 1, pixels.clone()).unwrap(),
        );
        let reference = native::apply_exposure(image, stops).to_rgb32f().into_raw();
        let actual = apply_rgb_exposure(&pixels, stops).unwrap();
        assert_eq!(actual.len(), reference.len());
        for (actual, expected) in actual.iter().zip(reference) {
            assert_eq!(actual.to_bits(), expected.to_bits(), "stops={stops}");
        }
    }
}

#[test]
fn host_boundary_rejects_invalid_or_unbounded_buffers() {
    assert!(apply_rgb_exposure(&[1.0, 2.0], 1.0).is_err());
    assert!(apply_rgb_exposure(&[1.0, f32::NAN, 2.0], 1.0).is_err());
    assert!(apply_rgb_exposure(&[1.0, 2.0, 3.0], f32::INFINITY).is_err());
    assert!(apply_rgb_exposure(&[f32::MAX, f32::MAX, f32::MAX], 2.0).is_err());
    assert!(apply_rgb_exposure(&[1.0, 2.0, 3.0], 128.0).is_err());
}
