//! Experimental compile seam, not an accepted browser editor or RAW pipeline.
//! Uses exactly the rawler source pinned by native RapidRAW b39884b.
use wasm_bindgen::prelude::*;
use rawler::{decoders::RawDecodeParams, rawsource::RawSource};

#[wasm_bindgen]
pub fn decode_sensor_sample_count(bytes: &[u8]) -> Result<usize, JsValue> {
    if bytes.is_empty() || bytes.len() > 128 * 1024 * 1024 {
        return Err(JsValue::from_str("RAW input must be between 1 byte and 128 MiB for this probe"));
    }
    let source = RawSource::new_from_slice(bytes);
    let decoder = rawler::get_decoder(&source).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let raw = decoder.raw_image(&source, &RawDecodeParams::default(), false)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    raw.width.checked_mul(raw.height).and_then(|n| n.checked_mul(raw.cpp))
        .ok_or_else(|| JsValue::from_str("RAW dimensions overflow"))
}
