use sha2::{Digest, Sha256};

#[test]
fn original_camera_reader_and_dummy_monochrome_rule_are_pinned() {
    let reference = include_str!("reference/baseline_exposure.rs");
    let start = reference.find("pub fn read(decoder:").unwrap();
    let reader = &reference[start..];
    assert!(include_str!("../src/camera_exposure.rs").contains(reader));
    let metadata = include_str!("../UPSTREAM.json");
    assert!(metadata.contains(&format!("{:x}", Sha256::digest(reader.as_bytes()))));
    assert!(metadata.contains(&format!("{:x}", Sha256::digest(reference.as_bytes()))));
    let original = include_str!("reference/raw_processing.rs");
    let rule = "let is_monochrome = raw_image.cpp == 1\n        && !matches!(raw_image.photometric, RawPhotometricInterpretation::Cfa(_));";
    assert!(original.contains(rule));
    assert!(include_str!("../src/camera_exposure.rs").contains(rule));
}

#[test]
fn empty_metadata_input_is_rejected_by_raw_preflight() {
    assert!(cw_rapidraw_wasm_probe::camera_exposure::read_raw_exposure(&[]).is_err());
}
