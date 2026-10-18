use cw_rapidraw_wasm_probe::preview_resize::{preview_dimensions, resize_preview};
use image::{DynamicImage, Rgb32FImage};
use sha2::{Digest, Sha256};
#[path="reference/downscale_f32.rs"]
#[rustfmt::skip]
mod native;
#[test]
fn area_filter_matches_original_including_odd_aspects_negatives_and_no_upscale() {
    for (w, h, target) in [(13, 7, 5), (7, 13, 6), (5, 3, 5), (5, 3, 20), (32768, 1, 1)] {
        let pixels = (0..w * h * 3)
            .map(|i| (i as f32 % 31.0 - 5.0) / 13.0)
            .collect::<Vec<_>>();
        let source =
            DynamicImage::ImageRgb32F(Rgb32FImage::from_raw(w, h, pixels.clone()).unwrap());
        let scale = (target as f64 / w.max(h) as f64).min(1.0);
        let expected = if scale < 1.0 {
            native::downscale_f32_image(
                &source,
                ((w as f64 * scale).round() as u32).max(1),
                ((h as f64 * scale).round() as u32).max(1),
            )
        } else {
            source
        };
        let expected = expected.into_rgb32f();
        let got = resize_preview(w, h, &pixels, target).unwrap();
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
#[test]
fn malformed_or_large_input_refuses_before_image_allocation() {
    for (w, h, p, t) in [
        (0, 1, vec![], 1),
        (32769, 1, vec![], 1),
        (32768, 32768, vec![], 512),
        (1, 1, vec![0.; 2], 1),
        (1, 1, vec![0.; 3], 0),
        (1, 1, vec![0.; 3], 32769),
        (1, 1, vec![f32::NAN, 0., 0.], 1),
        (1, 1, vec![65505., 0., 0.], 1),
    ] {
        assert!(resize_preview(w, h, &p, t).is_err());
    }
    assert_eq!(preview_dimensions(2048, 1536, 512).unwrap(), (512, 384));
}
#[test]
fn exact_source_filter_and_only_profiling_cfgs_are_retained() {
    let source = include_str!("reference/downscale_f32.rs");
    let metadata: serde_json::Value =
        serde_json::from_str(include_str!("../UPSTREAM.json")).unwrap();
    assert_eq!(
        format!("{:x}", Sha256::digest(source.as_bytes())),
        metadata["previewResize"]["referenceSha256"]
    );
    let port = include_str!("../src/original_downscale.rs")
        .replace("    #[cfg(not(target_arch = \"wasm32\"))]\n", "");
    assert_eq!(source, port);
}
