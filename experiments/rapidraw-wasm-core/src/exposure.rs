//! Host-independent extraction from native RapidRAW b39884b.
//! Original source by Timon Käch/CyberTimon, AGPL-3.0-only.
//! Formula and types below are unchanged; settings/metadata stay in the host.

#[derive(Clone, Copy, Debug, Default)]
pub struct RawExposure {
    pub scene_referred: bool,
    pub dng_baseline: f32,
    pub highlight_preservation: f32,
}

impl RawExposure {
    pub fn compensation(&self, options: BaselineOptions) -> f32 {
        let baseline = options.baseline_exposure.map_or(0.0, |amount| {
            let scene_referred = if self.scene_referred { amount } else { 0.0 };
            scene_referred + self.dng_baseline
        });
        let highlight_preservation = if options.compensate_highlight_preservation {
            self.highlight_preservation
        } else {
            0.0
        };
        baseline + highlight_preservation
    }
}

#[derive(Clone, Copy, Debug, Default)]
pub struct BaselineOptions {
    pub baseline_exposure: Option<f32>,
    pub compensate_highlight_preservation: bool,
}
