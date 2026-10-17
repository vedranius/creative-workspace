use std::{env, fs};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = env::args()
        .nth(1)
        .ok_or("usage: native-reference <raw-file>")?;
    let bytes = fs::read(path)?;
    let report = cw_rapidraw_wasm_probe::decode_sensor_report(&bytes)?;
    println!("{report}");
    Ok(())
}
