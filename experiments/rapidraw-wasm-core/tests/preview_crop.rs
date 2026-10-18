use cw_rapidraw_wasm_probe::{
    original_crop::Crop,
    preview_crop::{crop_preview, plan},
};
use image::{DynamicImage, Rgb32FImage};
use sha2::{Digest, Sha256};
#[path="reference/orientation_flip.rs"]
#[rustfmt::skip]
mod original_geometry;
#[path="reference/crop.rs"]
#[rustfmt::skip]
mod original_crop;
#[path="reference/downscale_f32.rs"]
#[rustfmt::skip]
mod original_downscale;
#[path="reference/crop_pipeline.rs"]
#[rustfmt::skip]
mod pipeline;
#[test]
fn source_crop_sizing_rotation_flip_and_pixels_match() {
    for (w, h) in [(12, 8), (19, 13), (64, 47)] {
        let data = (0..w * h * 3)
            .map(|n| (n % 113) as f32 / 113.)
            .collect::<Vec<_>>();
        for steps in 0..4 {
            let (ow, oh) = if steps % 2 == 1 { (h, w) } else { (w, h) };
            for crop in [
                None,
                Some(Crop {
                    x: 1.,
                    y: 2.,
                    width: (ow - 2) as f64,
                    height: (oh - 3) as f64,
                }),
                Some(Crop {
                    x: 0.,
                    y: 0.,
                    width: ow as f64,
                    height: oh as f64,
                }),
                Some(Crop {
                    x: 2.,
                    y: 1.,
                    width: ow as f64,
                    height: oh as f64,
                }),
            ] {
                for target in [7, 11, 32, 128] {
                    for horizontal in [false, true] {
                        for vertical in [false, true] {
                            let a = serde_json::json!({"orientationSteps":steps,"flipHorizontal":horizontal,"flipVertical":vertical,"crop":crop});
                            let expected = pipeline::compute(
                                DynamicImage::ImageRgb32F(
                                    Rgb32FImage::from_raw(w, h, data.clone()).unwrap(),
                                ),
                                &a,
                                target,
                            );
                            let got = crop_preview(
                                w, h, &data, target, steps, horizontal, vertical, crop,
                            )
                            .unwrap();
                            assert_eq!(
                                (got.pixels.width, got.pixels.height),
                                expected.0.to_rgb32f().dimensions(),
                                "{w}x{h} {a} {target}"
                            );
                            assert_eq!(
                                got.pixels
                                    .data
                                    .iter()
                                    .map(|v| v.to_bits())
                                    .collect::<Vec<_>>(),
                                expected
                                    .0
                                    .to_rgb32f()
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
fn malformed_oversize_and_disappearing_crops_refuse_then_valid_recovers() {
    for c in [
        Crop {
            x: -1.,
            y: 0.,
            width: 1.,
            height: 1.,
        },
        Crop {
            x: 0.5,
            y: 0.,
            width: 1.,
            height: 1.,
        },
        Crop {
            x: 0.,
            y: f64::NAN,
            width: 1.,
            height: 1.,
        },
        Crop {
            x: 5.,
            y: 0.,
            width: 1.,
            height: 1.,
        },
        Crop {
            x: 0.,
            y: 0.,
            width: 0.,
            height: 1.,
        },
        Crop {
            x: 0.,
            y: 0.,
            width: 32769.,
            height: 1.,
        },
    ] {
        assert!(plan(5, 4, 3, 0, Some(c)).is_err());
    }
    assert!(
        plan(
            5,
            4,
            1,
            0,
            Some(Crop {
                x: 0.,
                y: 0.,
                width: 5.,
                height: 1.
            })
        )
        .is_err()
    );
    assert!(plan(2048, 1536, 2048, 0, None).is_err());
    assert!(plan(5, 4, 0, 0, None).is_err());
    assert!(plan(5, 4, 3, 4, None).is_err());
    for p in [vec![0.; 59], vec![f32::NAN; 60], vec![65505.; 60]] {
        assert!(crop_preview(5, 4, &p, 3, 0, false, false, None).is_err());
    }
    assert!(
        crop_preview(
            5,
            4,
            &[0.; 60],
            3,
            0,
            false,
            false,
            Some(Crop {
                x: 1.,
                y: 0.,
                width: 3.,
                height: 3.
            })
        )
        .is_ok()
    );
}
#[test]
fn crop_source_and_reference_are_pinned() {
    let pipeline = include_str!("reference/crop_pipeline.rs");
    let a = include_str!("reference/crop.rs");
    assert_eq!(a, include_str!("../src/original_crop.rs"));
    let meta: serde_json::Value = serde_json::from_str(include_str!("../UPSTREAM.json")).unwrap();
    assert_eq!(
        format!("{:x}", Sha256::digest(a.as_bytes())),
        meta["cropPreview"]["referenceSha256"]
    );
    assert_eq!(
        format!("{:x}", Sha256::digest(pipeline.as_bytes())),
        meta["cropPreview"]["pipelineReferenceSha256"]
    );
}
