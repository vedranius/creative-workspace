//! Experimental pinned RapidRAW decoder probe, not an accepted browser editor.
//! Shared decode/report logic is native and WASM; only the browser error adapter
//! depends on wasm-bindgen.
use rawler::{
    decoders::{Decoder, RawDecodeParams, WellKnownIFD},
    formats::tiff::IFD,
    rawimage::RawImageData,
    rawsource::RawSource,
    tags::TiffCommonTag,
};
use sha2::{Digest, Sha256};

const MAX_INPUT_BYTES: usize = 128 * 1024 * 1024;
const MAX_SENSOR_DIMENSION: usize = 32_768;
const MAX_SENSOR_BYTES: usize = 64 * 1024 * 1024;
const MAX_BYTES_PER_SAMPLE: usize = 4;
const MAX_SENSOR_SAMPLES: usize = MAX_SENSOR_BYTES / MAX_BYTES_PER_SAMPLE;

/// Metadata checked before asking rawler to allocate/decompress sensor pixels.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SensorPreflight {
    pub width: usize,
    pub height: usize,
    pub cpp: usize,
    pub sample_count: usize,
    /// Conservative sensor buffer estimate at four bytes per sample.
    pub estimated_sensor_bytes: usize,
}

/// Inspect dimensions from rawler's Raw IFD without decoding image pixels.
/// Decoders without this metadata path are refused before `raw_image()`.
pub fn preflight_sensor_bytes(bytes: &[u8]) -> Result<SensorPreflight, String> {
    check_input_size(bytes)?;
    let source = RawSource::new_from_slice(bytes);
    let decoder = rawler::get_decoder(&source).map_err(|e| e.to_string())?;
    preflight_decoder(decoder.as_ref())
}

fn check_input_size(bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() || bytes.len() > MAX_INPUT_BYTES {
        return Err("RAW input must be between 1 byte and 128 MiB for this probe".into());
    }
    Ok(())
}

fn preflight_decoder(decoder: &dyn Decoder) -> Result<SensorPreflight, String> {
    let ifd = decoder
        .ifd(WellKnownIFD::Raw)
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
    if sample_count > MAX_SENSOR_SAMPLES {
        return Err(format!(
            "RAW sensor buffer estimate exceeds {} MiB",
            MAX_SENSOR_BYTES / (1024 * 1024)
        ));
    }
    let estimated_sensor_bytes = sample_count
        .checked_mul(MAX_BYTES_PER_SAMPLE)
        .ok_or_else(|| "RAW sensor byte estimate overflows".to_string())?;
    Ok(SensorPreflight {
        width,
        height,
        cpp,
        sample_count,
        estimated_sensor_bytes,
    })
}

/// Decode with the pinned rawler and return dimensions, selected sensor samples,
/// and a SHA-256 over every decoded sensor value in a canonical little-endian form.
/// The preflight bounds the estimated sensor buffer, not all decoder intermediates.
pub fn decode_sensor_report(bytes: &[u8]) -> Result<String, String> {
    check_input_size(bytes)?;
    let source = RawSource::new_from_slice(bytes);
    let decoder = rawler::get_decoder(&source).map_err(|e| e.to_string())?;
    let preflight = preflight_decoder(decoder.as_ref())?;
    let raw = decoder
        .raw_image(&source, &RawDecodeParams::default(), false)
        .map_err(|e| e.to_string())?;
    if raw.width != preflight.width || raw.height != preflight.height || raw.cpp != preflight.cpp {
        return Err("Decoded dimensions differ from the raw IFD preflight".into());
    }
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
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub fn decode_sensor_report(bytes: &[u8]) -> Result<String, JsValue> {
        super::decode_sensor_report(bytes).map_err(|e| JsValue::from_str(&e))
    }
}

#[cfg(test)]
mod tests {
    use super::{MAX_SENSOR_SAMPLES, preflight_ifd, selected_indices};
    use rawler::formats::tiff::{Entry, IFD, Value};
    use rawler::tags::TiffCommonTag;

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
        assert_eq!(result.estimated_sensor_bytes, 13_378_560);
    }

    #[test]
    fn preflight_rejects_oversized_dimension_and_sample_count() {
        assert!(
            preflight_ifd(&ifd(32_769, 1, 1))
                .unwrap_err()
                .contains("dimensions")
        );
        let width = 4096;
        let height = (MAX_SENSOR_SAMPLES / width + 1) as u32;
        assert!(
            preflight_ifd(&ifd(width as u32, height, 1))
                .unwrap_err()
                .contains("exceeds")
        );
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
    }
}
