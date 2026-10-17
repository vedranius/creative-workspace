pub fn insert_png_chunk(image_bytes: &mut Vec<u8>, chunk_type: &[u8; 4], data: &[u8]) {
    const IHDR_END: usize = 33;

    if image_bytes.len() < IHDR_END || &image_bytes[12..16] != b"IHDR" {
        return;
    }

    let mut crc = crc32fast::Hasher::new();
    crc.update(chunk_type);
    crc.update(data);

    let mut chunk = Vec::with_capacity(data.len() + 12);
    chunk.extend_from_slice(&(data.len() as u32).to_be_bytes());
    chunk.extend_from_slice(chunk_type);
    chunk.extend_from_slice(data);
    chunk.extend_from_slice(&crc.finalize().to_be_bytes());
    image_bytes.splice(IHDR_END..IHDR_END, chunk);
}
