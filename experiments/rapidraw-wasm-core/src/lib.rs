//! Experimental pinned RapidRAW decoder probe, not an accepted browser editor.
//! Shared decode/report logic is native and WASM; only the browser error adapter
//! depends on wasm-bindgen.
use rawler::{
    RawImage,
    decoders::{
        Decoder, RawDecodeParams,
        raf::{FujiIFD, parse_raf_format},
    },
    formats::tiff::{Entry, ExtractFromIFD, IFD, SampleFormat, Value},
    rawimage::RawImageData,
    rawsource::RawSource,
    tags::TiffCommonTag,
};
use sha2::{Digest, Sha256};

pub mod camera_as_shot;
pub mod camera_exposure;
pub mod camera_renderer;
#[path = "wb_color.rs"]
#[rustfmt::skip]
pub mod image_processing;
#[rustfmt::skip]
pub mod white_balance;
pub mod development;
pub mod exposure;
mod multi_exposure;
pub mod png_export;
pub mod preview;
pub mod preview_geometry;
pub mod preview_resize;
#[rustfmt::skip]
mod original_geometry;
#[rustfmt::skip]
pub mod interactive_preview;
#[rustfmt::skip]
mod original_downscale;
pub mod renderer_adjustments;
pub mod renderer_upload;
pub mod ui_exposure;

/// Preserve the native compensation formula behind a finite-value host boundary.
/// This returns stops only; it does not develop or modify image pixels.
pub fn baseline_exposure_compensation(
    scene_referred: bool,
    dng_baseline: f32,
    highlight_preservation: f32,
    baseline_exposure: Option<f32>,
    compensate_highlight_preservation: bool,
) -> Result<f32, String> {
    if !dng_baseline.is_finite()
        || !highlight_preservation.is_finite()
        || baseline_exposure.is_some_and(|v| !v.is_finite())
    {
        return Err("Exposure values must be finite".into());
    }
    let result = exposure::RawExposure {
        scene_referred,
        dng_baseline,
        highlight_preservation,
    }
    .compensation(exposure::BaselineOptions {
        baseline_exposure,
        compensate_highlight_preservation,
    });
    if !result.is_finite() {
        return Err("Exposure compensation overflows".into());
    }
    Ok(result)
}

/// Apply native RapidRAW exposure compensation to interleaved linear RGB pixels.
pub fn apply_rgb_exposure(pixels: &[f32], exposure: f32) -> Result<Vec<f32>, String> {
    exposure::apply_rgb_exposure(pixels, exposure)
}

const MAX_INPUT_BYTES: usize = 128 * 1024 * 1024;
const MAX_SENSOR_DIMENSION: usize = 32_768;
const MAX_SENSOR_BYTES: usize = 64 * 1024 * 1024;

/// Metadata checked before asking rawler to allocate/decompress sensor pixels.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SensorPreflight {
    pub width: usize,
    pub height: usize,
    pub cpp: usize,
    pub sample_count: usize,
    pub decoded_bytes_per_sample: usize,
    /// Estimated sensor buffer size based on rawler's output sample type.
    pub estimated_sensor_bytes: usize,
}

/// Inspect dimensions from rawler's Raw IFD without decoding image pixels.
/// Decoders without this metadata path are refused before `raw_image()`.
pub fn preflight_sensor_bytes(bytes: &[u8]) -> Result<SensorPreflight, String> {
    check_input_size(bytes)?;
    let source = RawSource::new_from_slice(bytes);
    let decoder = rawler::get_decoder(&source).map_err(|e| e.to_string())?;
    preflight_decoder(bytes, decoder.as_ref())
}

fn check_input_size(bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() || bytes.len() > MAX_INPUT_BYTES {
        return Err("RAW input must be between 1 byte and 128 MiB for this probe".into());
    }
    Ok(())
}

fn preflight_decoder(bytes: &[u8], decoder: &dyn Decoder) -> Result<SensorPreflight, String> {
    if bytes.get(..8) == Some(b"FUJIFILM") {
        let (width, height) = preflight_raf_dimensions(bytes)?;
        return preflight_values(width, height, 1, SampleFormat::Uint);
    }
    let ifd = decoder
        .ifd(rawler::decoders::WellKnownIFD::Raw)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| {
            "Decoder does not expose raw IFD dimensions; refused before raw_image".to_string()
        })?;
    preflight_ifd(&ifd)
}

fn preflight_ifd(ifd: &IFD) -> Result<SensorPreflight, String> {
    fn required(ifd: &IFD, tag: TiffCommonTag, name: &str) -> Result<usize, String> {
        let entry = ifd
            .get_entry(tag)
            .ok_or_else(|| format!("Raw IFD is missing {name}"))?;
        entry
            .value
            .get_usize(0)
            .map_err(|_| format!("Invalid {name} value"))?
            .ok_or_else(|| format!("Raw IFD has no {name} value"))
    }

    let width = required(ifd, TiffCommonTag::ImageWidth, "ImageWidth")?;
    let height = required(ifd, TiffCommonTag::ImageLength, "ImageLength")?;
    let cpp = required(ifd, TiffCommonTag::SamplesPerPixel, "SamplesPerPixel")?;
    let sample_format = SampleFormat::extract(ifd)
        .map_err(|e| e.to_string())?
        .unwrap_or(SampleFormat::Uint);
    preflight_values(width, height, cpp, sample_format)
}

fn preflight_values(
    width: usize,
    height: usize,
    cpp: usize,
    sample_format: SampleFormat,
) -> Result<SensorPreflight, String> {
    if width == 0 || height == 0 || width > MAX_SENSOR_DIMENSION || height > MAX_SENSOR_DIMENSION {
        return Err(format!(
            "RAW dimensions must be 1..={MAX_SENSOR_DIMENSION} per axis"
        ));
    }
    if !(1..=4).contains(&cpp) {
        return Err("RAW samples per pixel must be between 1 and 4".into());
    }
    let sample_count = width
        .checked_mul(height)
        .and_then(|n| n.checked_mul(cpp))
        .ok_or_else(|| "RAW sample count overflows".to_string())?;
    // Match rawler's decoded container: Uint produces Vec<u16>; IEEEFP produces
    // Vec<f32>. Other sample formats are currently unimplemented by rawler.
    let decoded_bytes_per_sample = match sample_format {
        SampleFormat::Uint => 2,
        SampleFormat::IEEEFP => 4,
        SampleFormat::Int | SampleFormat::Void => {
            return Err("RAW sample format is unsupported by the pinned decoder".into());
        }
    };
    let estimated_sensor_bytes = sample_count
        .checked_mul(decoded_bytes_per_sample)
        .ok_or_else(|| "RAW sensor byte estimate overflows".to_string())?;
    if estimated_sensor_bytes > MAX_SENSOR_BYTES {
        return Err(format!(
            "RAW sensor buffer estimate exceeds {} MiB",
            MAX_SENSOR_BYTES / (1024 * 1024)
        ));
    }
    Ok(SensorPreflight {
        width,
        height,
        cpp,
        sample_count,
        decoded_bytes_per_sample,
        estimated_sensor_bytes,
    })
}

fn preflight_raf_dimensions(bytes: &[u8]) -> Result<(usize, usize), String> {
    fn read_u32_be(bytes: &[u8], offset: usize, label: &str) -> Result<u32, String> {
        let raw: [u8; 4] = bytes
            .get(
                offset
                    ..offset
                        .checked_add(4)
                        .ok_or_else(|| format!("{label} offset overflow"))?,
            )
            .ok_or_else(|| format!("RAF is truncated before {label}"))?
            .try_into()
            .map_err(|_| format!("RAF has malformed {label}"))?;
        Ok(u32::from_be_bytes(raw))
    }

    if bytes.get(..8) != Some(b"FUJIFILM") {
        return Err("RAF signature is missing".into());
    }
    const RAF_TIFF1_PTR_OFFSET: usize = 84;
    const RAF_TIFF2_PTR_OFFSET: usize = 100;
    const RAF_TAGS_PTR_OFFSET: usize = 92;
    let source = RawSource::new_from_slice(bytes);
    let mut reader = source.reader();
    let tiff_offset = read_u32_be(bytes, RAF_TIFF1_PTR_OFFSET, "TIFF pointer")?
        .checked_add(12)
        .ok_or_else(|| "RAF TIFF pointer overflows".to_string())?;
    let mut main = IFD::new_root(&mut reader, tiff_offset).map_err(|e| e.to_string())?;

    let fuji_offset = read_u32_be(bytes, RAF_TIFF2_PTR_OFFSET, "Fuji IFD pointer")?;
    match IFD::new_root_with_correction(
        &mut reader,
        0,
        fuji_offset,
        0,
        10,
        &[FujiIFD::FujiIFD.into()],
    ) {
        Ok(fuji_ifd) => {
            main.sub.insert(FujiIFD::FujiIFD as u16, vec![fuji_ifd]);
        }
        Err(_) => {
            let tag = FujiIFD::StripOffsets as u16;
            let fake = IFD {
                entries: [(
                    tag,
                    Entry {
                        tag,
                        value: Value::Long(vec![fuji_offset]),
                        embedded: Some(RAF_TIFF2_PTR_OFFSET as u32),
                    },
                )]
                .into_iter()
                .collect(),
                endian: main.endian,
                ..IFD::default()
            };
            main.sub.insert(FujiIFD::FujiIFD as u16, vec![fake]);
        }
    };

    let raw = main
        .find_first_ifd_with_tag(FujiIFD::StripOffsets)
        .ok_or_else(|| "RAF has no raw StripOffsets IFD".to_string())?;
    if raw.has_entry(FujiIFD::RawImageFullWidth) {
        let required = |tag, label| -> Result<usize, String> {
            raw.get_entry(tag)
                .ok_or_else(|| format!("RAF raw IFD is missing {label}"))?
                .value
                .get_usize(0)
                .map_err(|_| format!("RAF raw IFD has malformed {label}"))?
                .ok_or_else(|| format!("RAF raw IFD has no {label} value"))
        };
        return Ok((
            required(FujiIFD::RawImageFullWidth, "width")?,
            required(FujiIFD::RawImageFullHeight, "height")?,
        ));
    }

    let tags_offset = read_u32_be(bytes, RAF_TAGS_PTR_OFFSET, "RAF tags pointer")?;
    let tags = parse_raf_format(&source, tags_offset).map_err(|e| e.to_string())?;
    let sizes = tags
        .get_entry(TiffCommonTag::ImageWidth)
        .ok_or_else(|| "RAF tags are missing RawImageFullSize".to_string())?;
    let dimension = |index, label| -> Result<usize, String> {
        sizes
            .value
            .get_usize(index)
            .map_err(|_| format!("RAF RawImageFullSize has malformed {label}"))?
            .ok_or_else(|| format!("RAF RawImageFullSize has no {label}"))
    };
    Ok((dimension(1, "width")?, dimension(0, "height")?))
}

fn raw_image_after_preflight(
    bytes: &[u8],
    source: &RawSource,
    decoder: &dyn Decoder,
) -> Result<RawImage, String> {
    let preflight = preflight_decoder(bytes, decoder)?;
    let raw = decoder
        .raw_image(source, &RawDecodeParams::default(), false)
        .map_err(|e| e.to_string())?;
    if raw.width != preflight.width || raw.height != preflight.height || raw.cpp != preflight.cpp {
        return Err("Decoded dimensions differ from the raw IFD preflight".into());
    }
    Ok(raw)
}

/// Decode with the pinned rawler and return dimensions, selected sensor samples,
/// and a SHA-256 over every decoded sensor value in a canonical little-endian form.
/// The preflight bounds the estimated sensor buffer, not all decoder intermediates.
pub fn decode_sensor_report(bytes: &[u8]) -> Result<String, String> {
    check_input_size(bytes)?;
    let source = RawSource::new_from_slice(bytes);
    let decoder = rawler::get_decoder(&source).map_err(|e| e.to_string())?;
    let raw = raw_image_after_preflight(bytes, &source, decoder.as_ref())?;
    let expected_count = raw
        .width
        .checked_mul(raw.height)
        .and_then(|n| n.checked_mul(raw.cpp))
        .ok_or_else(|| "RAW dimensions overflow".to_string())?;

    let (sample_count, digest, samples) = match &raw.data {
        RawImageData::Integer(values) => {
            if values.len() != expected_count {
                return Err("Decoded integer sample count does not match dimensions".into());
            }
            let mut hash = Sha256::new();
            for value in values {
                hash.update(value.to_le_bytes());
            }
            let samples = selected_indices(values.len())
                .into_iter()
                .map(|i| values[i].to_string())
                .collect::<Vec<_>>();
            (
                values.len(),
                hex_digest(hash.finalize().as_slice()),
                samples,
            )
        }
        RawImageData::Float(values) => {
            if values.len() != expected_count {
                return Err("Decoded float sample count does not match dimensions".into());
            }
            if values.iter().any(|value| !value.is_finite()) {
                return Err("Decoded float samples contain non-finite values".into());
            }
            let mut hash = Sha256::new();
            for value in values {
                hash.update(value.to_bits().to_le_bytes());
            }
            let samples = selected_indices(values.len())
                .into_iter()
                .map(|i| format!("{:.9}", values[i]))
                .collect::<Vec<_>>();
            (
                values.len(),
                hex_digest(hash.finalize().as_slice()),
                samples,
            )
        }
    };
    let indices = selected_indices(sample_count);
    Ok(format!(
        "{{\"width\":{},\"height\":{},\"cpp\":{},\"bps\":{},\"sampleCount\":{},\"sampleSha256\":\"{}\",\"sampleIndices\":[{}],\"sampleValues\":[{}]}}",
        raw.width,
        raw.height,
        raw.cpp,
        raw.bps,
        sample_count,
        digest,
        indices
            .iter()
            .map(usize::to_string)
            .collect::<Vec<_>>()
            .join(","),
        samples.join(",")
    ))
}

fn selected_indices(len: usize) -> Vec<usize> {
    if len == 0 {
        return Vec::new();
    }
    let three_quarters = (len / 4) * 3 + ((len % 4) * 3) / 4;
    [0, len / 4, len / 2, three_quarters, len - 1]
        .into_iter()
        .fold(Vec::new(), |mut indices, index| {
            if indices.last() != Some(&index) {
                indices.push(index);
            }
            indices
        })
}

fn hex_digest(digest: impl AsRef<[u8]>) -> String {
    digest.as_ref().iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(target_arch = "wasm32")]
mod browser {
    use js_sys::{Float32Array, Object, Reflect};
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub fn baseline_exposure_compensation(
        scene_referred: bool,
        dng_baseline: f32,
        highlight_preservation: f32,
        baseline_exposure: Option<f32>,
        compensate_highlight_preservation: bool,
    ) -> Result<f32, JsValue> {
        super::baseline_exposure_compensation(
            scene_referred,
            dng_baseline,
            highlight_preservation,
            baseline_exposure,
            compensate_highlight_preservation,
        )
        .map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen]
    pub fn pack_rgb32f_renderer_input(
        width: u32,
        height: u32,
        pixels: &[f32],
    ) -> Result<Vec<u16>, JsValue> {
        super::renderer_upload::pack_rgb32f(width, height, pixels)
            .map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen]
    pub fn apply_rgb_exposure(pixels: &[f32], exposure: f32) -> Result<Vec<f32>, JsValue> {
        super::apply_rgb_exposure(pixels, exposure).map_err(|e| JsValue::from_str(&e))
    }

    /// Original native JPEG preview and interactive rectangle response.
    #[wasm_bindgen]
    pub fn encode_preview_response(
        width: u32,
        height: u32,
        pixels: &[u8],
        quality: u8,
        interactive: bool,
        x: u32,
        y: u32,
        full_width: u32,
        full_height: u32,
    ) -> Result<Vec<u8>, JsValue> {
        super::preview::encode_preview_response(
            width,
            height,
            pixels,
            quality,
            interactive,
            x,
            y,
            full_width,
            full_height,
        )
        .map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen]
    pub fn encode_rendered_rgba8_png(
        width: u32,
        height: u32,
        pixels: &[u8],
        dpi: Option<u16>,
    ) -> Result<Vec<u8>, JsValue> {
        super::png_export::encode_rendered_rgba8_png(width, height, pixels, dpi)
            .map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen]
    pub fn encode_rgb32f_png(
        width: u32,
        height: u32,
        pixels: &[f32],
        dpi: Option<u16>,
    ) -> Result<Vec<u8>, JsValue> {
        super::png_export::encode_rgb32f_png(width, height, pixels, dpi)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Build source-layout neutral adjustments with one finite exposure value.
    /// This is a bounded renderer fixture, not the original UI settings parser.
    #[wasm_bindgen]
    pub fn pack_neutral_renderer_adjustments(exposure: f32) -> Result<Vec<u8>, JsValue> {
        super::renderer_adjustments::pack_neutral_exposure(exposure)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Native UI exposure mapping into an otherwise neutral shader fixture.
    #[wasm_bindgen]
    pub fn pack_ui_exposure_fixture(
        json: &str,
        scene_referred: bool,
        dng_baseline: f32,
        highlight_preservation: f32,
        baseline_exposure: Option<f32>,
        compensate_highlight_preservation: bool,
    ) -> Result<Vec<u8>, JsValue> {
        super::ui_exposure::pack_ui_exposure_fixture(
            json,
            super::exposure::RawExposure {
                scene_referred,
                dng_baseline,
                highlight_preservation,
            },
            super::exposure::BaselineOptions {
                baseline_exposure,
                compensate_highlight_preservation,
            },
        )
        .map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen]
    pub fn pack_global_renderer_fixture(
        json: &str,
        temperature: f64,
        tint: f64,
        scene_referred: bool,
        dng_baseline: f32,
        highlight_preservation: f32,
        baseline_exposure: Option<f32>,
        compensate_highlight_preservation: bool,
        tonemapper_override: Option<u32>,
    ) -> Result<Vec<u8>, JsValue> {
        let value = super::renderer_adjustments::full_global_adjustments(
            json,
            &super::camera_as_shot::AsShot {
                white_balance: super::white_balance::WhiteBalance { temperature, tint },
                exposure: super::exposure::RawExposure {
                    scene_referred,
                    dng_baseline,
                    highlight_preservation,
                },
            },
            super::exposure::BaselineOptions {
                baseline_exposure,
                compensate_highlight_preservation,
            },
            tonemapper_override,
        )
        .map_err(|e| JsValue::from_str(&e))?;
        Ok(bytemuck::bytes_of(&value).to_vec())
    }

    #[wasm_bindgen]
    pub fn pack_camera_renderer_fixture(
        json: &str,
        temperature: f64,
        tint: f64,
        scene_referred: bool,
        dng_baseline: f32,
        highlight_preservation: f32,
        baseline_exposure: Option<f32>,
        compensate_highlight_preservation: bool,
    ) -> Result<Vec<u8>, JsValue> {
        let value = super::camera_renderer::camera_adjustments(
            json,
            &super::camera_as_shot::AsShot {
                white_balance: super::white_balance::WhiteBalance { temperature, tint },
                exposure: super::exposure::RawExposure {
                    scene_referred,
                    dng_baseline,
                    highlight_preservation,
                },
            },
            super::exposure::BaselineOptions {
                baseline_exposure,
                compensate_highlight_preservation,
            },
        )
        .map_err(|e| JsValue::from_str(&e))?;
        Ok(bytemuck::bytes_of(&value).to_vec())
    }

    #[wasm_bindgen]
    pub fn read_as_shot(bytes: &[u8]) -> Result<String, JsValue> {
        let shot = super::camera_as_shot::read_as_shot(bytes).map_err(|e| JsValue::from_str(&e))?;
        Ok(serde_json::json!({"whiteBalance":shot.white_balance,"exposure":{
            "sceneReferred":shot.exposure.scene_referred,"dngBaseline":shot.exposure.dng_baseline,
            "highlightPreservation":shot.exposure.highlight_preservation,
        }}).to_string())
    }

    #[wasm_bindgen]
    pub fn map_white_balance(json: &str, temperature: f64, tint: f64) -> Result<String, JsValue> {
        super::camera_as_shot::map_white_balance(
            json,
            super::white_balance::WhiteBalance { temperature, tint },
        )
        .map_err(|e| JsValue::from_str(&e))
    }

    /// Actual RAW camera exposure only. No WB/EXIF/location data is returned.
    #[wasm_bindgen]
    pub fn read_raw_exposure(bytes: &[u8]) -> Result<String, JsValue> {
        let exposure =
            super::camera_exposure::read_raw_exposure(bytes).map_err(|e| JsValue::from_str(&e))?;
        Ok(serde_json::json!({
            "sceneReferred": exposure.scene_referred,
            "dngBaseline": exposure.dng_baseline,
            "highlightPreservation": exposure.highlight_preservation,
        })
        .to_string())
    }

    #[wasm_bindgen]
    pub fn decode_sensor_report(bytes: &[u8]) -> Result<String, JsValue> {
        super::decode_sensor_report(bytes).map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen]
    pub fn preview_dimensions(
        width: u32,
        height: u32,
        preview_dim: u32,
    ) -> Result<JsValue, JsValue> {
        let (w, h) = super::preview_resize::preview_dimensions(width, height, preview_dim)
            .map_err(|e| JsValue::from_str(&e))?;
        let result = Object::new();
        Reflect::set(&result, &"width".into(), &JsValue::from_f64(w as f64))?;
        Reflect::set(&result, &"height".into(), &JsValue::from_f64(h as f64))?;
        Ok(result.into())
    }

    /// Original neutral-geometry preview dimensions and area downscale.
    #[wasm_bindgen]
    pub fn resize_preview_rgb32f(
        width: u32,
        height: u32,
        pixels: &[f32],
        preview_dim: u32,
    ) -> Result<JsValue, JsValue> {
        let resized = super::preview_resize::resize_preview(width, height, pixels, preview_dim)
            .map_err(|e| JsValue::from_str(&e))?;
        let result = Object::new();
        for (key, value) in [
            ("width", resized.width as f64),
            ("height", resized.height as f64),
            (
                "scaleForGpu",
                (resized.width as f64 / width as f64) as f32 as f64,
            ),
        ] {
            Reflect::set(&result, &key.into(), &JsValue::from_f64(value))?;
        }
        Reflect::set(
            &result,
            &"data".into(),
            Float32Array::from(resized.data.as_slice()).as_ref(),
        )?;
        Ok(result.into())
    }

    #[wasm_bindgen]
    pub fn resize_interactive_rgb32f(
        width: u32,
        height: u32,
        pixels: &[f32],
        preview_dim: u32,
        live_quality: &str,
    ) -> Result<JsValue, JsValue> {
        let result = super::interactive_preview::resize_interactive(
            width,
            height,
            pixels,
            preview_dim,
            live_quality,
        )
        .map_err(|e| JsValue::from_str(&e))?;
        let out = Object::new();
        for (key, value) in [
            ("width", result.pixels.width as f64),
            ("height", result.pixels.height as f64),
            ("quality", result.quality as f64),
            ("divisor", result.divisor as f64),
        ] {
            Reflect::set(&out, &key.into(), &JsValue::from_f64(value))?;
        }
        Reflect::set(
            &out,
            &"data".into(),
            Float32Array::from(result.pixels.data.as_slice()).as_ref(),
        )?;
        Ok(out.into())
    }

    #[wasm_bindgen]
    pub fn orient_preview_rgb32f(
        width: u32,
        height: u32,
        pixels: &[f32],
        steps: u32,
        horizontal: bool,
        vertical: bool,
    ) -> Result<JsValue, JsValue> {
        let result = super::preview_geometry::orient_preview(
            width, height, pixels, steps, horizontal, vertical,
        )
        .map_err(|e| JsValue::from_str(&e))?;
        let out = Object::new();
        Reflect::set(
            &out,
            &"width".into(),
            &JsValue::from_f64(result.width as f64),
        )?;
        Reflect::set(
            &out,
            &"height".into(),
            &JsValue::from_f64(result.height as f64),
        )?;
        Reflect::set(
            &out,
            &"data".into(),
            Float32Array::from(result.data.as_slice()).as_ref(),
        )?;
        Ok(out.into())
    }

    /// Develop an image with the pinned native RapidRAW float-pixel path.
    #[wasm_bindgen]
    pub fn develop_pixels(
        bytes: &[u8],
        fast_demosaic: bool,
        linear_mode: &str,
    ) -> Result<JsValue, JsValue> {
        let pixels = super::development::develop_pixels(bytes, fast_demosaic, linear_mode)
            .map_err(|e| JsValue::from_str(&e))?;
        let result = Object::new();
        Reflect::set(
            &result,
            &"width".into(),
            &JsValue::from_f64(pixels.width as f64),
        )?;
        Reflect::set(
            &result,
            &"height".into(),
            &JsValue::from_f64(pixels.height as f64),
        )?;
        Reflect::set(
            &result,
            &"components".into(),
            &JsValue::from_f64(pixels.components as f64),
        )?;
        let data = Float32Array::from(pixels.data.as_slice());
        Reflect::set(&result, &"data".into(), data.as_ref())?;
        Ok(result.into())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        MAX_SENSOR_BYTES, preflight_ifd, preflight_raf_dimensions, preflight_values,
        raw_image_after_preflight, selected_indices,
    };
    use rawler::analyze::FormatDump;
    use rawler::decoders::{Decoder, FormatHint, RawDecodeParams, RawMetadata, WellKnownIFD};
    use rawler::formats::tiff::{Entry, IFD, SampleFormat, Value};
    use rawler::tags::TiffCommonTag;
    use std::rc::Rc;
    use std::sync::atomic::{AtomicBool, Ordering};

    fn ifd(width: u32, height: u32, cpp: u16) -> IFD {
        let mut result = IFD::default();
        for (tag, value) in [
            (TiffCommonTag::ImageWidth, Value::Long(vec![width])),
            (TiffCommonTag::ImageLength, Value::Long(vec![height])),
            (TiffCommonTag::SamplesPerPixel, Value::Short(vec![cpp])),
        ] {
            result.entries.insert(
                tag.into(),
                Entry {
                    tag: tag.into(),
                    value,
                    embedded: None,
                },
            );
        }
        result
    }

    struct NoDecodeDecoder {
        ifd: IFD,
        raw_image_called: AtomicBool,
    }

    impl Decoder for NoDecodeDecoder {
        fn raw_image(
            &self,
            _file: &rawler::rawsource::RawSource,
            _params: &RawDecodeParams,
            _dummy: bool,
        ) -> rawler::Result<rawler::RawImage> {
            self.raw_image_called.store(true, Ordering::SeqCst);
            Err("raw_image must not be called for an oversized IFD".into())
        }

        fn raw_metadata(
            &self,
            _file: &rawler::rawsource::RawSource,
            _params: &RawDecodeParams,
        ) -> rawler::Result<RawMetadata> {
            Ok(RawMetadata::default())
        }

        fn format_dump(&self) -> FormatDump {
            panic!("format_dump is not part of preflight")
        }

        fn ifd(&self, wk_ifd: WellKnownIFD) -> rawler::Result<Option<Rc<IFD>>> {
            Ok((wk_ifd == WellKnownIFD::Raw).then(|| Rc::new(self.ifd.clone())))
        }

        fn format_hint(&self) -> FormatHint {
            FormatHint::Unknown
        }
    }

    #[test]
    fn selected_indices_are_stable_and_deduplicated_for_tiny_images() {
        assert_eq!(selected_indices(1), vec![0]);
        assert_eq!(selected_indices(4), vec![0, 1, 2, 3]);
        assert_eq!(selected_indices(100), vec![0, 25, 50, 75, 99]);
    }

    #[test]
    fn preflight_accepts_a_bounded_sensor_and_estimates_worst_case_storage() {
        let result = preflight_ifd(&ifd(2144, 1560, 1)).unwrap();
        assert_eq!(result.sample_count, 3_344_640);
        assert_eq!(result.decoded_bytes_per_sample, 2);
        assert_eq!(result.estimated_sensor_bytes, 6_689_280);
    }

    #[test]
    fn preflight_rejects_oversized_dimension_and_sample_count() {
        assert!(
            preflight_ifd(&ifd(32_769, 1, 1))
                .unwrap_err()
                .contains("dimensions")
        );
        assert!(
            preflight_ifd(&ifd(6_000, 6_000, 1))
                .unwrap_err()
                .contains("exceeds")
        );
    }

    #[test]
    fn oversized_ifd_is_refused_before_raw_image_is_called() {
        let decoder = NoDecodeDecoder {
            ifd: ifd(32_769, 1, 1),
            raw_image_called: AtomicBool::new(false),
        };
        let source = rawler::rawsource::RawSource::new_from_slice(b"synthetic");
        let err = raw_image_after_preflight(b"II*", &source, &decoder).unwrap_err();
        assert!(err.contains("dimensions"));
        assert!(!decoder.raw_image_called.load(Ordering::SeqCst));
    }

    #[test]
    fn preflight_uses_decoded_sample_storage_width() {
        let mut float_ifd = ifd(100, 100, 1);
        let tag = TiffCommonTag::SampleFormat;
        float_ifd.entries.insert(
            tag.into(),
            Entry {
                tag: tag.into(),
                value: Value::Short(vec![rawler::formats::tiff::SampleFormat::IEEEFP as u16]),
                embedded: None,
            },
        );
        let result = preflight_ifd(&float_ifd).unwrap();
        assert_eq!(result.decoded_bytes_per_sample, 4);
        assert_eq!(result.estimated_sensor_bytes, 40_000);
    }

    #[test]
    fn u16_raf_sensor_fits_the_sensor_buffer_budget() {
        let result = preflight_values(6384, 4182, 1, SampleFormat::Uint).unwrap();
        assert_eq!(result.sample_count, 26_697_888);
        assert_eq!(result.decoded_bytes_per_sample, 2);
        assert_eq!(result.estimated_sensor_bytes, 53_395_776);
        assert!(result.estimated_sensor_bytes <= MAX_SENSOR_BYTES);
    }

    #[test]
    fn preflight_rejects_missing_and_malformed_ifd_tags() {
        let empty = IFD::default();
        assert!(
            preflight_ifd(&empty)
                .unwrap_err()
                .contains("missing ImageWidth")
        );
        let mut malformed = ifd(1, 1, 1);
        malformed.entries.insert(
            TiffCommonTag::ImageWidth.into(),
            Entry {
                tag: TiffCommonTag::ImageWidth.into(),
                value: Value::Undefined(vec![1]),
                embedded: None,
            },
        );
        assert!(
            preflight_ifd(&malformed)
                .unwrap_err()
                .contains("Invalid ImageWidth")
        );
    }

    #[test]
    fn truncated_or_unrecognized_input_is_rejected_before_decode() {
        let source = rawler::rawsource::RawSource::new_from_slice(b"II*\0\x08\0\0\0");
        assert!(rawler::get_decoder(&source).is_err());
        assert!(
            preflight_raf_dimensions(b"FUJIFILM")
                .unwrap_err()
                .contains("truncated")
        );
    }

    #[test]
    fn malformed_tiff_directory_offset_is_rejected() {
        // Little-endian TIFF header whose first IFD points beyond the buffer.
        let source = rawler::rawsource::RawSource::new_from_slice(b"II*\0\xff\xff\xff\x7f");
        assert!(rawler::get_decoder(&source).is_err());
    }
}
