use image::DynamicImage;
use half::f16;
fn to_rgba_f16(img: &DynamicImage) -> Vec<f16> {
    match img {
        DynamicImage::ImageRgb32F(buffer) => {
            let mut output = Vec::with_capacity(buffer.as_raw().len() / 3 * 4);
            for pixel in buffer.pixels() {
                output.extend([
                    f16::from_f32(pixel[0]),
                    f16::from_f32(pixel[1]),
                    f16::from_f32(pixel[2]),
                    f16::ONE,
                ]);
            }
            output
        }
        DynamicImage::ImageRgba32F(buffer) => {
            buffer.as_raw().iter().copied().map(f16::from_f32).collect()
        }
        _ => {
            let rgba_f32 = img.to_rgba32f();
            rgba_f32.into_raw().into_iter().map(f16::from_f32).collect()
        }
    }
}
