//! Experimental pinned RapidRAW decoder probe, not an accepted browser editor.
//! Shared decode/report logic is native and WASM; only the browser error adapter
//! depends on wasm-bindgen.
use rawler::{decoders::RawDecodeParams, rawimage::RawImageData, rawsource::RawSource};
use sha2::{Digest, Sha256};

const MAX_INPUT_BYTES: usize = 128 * 1024 * 1024;

/// Decode with the pinned rawler and return dimensions, selected sensor samples,
/// and a SHA-256 over every decoded sensor value in a canonical little-endian form.
/// The input bound does not bound allocations made by the decoder.
pub fn decode_sensor_report(bytes: &[u8]) -> Result<String, String> {
    if bytes.is_empty() || bytes.len() > MAX_INPUT_BYTES {
        return Err("RAW input must be between 1 byte and 128 MiB for this probe".into());
    }
    let source = RawSource::new_from_slice(bytes);
    let decoder = rawler::get_decoder(&source).map_err(|e| e.to_string())?;
    let raw = decoder
        .raw_image(&source, &RawDecodeParams::default(), false)
        .map_err(|e| e.to_string())?;
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
    use super::selected_indices;

    #[test]
    fn selected_indices_are_stable_and_deduplicated_for_tiny_images() {
        assert_eq!(selected_indices(1), vec![0]);
        assert_eq!(selected_indices(4), vec![0, 1, 2, 3]);
        assert_eq!(selected_indices(100), vec![0, 25, 50, 75, 99]);
    }
}
