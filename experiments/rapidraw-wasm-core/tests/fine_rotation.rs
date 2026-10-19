use cw_rapidraw_wasm_probe::{original_crop::Crop, preview_crop::fine_preview};
use image::{DynamicImage, Rgb32FImage};
#[path = "reference/crop.rs"]
mod original_crop;
#[path = "reference/downscale_f32.rs"]
mod original_downscale;
#[path = "reference/orientation_flip.rs"]
mod original_geometry;
#[path = "reference/rotation.rs"]
mod original_rotation;
#[path = "reference/fine_pipeline.rs"]
mod pipeline;
#[test]
fn original_fine_rotation_order_pixels_scale_and_crop_match() {
    for (w, h) in [(19, 13), (64, 47)] {
        let data = (0..w * h * 3)
            .map(|n| (n % 113) as f32 / 113.)
            .collect::<Vec<_>>();
        for steps in 0..4 {
            for flip in [false, true] {
                for angle in [-45., -17.5, 0., 5.3, 45.] {
                    for target in [11, 128] {
                        for crop in [
                            None,
                            Some(Crop {
                                x: 1.,
                                y: 1.,
                                width: 7.,
                                height: 5.,
                            }),
                        ] {
                            let expected = pipeline::compute(
                                DynamicImage::ImageRgb32F(
                                    Rgb32FImage::from_raw(w, h, data.clone()).unwrap(),
                                ),
                                &serde_json::json!({"orientationSteps":steps,"flipHorizontal":flip,"flipVertical":!flip,"rotation":angle,"crop":crop}),
                                target,
                            );
                            let got =
                                fine_preview(w, h, &data, target, steps, flip, !flip, crop, angle)
                                    .unwrap();
                            let expected_alpha = if angle != 0. {
                                Some(
                                    expected
                                        .0
                                        .to_rgba32f()
                                        .as_raw()
                                        .chunks_exact(4)
                                        .map(|p| p[3].to_bits())
                                        .collect::<Vec<_>>(),
                                )
                            } else {
                                None
                            };
                            assert_eq!(
                                got.alpha
                                    .as_ref()
                                    .map(|a| a.iter().map(|v| v.to_bits()).collect::<Vec<_>>()),
                                expected_alpha
                            );
                            let expected = (expected.0.into_rgb32f(), expected.1, expected.2);
                            assert_eq!(
                                (got.pixels.width, got.pixels.height),
                                expected.0.dimensions()
                            );
                            assert_eq!(
                                got.pixels
                                    .data
                                    .iter()
                                    .map(|v| v.to_bits())
                                    .collect::<Vec<_>>(),
                                expected
                                    .0
                                    .as_raw()
                                    .iter()
                                    .map(|v| v.to_bits())
                                    .collect::<Vec<_>>()
                            );
                            assert_eq!(got.scale.to_bits(), expected.1.to_bits());
                            assert_eq!(got.offset, [expected.2.0, expected.2.1]);
                        }
                    }
                }
            }
        }
    }
}
#[test]
fn nonfinite_angle_and_rgba_working_budget_refuse_before_pixel_copy_then_recover() {
    for angle in [f32::NAN, f32::INFINITY, -46., 46.] {
        assert!(fine_preview(8, 6, &[0.; 144], 8, 0, false, false, None, angle).is_err());
    }
    let crop = Some(Crop {
        x: 0.,
        y: 0.,
        width: 1.,
        height: 1.,
    });
    assert!(
        fine_preview(2098, 2098, &[], 512, 0, false, false, crop, 5.)
            .err()
            .unwrap()
            .contains("RGBA")
    );
    let good = fine_preview(8, 6, &[0.; 144], 8, 0, false, false, None, 3.5).unwrap();
    assert_eq!((good.pixels.width, good.pixels.height), (8, 6));
}

#[test]
fn copied_rotation_body_matches_pinned_original_function_hash() {
    use sha2::{Digest, Sha256};
    let source = include_str!("reference/rotation.rs");
    let at = source.find("pub fn apply_rotation<").unwrap();
    let meta: serde_json::Value = serde_json::from_str(include_str!("../UPSTREAM.json")).unwrap();
    assert_eq!(
        format!("{:x}", Sha256::digest(source[at..].as_bytes())),
        meta["fineRotation"]["functionSha256"].as_str().unwrap()
    );
}
