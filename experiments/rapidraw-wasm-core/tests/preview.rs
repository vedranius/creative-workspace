#[path = "reference/preview.rs"]
mod native;
use cw_rapidraw_wasm_probe::preview::encode_preview_response as encode;

#[test]
fn original_jpeg_and_rectangle_match_independent_native() {
    let img = image::RgbaImage::from_fn(19, 13, |x, y| {
        image::Rgba([(x * 11) as u8, (y * 17) as u8, ((x + y) * 7) as u8, 255])
    });
    for q in [65, 75, 85, 94] {
        let interactive = q != 94;
        let rect = interactive.then_some((3, 4, 30, 25));
        let (x, y, fw, fh) = rect.unwrap_or((0, 0, 19, 13));
        let actual = encode(19, 13, img.as_raw(), q, interactive, x, y, fw, fh).unwrap();
        assert_eq!(actual, native::encode(&img, q, rect));
        let jpeg = if interactive {
            &actual[24..]
        } else {
            &actual[..]
        };
        assert_eq!(&jpeg[..2], &[255, 216]);
        assert_eq!(&jpeg[jpeg.len() - 2..], &[255, 217]);
    }
}
#[test]
fn invalid_input_quality_or_rectangle_refuses() {
    for (w, h, p, q, i, x, y, fw, fh) in [
        (0, 1, vec![], 94, false, 0, 0, 0, 1),
        (1, 1, vec![0; 3], 94, false, 0, 0, 1, 1),
        (1, 1, vec![0; 4], 94, false, 1, 0, 2, 1),
        (1, 1, vec![0; 4], 75, false, 0, 0, 1, 1),
        (1, 1, vec![0; 4], 94, true, 0, 0, 1, 1),
        (1, 1, vec![0; 4], 75, true, u32::MAX, 0, 1, 1),
        (1, 1, vec![0; 4], 75, true, 1, 0, 1, 1),
        (1, 1, vec![0; 4], 75, true, 0, 1, 1, 1),
        (1, 1, vec![0; 4], 75, true, 0, 0, 32768, 32768),
        (32769, 1, vec![], 94, false, 0, 0, 32769, 1),
    ] {
        assert!(encode(w, h, &p, q, i, x, y, fw, fh).is_err());
    }
}
#[test]
fn original_encoder_and_envelope_excerpts_are_preserved() {
    let reference = include_str!("reference/preview.rs");
    assert!(reference.contains(include_str!("reference/preview-encode.txt")));
    assert!(reference.contains(include_str!("reference/preview-envelope.txt")));
    let upstream: serde_json::Value =
        serde_json::from_str(include_str!("../UPSTREAM.json")).unwrap();
    use sha2::{Digest, Sha256};
    for (name, bytes) in [
        (
            "preview-encode.txt",
            include_bytes!("reference/preview-encode.txt").as_slice(),
        ),
        (
            "preview-envelope.txt",
            include_bytes!("reference/preview-envelope.txt").as_slice(),
        ),
    ] {
        assert_eq!(
            format!("{:x}", Sha256::digest(bytes)),
            upstream["preview"]["excerpts"][name].as_str().unwrap()
        );
    }
}
