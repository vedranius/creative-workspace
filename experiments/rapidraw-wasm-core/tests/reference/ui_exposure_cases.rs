use serde_json::{Value, json};
pub fn cases() -> Vec<(Value, bool, f32, f32, Option<f32>, bool)> {
    let inputs = vec![
        Value::Null,
        json!({}),
        json!({"exposure":0.8}),
        json!({"exposure":-1.6,"baselineExposure":true}),
        json!({"exposure":0.04,"baselineExposure":true}),
        json!({"exposure":3.2,"baselineExposure":false}),
        json!({"exposure":3.2,"activeTools":{"basic":false},"baselineExposure":true}),
        json!({"exposure":3.2,"sectionVisibility":{"basic":false},"baselineExposure":true}),
        json!({"exposure":3.2,"activeTools":{"basic":true},"sectionVisibility":{"basic":false}}),
        json!({"exposure":0.8,"activeTools":null,"sectionVisibility":{"basic":false}}),
        json!({"exposure":0.8,"activeTools":{"basic":"false"}}),
        json!({"exposure":0.8,"activeTools":{},"sectionVisibility":{"basic":false}}),
        json!({"exposure":0.8,"sectionVisibility":{"basic":"false"}}),
        json!({"exposure":"0.8","baselineExposure":true}),
        json!({"exposure":false}),
        json!({"basic":{"exposure":100}}),
        json!({"exposure":0.8,"baselineExposure":"true"}),
        json!({"exposure":-0.0,"baselineExposure":true}),
    ];
    let mut result = Vec::new();
    for input in inputs {
        for (scene, dng, highlight) in [(true, 0.75, -1.0), (false, -0.5, 2.0), (true, 0.0, 0.0)] {
            for (baseline, compensate) in [
                (None, false),
                (None, true),
                (Some(1.0), false),
                (Some(-0.5), true),
            ] {
                result.push((input.clone(), scene, dng, highlight, baseline, compensate));
            }
        }
    }
    result
}
