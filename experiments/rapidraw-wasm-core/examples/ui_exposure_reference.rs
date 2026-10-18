#[allow(dead_code)]
mod app_settings {
    pub struct AppSettings {
        pub enable_baseline_exposure: bool,
        pub baseline_exposure: f32,
        pub compensate_highlight_preservation: bool,
    }
}
#[path="../tests/reference/ui_exposure.rs"]
#[allow(dead_code)]
#[rustfmt::skip]
mod native;
#[path = "../tests/reference/ui_exposure_cases.rs"]
mod fixtures;
fn main() {
    let cases=fixtures::cases().into_iter().map(|(input,scene,dng,highlight,baseline,compensate)|{
        let value=native::reference_exposure(&input,native::RawExposure{scene_referred:scene,dng_baseline:dng,highlight_preservation:highlight},native::BaselineOptions{baseline_exposure:baseline,compensate_highlight_preservation:compensate});
        serde_json::json!({"json":input.to_string(),"sceneReferred":scene,"dngBaseline":dng,"highlightPreservation":highlight,"baselineExposure":baseline,"compensateHighlightPreservation":compensate,"expectedExposureBits":value.to_bits()})
    }).collect::<Vec<_>>();
    println!("{}", serde_json::json!({"cases":cases}));
}
