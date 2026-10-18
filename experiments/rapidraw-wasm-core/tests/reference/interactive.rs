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
