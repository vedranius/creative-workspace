//! Pinned RapidRAW gpu_processing::to_rgba_f16 RGB32F branch, bounded before
//! conversion. Other DynamicImage branches are not part of this API.
use half::f16;

pub fn pack_rgb32f(width: u32, height: u32, pixels: &[f32]) -> Result<Vec<u16>, String> {
    if width == 0 || height == 0 || width > 32768 || height > 32768 {
        return Err("Renderer upload dimensions must be 1..32768".into());
    }
    let count = (width as usize)
        .checked_mul(height as usize)
        .ok_or("Renderer upload size overflow")?;
    let samples = count.checked_mul(3).ok_or("Renderer input size overflow")?;
    let output_samples = count
        .checked_mul(4)
        .ok_or("Renderer output size overflow")?;
    if samples > (64 * 1024 * 1024) / 4 || output_samples > (64 * 1024 * 1024) / 2 {
        return Err("Renderer upload exceeds bounded 64 MiB input/output capacity".into());
    }
    if pixels.len() != samples || pixels.iter().any(|v| !v.is_finite() || v.abs() > 65504.) {
        return Err(
            "Renderer upload requires exact RGB length and finite f16-representable samples".into(),
        );
    }
    let mut output = Vec::with_capacity(output_samples);
    for pixel in pixels.chunks_exact(3) {
        output.extend([
            f16::from_f32(pixel[0]).to_bits(),
            f16::from_f32(pixel[1]).to_bits(),
            f16::from_f32(pixel[2]).to_bits(),
            f16::ONE.to_bits(),
        ]);
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};
    mod reference {
        include!("../tests/reference/to_rgba_f16.rs");
        pub fn convert(image: &image::DynamicImage) -> Vec<half::f16> {
            to_rgba_f16(image)
        }
    }
    #[test]
    fn exact_native_rgb_upload_rounding_and_alpha() {
        let samples = vec![
            0.,
            -0.,
            1.,
            0.1,
            -0.1,
            0.33333334,
            65504.,
            -65504.,
            0.00000001,
            0.00000006,
            1.00048828125,
            1.00146484375,
        ];
        let native = image::DynamicImage::ImageRgb32F(
            image::Rgb32FImage::from_raw(4, 1, samples.clone()).unwrap(),
        );
        assert_eq!(
            pack_rgb32f(4, 1, &samples).unwrap(),
            reference::convert(&native)
                .iter()
                .map(|v| v.to_bits())
                .collect::<Vec<_>>()
        );
        let text = include_str!("../tests/reference/to_rgba_f16.rs");
        let body = text.split_once("use half::f16;\n").unwrap().1;
        let upstream: serde_json::Value =
            serde_json::from_str(include_str!("../UPSTREAM.json")).unwrap();
        assert_eq!(
            format!("{:x}", Sha256::digest(body.as_bytes())),
            upstream["rendererUpload"]["functionSha256"]
                .as_str()
                .unwrap()
        );
    }
    #[test]
    fn rejects_invalid_upload_before_allocating() {
        for (w, h, data) in [
            (0, 1, vec![]),
            (32769, 1, vec![]),
            (32768, 32768, vec![]),
            (1, 1, vec![0.; 2]),
            (1, 1, vec![f32::NAN, 0., 0.]),
            (1, 1, vec![f32::INFINITY, 0., 0.]),
            (1, 1, vec![65505., 0., 0.]),
        ] {
            assert!(pack_rgb32f(w, h, &data).is_err());
        }
    }
}
