use cw_rapidraw_wasm_probe::development::develop_pixels;
use sha2::{Digest, Sha256};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args()
        .nth(1)
        .ok_or("usage: develop_probe RAW_FILE")?;
    let fast_demosaic = std::env::args().nth(2).as_deref() == Some("fast");
    let bytes = std::fs::read(path)?;
    let image = develop_pixels(&bytes, fast_demosaic, "default")?;
    let mut hash = Sha256::new();
    for value in &image.data {
        hash.update(value.to_bits().to_le_bytes());
    }
    let digest = hash
        .finalize()
        .iter()
        .map(|v| format!("{v:02x}"))
        .collect::<String>();
    println!(
        "{{\"width\":{},\"height\":{},\"components\":{},\"pixelCount\":{},\"fastDemosaic\":{},\"componentF32BitsSha256\":\"{}\"}}",
        image.width,
        image.height,
        image.components,
        image.width as u64 * image.height as u64,
        fast_demosaic,
        digest
    );
    Ok(())
}
