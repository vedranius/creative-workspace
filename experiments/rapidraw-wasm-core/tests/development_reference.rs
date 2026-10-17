use sha2::{Digest, Sha256};

fn source_hash(source: &str) -> String {
    Sha256::digest(source.as_bytes())
        .iter()
        .map(|value| format!("{value:02x}"))
        .collect()
}

#[test]
fn original_native_development_sources_are_byte_identical_to_the_pin() {
    assert_eq!(
        source_hash(include_str!("reference/raw_processing.rs")),
        "806f84653c1bf9e4e4d2285be903a0faaa6fd8adb89d2414fee5b3a3f9daacec"
    );
    assert_eq!(
        source_hash(include_str!("reference/multi_exposure.rs")),
        "a613d33be1a2f40db28f8a33bf87e67c0748007914328214ce67602a28ef4901"
    );
    assert_eq!(
        include_str!("../src/multi_exposure.rs"),
        include_str!("reference/multi_exposure.rs")
    );
}

#[test]
fn extracted_clipped_pixel_recovery_matches_original_source() {
    let source = include_str!("reference/raw_processing.rs");
    let start = source.find("#[inline]\nfn srgb_to_linear").unwrap();
    let end = source.find("\nfn develop_internal(").unwrap();
    let extracted = include_str!("../src/development.rs");
    let extracted_start = extracted.find("#[inline]\nfn srgb_to_linear").unwrap();
    let extracted_end = extracted[extracted_start..]
        .find("\n#[cfg(test)]")
        .map(|offset| extracted_start + offset)
        .unwrap();
    assert_eq!(
        &extracted[extracted_start..extracted_end],
        &source[start..end]
    );
}
