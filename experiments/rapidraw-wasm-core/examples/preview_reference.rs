//! Independent pinned preview codec. Input is a real native rendered PNG.
#[path = "../tests/reference/preview.rs"]
mod native_preview;
use sha2::{Digest, Sha256};
use std::{io::Write, path::PathBuf};
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn write(path: PathBuf, data: &[u8]) {
    let mut f = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .unwrap();
    f.write_all(data).unwrap();
    f.flush().unwrap();
}
fn main() {
    let args: Vec<_> = std::env::args().collect();
    assert_eq!(args.len(), 3, "NATIVE_PNG NEW_OUTPUT_DIR");
    let source = std::fs::read(&args[1]).unwrap();
    let image = image::load_from_memory(&source).unwrap().into_rgba8();
    assert_eq!(
        image.dimensions(),
        (512, 384),
        "Bounded public Speed reference only"
    );
    let out = PathBuf::from(&args[2]);
    std::fs::create_dir_all(&out).unwrap();
    let mut cases = Vec::new();
    for (i, (quality, rect)) in [
        (94, None),
        (75, Some((0, 0, 512, 384))),
        (85, Some((16, 20, 211, 139))),
        (65, Some((17, 9, 101, 77))),
    ]
    .into_iter()
    .enumerate()
    {
        let (x, y, w, h) = rect.unwrap_or((0, 0, 512, 384));
        let pixels = image::imageops::crop_imm(&image, x, y, w, h).to_image();
        let response = native_preview::encode(&pixels, quality, rect.map(|_| (x, y, 512, 384)));
        let input = format!("frame-{i}.rgba");
        let output = format!("frame-{i}.response");
        write(out.join(&input), pixels.as_raw());
        write(out.join(&output), &response);
        cases.push(
            serde_json::json!({"width":w,"height":h,"x":x,"y":y,"fullWidth":512,"fullHeight":384,
            "interactive":rect.is_some(),"quality":quality,"input":input,"output":output,
            "rgbaSha256":hash(pixels.as_raw()),"bytes":response.len(),"sha256":hash(&response)}),
        );
    }
    let result = serde_json::json!({"schemaVersion":1,"source":"b39884b38d8f148caef6fd0d52afd264951be329",
        "nativeRenderedPngSha256":hash(&source),"cases":cases});
    write(
        out.join("reference.json"),
        serde_json::to_string_pretty(&result).unwrap().as_bytes(),
    );
    println!("{}", result);
}
