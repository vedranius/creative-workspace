// Pinned RapidRAW image_processing.rs excerpt from b39884b. The source helper
// uses Rayon for traversal; this reference uses the same scalar order/formula.
use image::DynamicImage;

pub fn apply_exposure(image: DynamicImage, exposure: f32) -> DynamicImage {
    if exposure == 0.0 {
        return image;
    }
    let gain = exposure.exp2();
    map_color_channels(image, |x| x * gain)
}

fn map_color_channels(
    mut image: DynamicImage,
    map: impl Fn(f32) -> f32,
) -> DynamicImage {
    match &mut image {
        DynamicImage::ImageRgb32F(img) => {
            img.as_mut().iter_mut().for_each(|c| *c = map(*c));
        }
        DynamicImage::ImageRgba32F(img) => {
            img.as_mut().chunks_exact_mut(4).for_each(|p| {
                p[0] = map(p[0]);
                p[1] = map(p[1]);
                p[2] = map(p[2]);
            });
        }
        _ => {}
    }
    image
}
