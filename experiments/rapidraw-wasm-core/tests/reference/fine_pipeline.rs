use image::{DynamicImage,GenericImageView};
use super::{original_crop::Crop,original_geometry,original_downscale};
pub fn compute(warped:DynamicImage,adjustments:&serde_json::Value,preview_dim:u32)->(DynamicImage,f32,(f32,f32)){
    let (warped_w, warped_h) = warped.dimensions();
    let orientation_steps = adjustments["orientationSteps"].as_u64().unwrap_or(0);
    let (oriented_w, oriented_h) = if orientation_steps % 2 == 1 {
        (warped_h as f64, warped_w as f64)
    } else {
        (warped_w as f64, warped_h as f64)
    };

    let crop: Option<Crop> = serde_json::from_value(adjustments["crop"].clone()).ok();
    let (full_w, full_h) = crop
        .as_ref()
        .and_then(|c| {
            let (x, y) = (c.x.round().max(0.0), c.y.round().max(0.0));
            let (w, h) = (c.width.round(), c.height.round());
            (w > 0.0 && h > 0.0 && x < oriented_w && y < oriented_h)
                .then(|| ((oriented_w - x).min(w), (oriented_h - y).min(h)))
        })
        .unwrap_or((oriented_w, oriented_h));

    let target_scale = (preview_dim as f64 / full_w.max(full_h)).min(1.0);

    let working = if target_scale < 1.0 {
        let working_w = ((warped_w as f64 * target_scale).round() as u32).max(1);
        let working_h = ((warped_h as f64 * target_scale).round() as u32).max(1);
        original_downscale::downscale_f32_image(&warped, working_w, working_h)
    } else {warped};
    let working_scale = working.width() as f64 / warped_w.max(1) as f64;
    let max_dim = preview_dim as f64;
    let spatial_adjustments = serde_json::json!({
        "orientationSteps": adjustments["orientationSteps"],
        "rotation": adjustments["rotation"],
        "flipHorizontal": adjustments["flipHorizontal"],
        "flipVertical": adjustments["flipVertical"],
        "crop": crop.as_ref().map(|c| Crop {
            x: c.x * working_scale,
            y: c.y * working_scale,
            width: (c.width * working_scale).min(max_dim),
            height: (c.height * working_scale).min(max_dim),
        }),
    });

    let oriented=original_geometry::apply_orientation_and_flip(working,&spatial_adjustments);
    let rotated=super::original_rotation::apply_rotation(oriented,adjustments["rotation"].as_f64().unwrap_or(0.) as f32);
    let preview=super::original_crop::apply_crop(rotated,&spatial_adjustments["crop"]).into_owned();
    let scale_for_gpu = if full_w > 0.0 {
        (preview.width() as f64 / full_w) as f32
    } else {
        1.0
    };
    let unscaled_crop_offset = crop.map_or((0.0, 0.0), |c| (c.x as f32, c.y as f32));

    (preview,scale_for_gpu,unscaled_crop_offset)
}
