use image::{DynamicImage, ImageBuffer, Rgb};

#[path = "../tests/reference/exposure_pixels.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native;

fn main() {
    let pixels = [0.0_f32, 0.001, 0.04, 0.18, 0.5, 0.75, 1.0, 1.5, 8.0];
    let cases = [-8.0_f32, -2.0, -0.5, 0.0, 0.25, 1.0, 3.0, 8.0];
    let rows = cases
        .into_iter()
        .map(|stops| {
            let image = DynamicImage::ImageRgb32F(
                ImageBuffer::<Rgb<f32>, _>::from_raw(3, 1, pixels.to_vec()).unwrap(),
            );
            let output = native::apply_exposure(image, stops).to_rgb32f().into_raw();
            let bits = output
                .iter()
                .map(|value| value.to_bits().to_string())
                .collect::<Vec<_>>()
                .join(",");
            format!("{{\"stops\":{stops},\"bits\":[{bits}]}}")
        })
        .collect::<Vec<_>>()
        .join(",");
    println!("{{\"pixels\":[0.0,0.001,0.04,0.18,0.5,0.75,1.0,1.5,8.0],\"cases\":[{rows}]}}");
}
