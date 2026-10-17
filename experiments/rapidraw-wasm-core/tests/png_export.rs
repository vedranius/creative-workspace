use cw_rapidraw_wasm_probe::png_export::encode_rgb32f_png;
use image::{DynamicImage, ImageBuffer, ImageDecoder, Rgb, codecs::png::PngDecoder};
use sha2::{Digest, Sha256};
use std::io::Cursor;

#[path = "reference/png_encode.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native;

#[test]
fn pinned_png_source_excerpts_and_profile_are_preserved() {
    let metadata = include_str!("../UPSTREAM.json");
    let production = include_str!("../src/png_export.rs")
        .split_whitespace()
        .collect::<String>();
    let reference = include_str!("reference/png_encode.rs")
        .split_whitespace()
        .collect::<String>();
    for excerpt in [
        include_str!("reference/png-branch.txt"),
        include_str!("reference/png-phys.rs"),
        include_str!("reference/png-chunk.rs"),
    ] {
        let hash = format!("{:x}", Sha256::digest(excerpt.as_bytes()));
        assert!(metadata.contains(&hash), "Pinned excerpt identity changed");
        let tokens = excerpt.split_whitespace().collect::<String>();
        assert!(
            production.contains(&tokens),
            "Production changed native PNG math/options"
        );
        assert!(
            reference.contains(&tokens),
            "Native harness changed original excerpt"
        );
    }
    let profile = include_bytes!("../assets/sRGB-v2-magic.icc");
    assert_eq!(profile.len(), 736);
    assert!(metadata.contains(&format!("{:x}", Sha256::digest(profile))));
}

#[test]
fn encoded_bytes_match_original_png_branch_and_decode_to_rgb16() {
    let pixels = [
        -0.5, 0.0, 0.0001, 0.04, 0.18, 0.5, 0.75, 1.0, 1.5, 8.0, 0.25, 0.99999,
    ];
    let image = DynamicImage::ImageRgb32F(
        ImageBuffer::<Rgb<f32>, _>::from_raw(2, 2, pixels.to_vec()).unwrap(),
    );
    for dpi in [None, Some(1), Some(72), Some(300), Some(u16::MAX)] {
        let reference = native::encode(&image, dpi).unwrap();
        let actual = encode_rgb32f_png(2, 2, &pixels, dpi).unwrap();
        assert_eq!(actual, reference, "dpi={dpi:?}");
        let mut decoder = PngDecoder::new(Cursor::new(&actual)).unwrap();
        assert_eq!(decoder.dimensions(), (2, 2));
        assert_eq!(decoder.color_type(), image::ColorType::Rgb16);
        assert_eq!(
            decoder.icc_profile().unwrap().unwrap(),
            include_bytes!("../assets/sRGB-v2-magic.icc")
        );
        let decoded = image::load_from_memory(&actual).unwrap().to_rgb16();
        assert_eq!(decoded, image.to_rgb16());
        let phys = actual.windows(4).position(|bytes| bytes == b"pHYs");
        if let Some(dpi) = dpi {
            let offset = phys.unwrap() + 4;
            let expected = (f64::from(dpi) / 0.0254).round() as u32;
            assert_eq!(&actual[offset..offset + 4], &expected.to_be_bytes());
        } else {
            assert!(phys.is_none());
        }
    }
}

#[test]
fn malformed_dimensions_and_nonfinite_pixels_are_rejected_before_encoding() {
    for (w, h, pixels) in [
        (0, 1, vec![]),
        (1, 0, vec![]),
        (32769, 1, vec![]),
        (32768, 32768, vec![]),
        (1, 1, vec![]),
        (1, 1, vec![1.0, 2.0]),
        (1, 1, vec![f32::NAN, 1.0, 2.0]),
        (1, 1, vec![1.0, f32::INFINITY, 2.0]),
    ] {
        assert!(encode_rgb32f_png(w, h, &pixels, None).is_err());
    }
}

#[test]
fn png_compression_versions_match_the_pinned_native_lockfile() {
    let lock = include_str!("../Cargo.lock");
    for (name, version) in [
        ("image", "0.25.10"),
        ("png", "0.18.1"),
        ("fdeflate", "0.3.7"),
        ("flate2", "1.1.9"),
        ("miniz_oxide", "0.8.9"),
        ("crc32fast", "1.5.0"),
        ("simd-adler32", "0.3.10"),
        ("adler2", "2.0.1"),
        ("bitflags", "2.13.1"),
    ] {
        assert!(
            lock.contains(&format!("name = \"{name}\"\nversion = \"{version}\"")),
            "Native codec dependency drift: {name}"
        );
    }
}
