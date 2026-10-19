// Pinned generate_uncropped_preview codec excerpt, lib.rs (AGPL-3.0).
pub fn encode(processed_image:&image::DynamicImage)->Vec<u8>{
 use image::GenericImageView;use mozjpeg_rs::{Encoder,Preset};
 let (width,height)=processed_image.dimensions();
 let rgb_pixels=processed_image.to_rgb8().into_vec();
 Encoder::new(Preset::BaselineFastest).quality(80).encode_rgb(&rgb_pixels,width,height).unwrap()
}
