use cw_rapidraw_wasm_probe::{export_geometry, original_crop::Crop};
use image::{DynamicImage, Rgb32FImage};
#[path="reference/orientation_flip.rs"]
#[rustfmt::skip]
mod original_geometry;
#[path="reference/rotation.rs"]
#[rustfmt::skip]
mod native_rotation;
#[path="reference/crop.rs"]
#[rustfmt::skip]
mod native_crop;
#[test]
fn full_geometry_matches_independent_original_order_rgb_and_alpha() {
    let (w, h) = (31, 19);
    let input: Vec<f32> = (0..w * h * 3).map(|i| i as f32 / 128.).collect();
    for (steps, fh, fv, angle, crop) in [
        (0, false, false, 7.3, None),
        (
            1,
            true,
            false,
            -9.8,
            Some(Crop {
                x: 2.,
                y: 3.,
                width: 11.,
                height: 17.,
            }),
        ),
        (
            3,
            false,
            true,
            5.3,
            Some(Crop {
                x: 14.,
                y: 27.,
                width: 12.,
                height: 12.,
            }),
        ),
        (
            2,
            true,
            true,
            0.,
            Some(Crop {
                x: 1.,
                y: 1.,
                width: 20.,
                height: 15.,
            }),
        ),
    ] {
        let image = DynamicImage::ImageRgb32F(Rgb32FImage::from_raw(w, h, input.clone()).unwrap());
        let a = serde_json::json!({"orientationSteps":steps,"flipHorizontal":fh,"flipVertical":fv});
        let source = original_geometry::apply_orientation_and_flip(image, &a);
        let source = native_rotation::apply_rotation(source, angle);
        let expected =
            native_crop::apply_crop(source, &serde_json::to_value(crop).unwrap()).into_owned();
        let out = export_geometry::transform(w, h, &input, steps, fh, fv, angle, crop).unwrap();
        assert_eq!(
            (out.pixels.width, out.pixels.height),
            (expected.width(), expected.height())
        );
        assert_eq!(out.pixels.data, expected.to_rgb32f().into_raw());
        if angle != 0. {
            assert_eq!(
                out.alpha.unwrap(),
                expected
                    .to_rgba32f()
                    .as_raw()
                    .chunks_exact(4)
                    .map(|p| p[3])
                    .collect::<Vec<_>>()
            );
        } else {
            assert!(out.alpha.is_none());
        }
    }
}
#[test]
fn full_input_stays_bounded_before_even_tiny_crop_and_rejects_disappearing_or_fractional_crop() {
    let tiny = Some(Crop {
        x: 0.,
        y: 0.,
        width: 1.,
        height: 1.,
    });
    assert!(export_geometry::plan(2048, 1536, 0, 45., None).is_ok());
    assert!(export_geometry::plan(4096, 4096, 0, 0., tiny).is_err());
    assert!(export_geometry::transform(2048, 1536, &[], 0, false, false, 0., None).is_err());
    for rotation in [f32::NAN, f32::INFINITY, -45.1, 45.1] {
        assert!(export_geometry::plan(31, 19, 0, rotation, None).is_err());
    }
    for crop in [
        Crop {
            x: 0.5,
            y: 0.,
            width: 2.,
            height: 2.,
        },
        Crop {
            x: 0.,
            y: 0.,
            width: 0.,
            height: 2.,
        },
        Crop {
            x: 31.,
            y: 0.,
            width: 2.,
            height: 2.,
        },
        Crop {
            x: 0.,
            y: 0.,
            width: f64::NAN,
            height: 2.,
        },
    ] {
        assert!(export_geometry::plan(31, 19, 0, 0., Some(crop)).is_err());
    }
    // Source clips a positive integer crop at the oriented edge; no preview scaling.
    assert_eq!(
        export_geometry::plan(
            31,
            19,
            1,
            0.,
            Some(Crop {
                x: 17.,
                y: 29.,
                width: 30.,
                height: 30.
            })
        )
        .unwrap(),
        (2, 2)
    );
}
