//! Experimental extraction of RapidRAW's pinned `develop_internal` pixel path.
//! The decoder, demosaic, crop and color transforms remain pinned rawler code;
//! postprocessing below follows native `raw_processing.rs`.
use rawler::{
    decoders::{Decoder, Orientation, RawDecodeParams},
    imgop::develop::{DemosaicAlgorithm, Intermediate, ProcessingStep, RawDevelop},
    rawimage::{RawImage, RawPhotometricInterpretation},
    rawsource::RawSource,
};

use crate::{multi_exposure, preflight_sensor_bytes};

#[cfg(all(target_arch = "wasm32", feature = "quality-timer-compat"))]
const _: &str = include_str!("../quality-timer-compat.txt");

const MAX_DEVELOPED_BYTES: usize = 64 * 1024 * 1024;

#[derive(Debug)]
pub struct DevelopedPixels {
    pub width: usize,
    pub height: usize,
    /// One for monochrome pixels, three for calibrated RGB.
    pub components: usize,
    /// Interleaved f32 pixels, in row-major order and after EXIF orientation.
    pub data: Vec<f32>,
}

/// Run the pinned native RapidRAW develop pipeline and return its float pixels.
/// `linear_mode` has the same values and fallback as native develop_internal.
pub fn develop_pixels(
    file_bytes: &[u8],
    fast_demosaic: bool,
    linear_mode: &str,
) -> Result<DevelopedPixels, String> {
    let preflight = preflight_sensor_bytes(file_bytes)?;
    // A 4-channel float upper bound covers the native RGBA materialization and
    // prevents known-large sensor frames from entering the expensive pipeline.
    let max_pixels = MAX_DEVELOPED_BYTES / (4 * std::mem::size_of::<f32>());
    if preflight
        .width
        .checked_mul(preflight.height)
        .is_none_or(|pixels| pixels > max_pixels)
    {
        return Err("Estimated developed image exceeds 64 MiB".into());
    }

    let source = RawSource::new_from_slice(file_bytes);
    let decoder = rawler::get_decoder(&source).map_err(|e| e.to_string())?;
    let mut raw_image: RawImage = decoder
        .raw_image(&source, &RawDecodeParams::default(), false)
        .map_err(|e| e.to_string())?;
    if raw_image.width != preflight.width
        || raw_image.height != preflight.height
        || raw_image.cpp != preflight.cpp
    {
        return Err("Decoded dimensions differ from the raw IFD preflight".into());
    }
    let orientation = metadata_orientation(decoder.as_ref(), &source)?;
    let is_linear_format = matches!(
        raw_image.photometric,
        RawPhotometricInterpretation::LinearRaw
    );
    let (apply_ungamma, apply_calibration) = match linear_mode {
        "gamma" => (true, true),
        "skip_calib" => (false, false),
        "gamma_skip_calib" => (true, false),
        _ => (false, true),
    };

    let original_white_level = raw_image
        .whitelevel
        .0
        .first()
        .cloned()
        .unwrap_or(u16::MAX as u32) as f32;
    let original_black_level = raw_image
        .blacklevel
        .levels
        .first()
        .map(|level| level.as_f32())
        .unwrap_or(0.0);
    for level in raw_image.whitelevel.0.iter_mut() {
        *level = u32::MAX;
    }

    let mut developer = RawDevelop::default();
    if is_linear_format {
        developer.steps.retain(|&step| {
            step != ProcessingStep::SRgb
                && step != ProcessingStep::Demosaic
                && (apply_calibration || step != ProcessingStep::Calibrate)
        });
    } else {
        if fast_demosaic {
            developer.demosaic_algorithm = DemosaicAlgorithm::Speed;
        }
        developer.steps.retain(|&step| step != ProcessingStep::SRgb);
    }

    #[cfg(all(target_arch = "wasm32", not(feature = "quality-timer-compat")))]
    if !fast_demosaic
        && matches!(
            &raw_image.photometric,
            RawPhotometricInterpretation::Cfa(config)
                if config.cfa.is_rgb()
                    && !(config.cfa.width == 6 && config.cfa.height == 6)
        )
    {
        return Err(
            "Pinned PPG quality demosaic is unavailable in this WASM target because its source timer panics; select the pinned Speed mode".into(),
        );
    }

    raw_image.wb_coeffs =
        multi_exposure::neutralize_wb_if_multiexposure(raw_image.wb_coeffs, file_bytes);
    let mut developed = developer
        .develop_intermediate(&raw_image)
        .map_err(|e| e.to_string())?;
    drop(raw_image);

    let denominator = (original_white_level - original_black_level).max(1.0);
    let rescale_factor = (u32::MAX as f32 - original_black_level) / denominator;
    let clamp_limit = if fast_demosaic { 1.0 } else { 1000.0 };
    match &mut developed {
        Intermediate::Monochrome(pixels) => {
            for pixel in &mut pixels.data {
                let mut value = *pixel * rescale_factor;
                if is_linear_format && apply_ungamma {
                    value = srgb_to_linear(value.max(0.0));
                }
                *pixel = value.clamp(0.0, clamp_limit);
            }
        }
        Intermediate::ThreeColor(pixels) => {
            for pixel in &mut pixels.data {
                let mut r = (pixel[0] * rescale_factor).max(0.0);
                let mut g = (pixel[1] * rescale_factor).max(0.0);
                let mut b = (pixel[2] * rescale_factor).max(0.0);
                if is_linear_format && apply_ungamma {
                    r = srgb_to_linear(r.max(0.0));
                    g = srgb_to_linear(g.max(0.0));
                    b = srgb_to_linear(b.max(0.0));
                }
                let (r, g, b) = recover_clipped_pixel(r, g, b);
                pixel[0] = r.clamp(0.0, clamp_limit);
                pixel[1] = g.clamp(0.0, clamp_limit);
                pixel[2] = b.clamp(0.0, clamp_limit);
            }
        }
        Intermediate::FourColor(pixels) => {
            for pixel in &mut pixels.data {
                for channel in pixel {
                    let mut value = *channel * rescale_factor;
                    if is_linear_format && apply_ungamma {
                        value = srgb_to_linear(value.max(0.0));
                    }
                    *channel = value.clamp(0.0, clamp_limit);
                }
            }
            return Err("Native output conversion does not support four-color pixels".into());
        }
    }

    let (width, height, components, data) = match developed {
        Intermediate::Monochrome(pixels) => (pixels.dim().w, pixels.dim().h, 1, pixels.data),
        Intermediate::ThreeColor(pixels) => (
            pixels.dim().w,
            pixels.dim().h,
            3,
            pixels.data.into_iter().flatten().collect(),
        ),
        Intermediate::FourColor(_) => unreachable!("four-color output returned above"),
    };
    let oriented = orient_pixels(data, width, height, components, orientation);
    if oriented.len() * std::mem::size_of::<f32>() > MAX_DEVELOPED_BYTES {
        return Err("Developed image exceeds 64 MiB".into());
    }
    if oriented.iter().any(|value| !value.is_finite()) {
        return Err("Developed pixels contain non-finite values".into());
    }
    let (width, height) = oriented_dimensions(width, height, orientation);
    Ok(DevelopedPixels {
        width,
        height,
        components,
        data: oriented,
    })
}

fn metadata_orientation(decoder: &dyn Decoder, source: &RawSource) -> Result<Orientation, String> {
    let metadata = decoder
        .raw_metadata(source, &RawDecodeParams::default())
        .map_err(|e| e.to_string())?;
    Ok(metadata
        .exif
        .orientation
        .map(Orientation::from_u16)
        .unwrap_or(Orientation::Normal))
}

fn oriented_dimensions(width: usize, height: usize, orientation: Orientation) -> (usize, usize) {
    match orientation {
        Orientation::Transpose
        | Orientation::Rotate90
        | Orientation::Transverse
        | Orientation::Rotate270 => (height, width),
        _ => (width, height),
    }
}

fn orient_pixels(
    data: Vec<f32>,
    width: usize,
    height: usize,
    cpp: usize,
    orientation: Orientation,
) -> Vec<f32> {
    let (out_w, out_h) = oriented_dimensions(width, height, orientation);
    if orientation == Orientation::Normal || orientation == Orientation::Unknown {
        return data;
    }
    let mut output = vec![0.0; data.len()];
    for y in 0..height {
        for x in 0..width {
            // Match image::DynamicImage's exact orientation sequence in the pinned host.
            let (ox, oy) = match orientation {
                Orientation::Normal | Orientation::Unknown => (x, y),
                Orientation::HorizontalFlip => (width - 1 - x, y),
                Orientation::Rotate180 => (width - 1 - x, height - 1 - y),
                Orientation::VerticalFlip => (x, height - 1 - y),
                Orientation::Transpose => (y, x),
                Orientation::Rotate90 => (height - 1 - y, x),
                Orientation::Transverse => (height - 1 - y, width - 1 - x),
                Orientation::Rotate270 => (y, width - 1 - x),
            };
            let source_index = (y * width + x) * cpp;
            let output_index = (oy * out_w + ox) * cpp;
            output[output_index..output_index + cpp]
                .copy_from_slice(&data[source_index..source_index + cpp]);
        }
    }
    debug_assert_eq!(output.len(), out_w * out_h * cpp);
    output
}

#[inline]
fn srgb_to_linear(value: f32) -> f32 {
    if value <= 0.04045 {
        value / 12.92
    } else {
        ((value + 0.055) / 1.055).powf(3.0)
    }
}

#[inline]
fn smootherstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
}

#[inline]
fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

#[inline]
fn recover_clipped_pixel(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    let max_c = r.max(g).max(b);

    if max_c <= 0.50 {
        return (r, g, b);
    }

    let mut cur_r = r;
    let mut cur_g = g;
    let mut cur_b = b;

    let outer_blend = smootherstep(0.50, 1.5, max_c);

    let magenta = (cur_r.min(cur_b) - cur_g).max(0.0);
    if magenta > 0.0 {
        let target_g = cur_r.min(cur_b) * 0.80 + ((cur_r + cur_b) * 0.5) * 0.20;
        let correction = (target_g - cur_g).max(0.0);
        let magenta_weight = smoothstep(0.0, 0.25, magenta / max_c);
        cur_g += correction * outer_blend * magenta_weight;
    }

    let residual = (cur_r.min(cur_b) - cur_g).max(0.0);
    if residual > 0.0 {
        cur_g += residual * outer_blend;
    }

    let new_max = cur_r.max(cur_g).max(cur_b);
    let min_c = cur_r.min(cur_g).min(cur_b);

    let knee = smoothstep(0.50, 1.5, new_max);

    if knee > 0.0 {
        let neutrality = (min_c / new_max.max(1e-5)).clamp(0.0, 1.0);

        let core_burn = smoothstep(0.60, 3.0, new_max);

        let desat = (knee * (neutrality * 0.85 + core_burn * 0.15)).clamp(0.0, 1.0);
        let smooth_desat = desat * desat * (3.0 - 2.0 * desat);

        let neutral_value = min_c + (new_max - min_c) * 1.0;

        cur_r = cur_r * (1.0 - smooth_desat) + neutral_value * smooth_desat;
        cur_g = cur_g * (1.0 - smooth_desat) + neutral_value * smooth_desat;
        cur_b = cur_b * (1.0 - smooth_desat) + neutral_value * smooth_desat;
    }

    (cur_r, cur_g, cur_b)
}

#[cfg(test)]
mod tests {
    use super::orient_pixels;
    use rawler::decoders::Orientation;

    #[test]
    fn all_exif_orientations_rearrange_pixels_with_expected_dimensions() {
        let source = vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0];
        let cases = [
            (
                Orientation::Normal,
                3,
                2,
                vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0],
            ),
            (
                Orientation::HorizontalFlip,
                3,
                2,
                vec![2.0, 1.0, 0.0, 5.0, 4.0, 3.0],
            ),
            (
                Orientation::Rotate180,
                3,
                2,
                vec![5.0, 4.0, 3.0, 2.0, 1.0, 0.0],
            ),
            (
                Orientation::VerticalFlip,
                3,
                2,
                vec![3.0, 4.0, 5.0, 0.0, 1.0, 2.0],
            ),
            (
                Orientation::Transpose,
                2,
                3,
                vec![0.0, 3.0, 1.0, 4.0, 2.0, 5.0],
            ),
            (
                Orientation::Rotate90,
                2,
                3,
                vec![3.0, 0.0, 4.0, 1.0, 5.0, 2.0],
            ),
            (
                Orientation::Transverse,
                2,
                3,
                vec![5.0, 2.0, 4.0, 1.0, 3.0, 0.0],
            ),
            (
                Orientation::Rotate270,
                2,
                3,
                vec![2.0, 5.0, 1.0, 4.0, 0.0, 3.0],
            ),
        ];
        for (orientation, expected_width, expected_height, expected) in cases {
            let actual = orient_pixels(source.clone(), 3, 2, 1, orientation);
            assert_eq!(actual, expected, "{orientation:?}");
            assert_eq!(actual.len(), expected_width * expected_height);
        }
    }
}
