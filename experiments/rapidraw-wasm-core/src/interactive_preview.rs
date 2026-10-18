//! Source interactive policy and second area-filter stage. No ROI rendering.
use crate::preview_resize::{PreviewPixels,samples};
use image::{DynamicImage,Rgb32FImage};
pub fn select(live_quality:&str,has_roi:bool)->(f32,u8){
    let (interactive_divisor, interactive_quality) = match live_quality {
        "full" => (1.0_f32, 85_u8),
        "performance" => (if has_roi { 1.8_f32 } else { 1.5_f32 }, 65_u8),
        _ => (if has_roi { 1.4_f32 } else { 1.0_f32 }, 75_u8),
    };
(interactive_divisor,interactive_quality)
}
pub fn bounds(preview_dim:u32,interactive_divisor:f32,w:u32,h:u32)->(u32,u32){
            let target_size = (preview_dim as f32 / interactive_divisor) as u32;
            let (small_w, small_h) = if w > h {
                let ratio = h as f32 / w as f32;
                (target_size, (target_size as f32 * ratio) as u32)
            } else {
                let ratio = w as f32 / h as f32;
                ((target_size as f32 * ratio) as u32, target_size)
            };
(small_w,small_h)
}

pub struct InteractivePixels{pub pixels:PreviewPixels,pub quality:u8,pub divisor:f32}
pub fn resize_interactive(width:u32,height:u32,pixels:&[f32],preview_dim:u32,live_quality:&str)->Result<InteractivePixels,String>{
 let count=samples(width,height)?;
 if preview_dim==0||preview_dim>32768||pixels.len()!=count||pixels.iter().any(|v|!v.is_finite()||v.abs()>65504.0){return Err("Invalid bounded interactive preview input".into());}
 let (interactive_divisor,interactive_quality)=select(live_quality,false);
 let image=DynamicImage::ImageRgb32F(Rgb32FImage::from_raw(width,height,pixels.to_vec()).ok_or("Interactive shape mismatch")?);
 let result=if interactive_divisor>1.0{let (w,h)=bounds(preview_dim,interactive_divisor,width,height);crate::original_downscale::downscale_f32_image(&image,w,h)}else{image};
 let result=result.into_rgb32f();samples(result.width(),result.height())?;
 if result.as_raw().iter().any(|v|!v.is_finite()){return Err("Invalid original interactive result".into());}
 Ok(InteractivePixels{pixels:PreviewPixels{width:result.width(),height:result.height(),data:result.into_raw()},quality:interactive_quality,divisor:interactive_divisor})
}
