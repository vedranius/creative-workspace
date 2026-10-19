use cw_rapidraw_wasm_probe::{preview::encode_uncropped_preview, preview_resize::resize_uncropped};
use image::{DynamicImage, Rgb32FImage, RgbaImage};
use sha2::{Digest, Sha256};
#[path="reference/downscale_f32.rs"]
#[rustfmt::skip]
mod original;
#[path="reference/uncropped.rs"]
#[rustfmt::skip]
mod codec;
#[test]
fn original_square_bounds_match_float_bits_for_odd_axes_and_no_upscale() {
    for (w, h, t) in [
        (19, 13, 7),
        (13, 19, 7),
        (13, 7, 6),
        (7, 13, 6),
        (5, 3, 20),
        (32768, 1, 1),
    ] {
        let data = (0..w * h * 3)
            .map(|n| (n % 113) as f32 / 113.)
            .collect::<Vec<_>>();
        let image = DynamicImage::ImageRgb32F(Rgb32FImage::from_raw(w, h, data.clone()).unwrap());
        let expected = original::downscale_f32_image(&image, t, t).into_rgb32f();
        let got = resize_uncropped(w, h, &data, t).unwrap();
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
fn original_q80_rgb_codec_is_byte_exact_and_invalid_inputs_refuse() {
    let data = (0..31 * 17 * 4)
        .map(|n| (n * 37 % 256) as u8)
        .collect::<Vec<_>>();
    let expected = codec::encode(&DynamicImage::ImageRgba8(
        RgbaImage::from_raw(31, 17, data.clone()).unwrap(),
    ));
    let got = encode_uncropped_preview(31, 17, &data).unwrap();
    assert_eq!(got, expected);
    for (w, h, d) in [
        (0, 1, vec![]),
        (1, 1, vec![0; 3]),
        (32769, 1, vec![]),
        (32768, 32768, vec![]),
    ] {
        assert!(encode_uncropped_preview(w, h, &d).is_err());
    }
    for (w, h, d, t) in [
        (1, 1, vec![0.; 3], 0),
        (1, 1, vec![0.; 3], 32769),
        (1, 1, vec![f32::NAN; 3], 1),
        (1, 1, vec![65505.; 3], 1),
        (1, 1, vec![0.; 2], 1),
        (2048, 1536, vec![], 2048),
    ] {
        assert!(resize_uncropped(w, h, &d, t).is_err());
    }
}
#[test]
fn original_uncropped_reference_hash_is_pinned() {
    let meta: serde_json::Value = serde_json::from_str(include_str!("../UPSTREAM.json")).unwrap();
    assert_eq!(
        format!(
            "{:x}",
            Sha256::digest(include_str!("reference/uncropped.rs").as_bytes())
        ),
        meta["uncroppedPreview"]["codecReferenceSha256"]
    );
}
