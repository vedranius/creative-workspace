//! Bounded orientation-only spatial stage; no fine rotation/crop/warp claims.
use crate::preview_resize::{PreviewPixels, samples};
use image::{DynamicImage, Rgb32FImage};
pub fn orient_preview(
    width: u32,
    height: u32,
    pixels: &[f32],
    steps: u32,
    horizontal: bool,
    vertical: bool,
) -> Result<PreviewPixels, String> {
    let count = samples(width, height)?;
    if steps > 3
        || pixels.len() != count
        || pixels.iter().any(|v| !v.is_finite() || v.abs() > 65504.0)
    {
        return Err("Expected bounded finite RGB and quarter-turn0..3".into());
    }
    let image = DynamicImage::ImageRgb32F(
        Rgb32FImage::from_raw(width, height, pixels.to_vec())
            .ok_or("Orientation shape mismatch")?,
    );
    let json = serde_json::json!({"orientationSteps":steps,"flipHorizontal":horizontal,"flipVertical":vertical});
    let result = crate::original_geometry::apply_orientation_and_flip(image, &json)
        .into_owned()
        .into_rgb32f();
    let expected = if steps % 2 == 1 {
        (height, width)
    } else {
        (width, height)
    };
    if result.dimensions() != expected {
        return Err("Invalid source orientation dimensions".into());
    }
    Ok(PreviewPixels {
        width: result.width(),
        height: result.height(),
        data: result.into_raw(),
    })
}
