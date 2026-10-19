use cw_rapidraw_wasm_probe::jpeg_export::encode;
use image::{DynamicImage, RgbaImage};
use serde_json::json;
#[path = "reference/jpeg_export.rs"]
#[rustfmt::skip]
mod native;

#[test]
fn original_resize_alpha_quality_icc_and_dpi_match() {
    for (w, h) in [(37, 23), (23, 37), (17, 17)] {
        let pixels: Vec<u8> = (0..w * h * 4).map(|i| (i * 71 % 256) as u8).collect();
        for mode in ["longEdge", "shortEdge", "width", "height"] {
            for (value, dont_enlarge) in [(13, false), (41, false), (41, true)] {
                for (quality, dpi) in [(1, None), (90, Some(300)), (100, Some(65535))] {
                    let resize = json!({"mode":mode,"value":value,"dontEnlarge":dont_enlarge});
                    let settings = json!({"jpegQuality":quality,"dpi":dpi,"resize":resize});
                    let reference = native::encode(
                        DynamicImage::ImageRgba8(
                            RgbaImage::from_raw(w, h, pixels.clone()).unwrap(),
                        ),
                        Some(&serde_json::from_value(resize).unwrap()),
                        quality,
                        dpi,
                    )
                    .unwrap();
                    assert_eq!(
                        encode(w, h, &pixels, &settings.to_string()).unwrap(),
                        reference
                    );
                }
            }
        }
    }
}

#[test]
fn refuses_malformed_and_resource_inputs_then_recovers() {
    let pixels = [255; 16];
    for settings in [
        "{}",
        "[]",
        "{",
        r#"{"jpegQuality":0}"#,
        r#"{"jpegQuality":101}"#,
        r#"{"jpegQuality":90,"dpi":0}"#,
        r#"{"jpegQuality":90,"dpi":65536}"#,
        r#"{"jpegQuality":90,"keepMetadata":true}"#,
        r#"{"jpegQuality":90,"resize":{"mode":"width","value":0,"dontEnlarge":false}}"#,
        r#"{"jpegQuality":90,"resize":{"mode":"width","value":32768,"dontEnlarge":false}}"#,
    ] {
        assert!(encode(2, 2, &pixels, settings).is_err(), "{settings}");
    }
    for (w, h, p) in [
        (0, 2, &pixels[..]),
        (32769, 1, &pixels[..]),
        (8192, 8192, &pixels[..]),
        (2, 2, &pixels[..15]),
    ] {
        assert!(encode(w, h, p, r#"{"jpegQuality":90}"#).is_err());
    }
    // Target RGBA fits, but vertical RGBA-f32 intermediate exceeds64 MiB.
    let wide = vec![0; 4096 * 1024 * 4];
    assert!(
        encode(
            4096,
            1024,
            &wide,
            r#"{"jpegQuality":90,"resize":{"mode":"height","value":2048,"dontEnlarge":false}}"#
        )
        .is_err()
    );
    assert!(
        encode(2, 2, &pixels, r#"{"jpegQuality":90}"#)
            .unwrap()
            .starts_with(&[255, 216])
    );
}

#[test]
fn reference_excerpt_and_icc_remain_pinned() {
    use sha2::{Digest, Sha256};
    let meta: serde_json::Value = serde_json::from_str(include_str!("../UPSTREAM.json")).unwrap();
    assert_eq!(
        format!(
            "{:x}",
            Sha256::digest(include_bytes!("reference/jpeg_export.rs"))
        ),
        meta["jpegExport"]["referenceSha256"].as_str().unwrap()
    );
    assert_eq!(include_bytes!("../assets/sRGB-v2-magic.icc").len(), 736);
}
