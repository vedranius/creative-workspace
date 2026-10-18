// Independent original preview excerpts from pinned lib.rs (AGPL-3.0).
use imgref::ImgRef;
use mozjpeg_rs::{Encoder, Preset};
use rgb::{FromSlice, RGBA8};
pub fn encode(final_rgba_image: &image::RgbaImage, jpeg_quality: u8,
    rect: Option<(u32,u32,u32,u32)>) -> Vec<u8> {
        let raw_bytes: &[u8] = final_rgba_image.as_raw();
        let rgba8_pixels: &[RGBA8] = raw_bytes.as_rgba();

        let img_ref = ImgRef::new(
            rgba8_pixels,
            final_rgba_image.width() as usize,
            final_rgba_image.height() as usize,
        );

        let encode_result = Encoder::new(Preset::BaselineFastest)
            .quality(jpeg_quality)
            .fast_color(true)
            .encode_imgref(img_ref);

        let jpeg_bytes = encode_result.unwrap();
        if let Some((rx, ry, preview_width, preview_height)) = rect {
            let (roi_w, roi_h) = final_rgba_image.dimensions();
                    let mut response = Vec::with_capacity(24 + jpeg_bytes.len());
                    response.extend_from_slice(&rx.to_le_bytes());
                    response.extend_from_slice(&ry.to_le_bytes());
                    response.extend_from_slice(&roi_w.to_le_bytes());
                    response.extend_from_slice(&roi_h.to_le_bytes());
                    response.extend_from_slice(&preview_width.to_le_bytes());
                    response.extend_from_slice(&preview_height.to_le_bytes());
                    response.extend_from_slice(&jpeg_bytes);
            response
        } else { jpeg_bytes }
}
