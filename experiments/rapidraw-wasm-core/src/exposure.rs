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

/// Apply RapidRAW's native exposure helper to interleaved linear RGB pixels.
/// The pinned helper computes `gain = exposure.exp2()` once and multiplies
/// every color channel by that gain; this boundary rejects invalid host input.
pub fn apply_rgb_exposure(pixels: &[f32], exposure: f32) -> Result<Vec<f32>, String> {
    const MAX_PIXEL_BYTES: usize = 64 * 1024 * 1024;
    if !exposure.is_finite() {
        return Err("Exposure must be finite".into());
    }
    if pixels.len() % 3 != 0 || pixels.len() * std::mem::size_of::<f32>() > MAX_PIXEL_BYTES {
        return Err("Expected a bounded interleaved RGB float buffer".into());
    }
    if pixels.iter().any(|value| !value.is_finite()) {
        return Err("RGB pixels must be finite".into());
    }
    if exposure == 0.0 {
        return Ok(pixels.to_vec());
    }
    let gain = exposure.exp2();
    if !gain.is_finite() {
        return Err("Exposure gain overflows".into());
    }
    let result = pixels.iter().map(|value| value * gain).collect::<Vec<_>>();
    if result.iter().any(|value| !value.is_finite()) {
        return Err("Exposed RGB pixels overflow".into());
    }
    Ok(result)
}
