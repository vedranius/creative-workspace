use std::{env, fs};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = env::args().nth(1).ok_or("usage: preflight <raw-file>")?;
    let bytes = fs::read(path)?;
    let result = cw_rapidraw_wasm_probe::preflight_sensor_bytes(&bytes)?;
    println!(
        "{{\"width\":{},\"height\":{},\"cpp\":{},\"sampleCount\":{},\"estimatedSensorBytes\":{}}}",
        result.width, result.height, result.cpp, result.sample_count, result.estimated_sensor_bytes
    );
    Ok(())
}
