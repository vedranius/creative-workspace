// Execute the original pinned native formula to produce the browser's reference
// matrix. This does not use the extracted implementation to generate expected values.
#[allow(dead_code)]
mod app_settings {
    pub struct AppSettings {
        pub enable_baseline_exposure: bool,
        pub baseline_exposure: f32,
        pub compensate_highlight_preservation: bool,
    }
}
#[path = "../tests/reference/baseline_exposure.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native;

fn main() {
    let mut rows = Vec::new();
    for scene in [false, true] {
        for dng in [-1.25_f32, 0.0, 0.75] {
            for highlight in [-1.0_f32, 0.0, 2.5] {
                for baseline in [None, Some(-0.5_f32), Some(0.0), Some(1.0)] {
                    for compensate in [false, true] {
                        let expected = native::RawExposure {
                            scene_referred: scene,
                            dng_baseline: dng,
                            highlight_preservation: highlight,
                        }
                        .compensation(native::BaselineOptions {
                            baseline_exposure: baseline,
                            compensate_highlight_preservation: compensate,
                        });
                        let baseline_json = baseline.map_or("null".into(), |v| v.to_string());
                        rows.push(format!("{{\"scene\":{scene},\"dng\":{dng},\"highlight\":{highlight},\"baseline\":{baseline_json},\"compensate\":{compensate},\"expected\":{expected},\"expectedBits\":{}}}", expected.to_bits()));
                    }
                }
            }
        }
    }
    println!("[{}]", rows.join(","));
}
