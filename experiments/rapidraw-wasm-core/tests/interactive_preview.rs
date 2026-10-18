use cw_rapidraw_wasm_probe::interactive_preview::{bounds, resize_interactive, select};
use image::{DynamicImage, Rgb32FImage};
use sha2::{Digest, Sha256};
#[path="reference/interactive.rs"]
#[rustfmt::skip]
mod native;
#[path="reference/downscale_f32.rs"]
#[rustfmt::skip]
mod filter;
#[test]
fn original_selector_and_two_stage_area_output_match_native() {
    for quality in ["full", "high", "performance", "unknown"] {
        for roi in [false, true] {
            assert_eq!(select(quality, roi), native::select(quality, roi));
        }
        let input = (0..512 * 384 * 3)
            .map(|i| (i % 37) as f32 / 37.)
            .collect::<Vec<_>>();
        let (divisor, jpeg) = native::select(quality, false);
        let image =
            DynamicImage::ImageRgb32F(Rgb32FImage::from_raw(512, 384, input.clone()).unwrap());
        let expected = if divisor > 1.0 {
            let (w, h) = native::bounds(512, divisor, 512, 384);
            filter::downscale_f32_image(&image, w, h)
        } else {
            image
        };
        let expected = expected.into_rgb32f();
        let got = resize_interactive(512, 384, &input, 512, quality).unwrap();
        assert_eq!(got.quality, jpeg);
        assert_eq!(got.divisor, divisor);
        assert_eq!((got.pixels.width, got.pixels.height), expected.dimensions());
        assert_eq!(
            got.pixels
                .data
                .iter()
                .map(|v| v.to_bits())
                .collect::<Vec<_>>(),
            expected
                .as_raw()
                .iter()
                .map(|v| v.to_bits())
                .collect::<Vec<_>>()
        );
    }
    assert_eq!(bounds(512, 1.5, 512, 384), (341, 255));
    assert_eq!(
        (
            resize_interactive(512, 384, &vec![0.; 512 * 384 * 3], 512, "performance")
                .unwrap()
                .pixels
                .width,
            255
        ),
        (340, 255)
    );
}
#[test]
fn invalid_interactive_shapes_and_targets_refuse() {
    for (w, h, data, target) in [
        (0, 1, vec![], 512),
        (32768, 32768, vec![], 512),
        (1, 1, vec![0.; 2], 512),
        (1, 1, vec![f32::NAN; 3], 512),
        (1, 1, vec![65505.; 3], 512),
        (1, 1, vec![0.; 3], 0),
        (1, 1, vec![0.; 3], 32769),
    ] {
        assert!(resize_interactive(w, h, &data, target, "performance").is_err());
    }
}
#[test]
fn source_selection_and_size_excerpts_are_pinned() {
    let meta: serde_json::Value = serde_json::from_str(include_str!("../UPSTREAM.json")).unwrap();
    for (key, text) in [
        (
            "selectionSha256",
            include_str!("reference/interactive-select.txt"),
        ),
        (
            "smallSizeSha256",
            include_str!("reference/interactive-size.txt"),
        ),
        ("referenceSha256", include_str!("reference/interactive.rs")),
    ] {
        assert_eq!(
            format!("{:x}", Sha256::digest(text.as_bytes())),
            meta["interactivePreview"][key]
        );
    }
    let port = include_str!("../src/interactive_preview.rs");
    assert!(port.contains(include_str!("reference/interactive-select.txt")));
    assert!(
        port.contains(
            include_str!("reference/interactive-size.txt")
                .replace(
                    "            let (w, h) = final_preview_base.dimensions();\n",
                    ""
                )
                .as_str()
        )
    );
}
