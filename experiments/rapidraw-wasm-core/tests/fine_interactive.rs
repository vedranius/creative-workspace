use cw_rapidraw_wasm_probe::{
    interactive_preview, original_crop::Crop, preview_crop::fine_preview,
};
use image::{DynamicImage, GenericImageView, Rgb32FImage};
use sha2::{Digest, Sha256};
#[path="reference/crop.rs"]
#[rustfmt::skip]
mod original_crop;
#[path="reference/downscale_f32.rs"]
#[rustfmt::skip]
mod original_downscale;
#[path="reference/orientation_flip.rs"]
#[rustfmt::skip]
mod original_geometry;
#[path="reference/rotation.rs"]
#[rustfmt::skip]
mod original_rotation;
#[path="reference/fine_pipeline.rs"]
#[rustfmt::skip]
mod pipeline;
#[path="reference/interactive.rs"]
#[rustfmt::skip]
mod native;
#[test]
fn native_fine_interactive_rgba_rgb_policy_and_scale_match() {
    let mut resized = 0;
    let mut preserved = 0;
    for (width, height, target) in [(64, 47, 32), (19, 13, 128), (13, 19, 8)] {
        let rgb: Vec<f32> = (0..width * height * 3)
            .map(|i| (i % 71) as f32 / 71.)
            .collect();
        for angle in [-7.1, 5.3, 12.5] {
            for steps in [0, 1] {
                for crop in [
                    None,
                    Some(Crop {
                        x: 1.,
                        y: 1.,
                        width: 9.,
                        height: 7.,
                    }),
                ] {
                    let geometry = serde_json::json!({"orientationSteps":steps,"flipHorizontal":true,"flipVertical":false,"rotation":angle,"crop":crop});
                    for quality in ["full", "high", "performance"] {
                        let (base, scale, offset) = pipeline::compute(
                            DynamicImage::ImageRgb32F(
                                Rgb32FImage::from_raw(width, height, rgb.clone()).unwrap(),
                            ),
                            &geometry,
                            target,
                        );
                        let base_width = base.width();
                        let (divisor, q) = native::select(quality, false);
                        let native = if divisor > 1. {
                            let (w, h) =
                                native::bounds(target, divisor, base.width(), base.height());
                            original_downscale::downscale_f32_image(&base, w, h)
                        } else {
                            base
                        };
                        let source = fine_preview(
                            width, height, &rgb, target, steps, true, false, crop, angle,
                        )
                        .unwrap();
                        let got = interactive_preview::resize_interactive(
                            source.pixels.width,
                            source.pixels.height,
                            &source.pixels.data,
                            target,
                            quality,
                        )
                        .unwrap();
                        assert_eq!((got.pixels.width, got.pixels.height), native.dimensions());
                        assert_eq!((got.quality, got.divisor), (q, divisor));
                        assert_eq!(
                            (source.scale * (got.pixels.width as f32 / source.pixels.width as f32))
                                .to_bits(),
                            (scale * (native.width() as f32 / base_width as f32)).to_bits()
                        );
                        assert_eq!(source.offset, [offset.0, offset.1]);
                        let keep = got.pixels.width == source.pixels.width
                            && got.pixels.height == source.pixels.height;
                        if keep {
                            preserved += 1;
                            assert!(matches!(native, DynamicImage::ImageRgba32F(_)));
                        } else {
                            resized += 1;
                            assert!(matches!(native, DynamicImage::ImageRgb32F(_)));
                        }
                        let expected = native.into_rgba32f();
                        for (i, (r, e)) in got
                            .pixels
                            .data
                            .chunks_exact(3)
                            .zip(expected.as_raw().chunks_exact(4))
                            .enumerate()
                        {
                            assert_eq!(
                                r.iter().map(|v| v.to_bits()).collect::<Vec<_>>(),
                                e[..3].iter().map(|v| v.to_bits()).collect::<Vec<_>>()
                            );
                            let alpha = if keep {
                                source.alpha.as_ref().unwrap()[i]
                            } else {
                                1.
                            };
                            assert_eq!(
                                half::f16::from_f32(alpha).to_bits(),
                                half::f16::from_f32(e[3]).to_bits()
                            );
                        }
                    }
                }
            }
        }
    }
    assert!(resized > 0 && preserved > 0);
}
#[test]
fn native_fine_interactive_assembly_excerpt_is_pinned() {
    let meta: serde_json::Value = serde_json::from_str(include_str!("../UPSTREAM.json")).unwrap();
    let text = include_str!("reference/fine-interactive-assembly.txt");
    assert_eq!(
        format!("{:x}", Sha256::digest(text.as_bytes())),
        meta["fineInteractive"]["excerptSha256"]
    );
    assert!(text.contains("downscale_f32_image"));
    assert!(text.contains("small_w / orig_w"));
}
