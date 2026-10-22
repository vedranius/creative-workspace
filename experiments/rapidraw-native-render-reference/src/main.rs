//! Independent compute-only reference for the original RapidRAW shader.
//! Exact source excerpts are AGPL-3.0; see UPSTREAM.json and the adjacent
//! rapidraw-wasm-core/tests/reference/RapidRAW-LICENSE. Neutral synthetic
//! resources are test fixtures, not original preprocessing or the full editor.
use bytemuck::{Pod, Zeroable};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::io::Write;
use wgpu::util::DeviceExt;
#[path = "../../rapidraw-wasm-core/tests/reference/png_encode.rs"]
mod native_png;

include!("original_adjustments.rs");
include!("original_upload.rs");
const MAX_MASK_BINDINGS: u32 = 1;
const WIDTH: u32 = 9;
const HEIGHT: u32 = 3;
const SHADER: &str = include_str!("../../rapidraw-wasm-core/shader.wgsl");

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CameraFrame {
    #[serde(default)]
    global: Option<GlobalAdjustments>,
    json: String,
    exposure: f32,
    gains: [f32; 3],
    rgb_to_lms: GpuMat3,
    lms_to_rgb: GpuMat3,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CameraSettings {
    #[serde(default)]
    full_global: bool,
    source: String,
    as_shot: serde_json::Value,
    options: serde_json::Value,
    frames: Vec<CameraFrame>,
}

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn texture(
    device: &wgpu::Device,
    queue: &wgpu::Queue,
    size: wgpu::Extent3d,
    dimension: wgpu::TextureDimension,
    format: wgpu::TextureFormat,
    data: &[u8],
) -> wgpu::Texture {
    device.create_texture_with_data(
        queue,
        &wgpu::TextureDescriptor {
            label: Some("Independent native neutral fixture"),
            size,
            mip_level_count: 1,
            sample_count: 1,
            dimension,
            format,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        },
        wgpu::util::TextureDataOrder::MipMajor,
        data,
    )
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    assert_eq!(
        hash(SHADER.as_bytes()),
        "9ecb4cc31b8ce4a12f439f69935ed0c8c27f58b52501929e0dc41d22e85ca178"
    );
    assert_eq!(std::mem::size_of::<AllAdjustments>(), 45232);
    let mut args: Vec<String> = std::env::args().collect();
    let camera: Option<CameraSettings> = if let Some(i) =
        args.iter().position(|v| v == "--camera-settings")
    {
        if i + 1 >= args.len() {
            return Err("Camera settings path required".into());
        }
        let p = args.remove(i + 1);
        args.remove(i);
        let bytes = std::fs::read(p)?;
        if bytes.len() > 65536 {
            return Err("Camera fixture exceeds64KiB".into());
        }
        let camera: CameraSettings = serde_json::from_slice(&bytes)?;
        let expected_frames = if args.iter().any(|v| v == "--export-codec-reference") { 1 } else { 5 };
        if camera.source != "b39884b38d8f148caef6fd0d52afd264951be329" || camera.frames.len() != expected_frames {
            return Err("Unexpected original camera fixture case count".into());
        }
        Some(camera)
    } else {
        None
    };
    let eight = if let Some(i) = args.iter().position(|v| v == "--eight-bit") {
        args.remove(i);
        true
    } else {
        false
    };
    let png_dir = if let Some(i) = args.iter().position(|v| v == "--png-dir") {
        if i + 1 >= args.len() {
            return Err("PNG directory required".into());
        }
        let p = args.remove(i + 1);
        args.remove(i);
        Some(std::path::PathBuf::from(p))
    } else {
        None
    };
    if png_dir.is_some() && !eight {
        return Err("Native PNG must use EightBit render output".into());
    }
    if let Some(p) = &png_dir {
        std::fs::create_dir_all(p)?;
    }
    let output_format = if eight {
        wgpu::TextureFormat::Rgba8Unorm
    } else {
        wgpu::TextureFormat::Rgba16Float
    };
    let pixel_bytes = if eight { 4 } else { 8 };
    let mut instance_desc = wgpu::InstanceDescriptor::new_without_display_handle();
    instance_desc.backends = wgpu::Backends::VULKAN;
    let instance = wgpu::Instance::new(instance_desc);
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        ..Default::default()
    }))?;
    let info = adapter.get_info();
    let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
        label: Some("Independent RapidRAW reference"),
        ..Default::default()
    }))?;
    let mut entries: Vec<wgpu::BindGroupLayoutEntry> = include!("original_bindings.rs");
    // Exact substitution used by the pinned native high-precision pipeline.
    entries[1].ty = wgpu::BindingType::StorageTexture {
        access: wgpu::StorageTextureAccess::WriteOnly,
        format: output_format,
        view_dimension: wgpu::TextureViewDimension::D2,
    };
    let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: None,
        entries: &entries,
    });
    let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: None,
        bind_group_layouts: &[Some(&bind_group_layout)],
        immediate_size: 0,
    });
    let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("Pinned original RapidRAW full shader"),
        source: wgpu::ShaderSource::Wgsl(
            (if eight {
                SHADER.to_string()
            } else {
                SHADER.replace("rgba8unorm, write>", "rgba16float, write>")
            })
            .into(),
        ),
    });
    let pipeline = if eight {
        include!("original_eight_bit_pipeline.rs")
    } else {
        include!("original_high_precision_pipeline.rs")
    };
    // Independent native-only full public-DNG reference for the post-render codec.
    // Browser preview budgets stay unchanged. One bounded3MP full-export frame.
    let export_codec_reference = if let Some(i) = args.iter().position(|v| v == "--export-codec-reference") {
        args.remove(i);
        if !eight || args.len() != 5 || camera.as_ref().is_none_or(|c| c.frames.len() != 1) {
            return Err("Export codec reference requires explicit input and one EightBit camera frame".into());
        }
        true
    } else { false };
    let texture_budget = if export_codec_reference { 256 * 1024 * 1024 } else { 64 * 1024 * 1024 };
    let (width, height, input_image, input_source, input_format) = if args.len() > 1 {
        if args.len() != 5 || !matches!(args[1].as_str(), "--rgb-f32" | "--rgba-f32") {
            return Err("Usage: reference [--rgb-f32 FILE WIDTH HEIGHT]".into());
        }
        let width: u32 = args[3].parse()?;
        let height: u32 = args[4].parse()?;
        let count = (width as usize)
            .checked_mul(height as usize)
            .ok_or("size overflow")?;
        let rgba = args[1] == "--rgba-f32";
        let bytes = count
            .checked_mul(if rgba { 16 } else { 12 })
            .ok_or("size overflow")?;
        if width == 0
            || height == 0
            || width > 32768
            || height > 32768
            || bytes > 64 * 1024 * 1024
            || count
                .checked_mul(76)
                .and_then(|v| v.checked_add(132))
                .is_none_or(|v| v > texture_budget)
            || (export_codec_reference && (width > 4096 || height > 4096 || count > 3 * 1024 * 1024))
        {
            return Err("bounded RGB input required".into());
        }
        if std::fs::metadata(&args[2])?.len() != bytes as u64 {
            return Err("RGB input size mismatch".into());
        }
        let raw = std::fs::read(&args[2])?;
        let rgb: Vec<f32> = raw
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes(b.try_into().unwrap()))
            .collect();
        if rgb.iter().any(|v| !v.is_finite() || v.abs() > 65504.) {
            return Err("invalid f16 input domain".into());
        }
        let image = if rgba {
            image::DynamicImage::ImageRgba32F(
                image::Rgba32FImage::from_raw(width, height, rgb.clone()).ok_or("RGBA shape")?,
            )
        } else {
            image::DynamicImage::ImageRgb32F(
                image::Rgb32FImage::from_raw(width, height, rgb.clone()).ok_or("RGB shape")?,
            )
        };
        (
            width,
            height,
            image,
            rgb,
            if rgba { "RGBA32F" } else { "RGB32F" },
        )
    } else {
        let input: Vec<f32> = (0..WIDTH * HEIGHT)
            .flat_map(|i| {
                [
                    (i + 1) as f32 / 128.,
                    (i + 2) as f32 / 128.,
                    (i + 3) as f32 / 128.,
                    1.,
                ]
            })
            .collect();
        (
            WIDTH,
            HEIGHT,
            image::DynamicImage::ImageRgba32F(
                image::Rgba32FImage::from_raw(WIDTH, HEIGHT, input.clone()).unwrap(),
            ),
            input,
            "RGBA32F",
        )
    };
    let size = wgpu::Extent3d {
        width,
        height,
        depth_or_array_layers: 1,
    };
    let input_f16 = to_rgba_f16(&input_image);
    let input_texture = texture(
        &device,
        &queue,
        size,
        wgpu::TextureDimension::D2,
        wgpu::TextureFormat::Rgba16Float,
        bytemuck::cast_slice(&input_f16),
    );
    let input_view = input_texture.create_view(&Default::default());
    let mask = texture(
        &device,
        &queue,
        size,
        wgpu::TextureDimension::D2,
        wgpu::TextureFormat::R32Float,
        bytemuck::cast_slice(&vec![0f32; (width * height) as usize]),
    );
    let mask_view = mask.create_view(&wgpu::TextureViewDescriptor {
        dimension: Some(wgpu::TextureViewDimension::D2Array),
        ..Default::default()
    });
    let mut lut_data = Vec::new();
    for z in 0..2 {
        for y in 0..2 {
            for x in 0..2 {
                lut_data.extend_from_slice(&[x as f32, y as f32, z as f32, 1.]);
            }
        }
    }
    let lut = texture(
        &device,
        &queue,
        wgpu::Extent3d {
            width: 2,
            height: 2,
            depth_or_array_layers: 2,
        },
        wgpu::TextureDimension::D3,
        wgpu::TextureFormat::Rgba32Float,
        bytemuck::cast_slice(&lut_data),
    );
    let lut_view = lut.create_view(&Default::default());
    let lut_sampler = device.create_sampler(&Default::default());
    let flare = texture(
        &device,
        &queue,
        wgpu::Extent3d {
            width: 1,
            height: 1,
            depth_or_array_layers: 1,
        },
        wgpu::TextureDimension::D2,
        wgpu::TextureFormat::Rgba8Unorm,
        &[0, 0, 0, 255],
    );
    let flare_view = flare.create_view(&Default::default());
    let flare_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
        mag_filter: wgpu::FilterMode::Linear,
        min_filter: wgpu::FilterMode::Linear,
        ..Default::default()
    });
    let gf_data: Vec<f32> = (0..width * height).flat_map(|_| [1., 0., 1., 0.]).collect();
    let gf = texture(
        &device,
        &queue,
        size,
        wgpu::TextureDimension::D2,
        wgpu::TextureFormat::Rgba32Float,
        bytemuck::cast_slice(&gf_data),
    );
    let gf_view = gf.create_view(&Default::default());
    let output = device.create_texture(&wgpu::TextureDescriptor {
        label: None,
        size,
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: output_format,
        usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC,
        view_formats: &[],
    });
    let output_view = output.create_view(&Default::default());
    let mut frames = Vec::new();
    let exposures: Vec<f32> = camera
        .as_ref()
        .map(|c| c.frames.iter().map(|f| f.exposure).collect())
        .unwrap_or_else(|| vec![-1., 0., 1.]);
    for (index, exposure) in exposures.into_iter().enumerate() {
        let mut adjustments = AllAdjustments::zeroed();
        let identity = GpuMat3::default();
        adjustments.global.exposure = exposure;
        adjustments.global.centre_x = 0.5;
        adjustments.global.centre_y = 0.5;
        adjustments.global.is_raw_image = 1;
        adjustments.global.vignette_center_x = 0.5;
        adjustments.global.vignette_center_y = 0.5;
        adjustments.global.color_grading_blending = 0.5;
        adjustments.global.agx_pipe_to_rendering_matrix = identity;
        adjustments.global.agx_rendering_to_pipe_matrix = identity;
        adjustments.global.wb_rgb_to_lms_matrix = identity;
        adjustments.global.wb_lms_to_rgb_matrix = identity;
        if let Some(camera) = &camera {
            let c = &camera.frames[index];
            adjustments.global.wb_log_gain_l = c.gains[0];
            adjustments.global.wb_log_gain_m = c.gains[1];
            adjustments.global.wb_log_gain_s = c.gains[2];
            adjustments.global.wb_rgb_to_lms_matrix = c.rgb_to_lms;
            adjustments.global.wb_lms_to_rgb_matrix = c.lms_to_rgb;
            if let Some(global) = c.global {
                adjustments.global = global;
            }
        }
        adjustments.mask_atlas_cols = 1;
        let adjustment_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: None,
            contents: bytemuck::bytes_of(&adjustments),
            usage: wgpu::BufferUsages::STORAGE,
        });
        let views = [
            (0, &input_view),
            (1, &output_view),
            (3, &mask_view),
            (4, &lut_view),
            (6, &input_view),
            (7, &input_view),
            (8, &input_view),
            (9, &input_view),
            (10, &flare_view),
            (12, &gf_view),
            (13, &gf_view),
        ];
        let mut bindings: Vec<_> = views
            .into_iter()
            .map(|(binding, view)| wgpu::BindGroupEntry {
                binding,
                resource: wgpu::BindingResource::TextureView(view),
            })
            .collect();
        bindings.extend([
            wgpu::BindGroupEntry {
                binding: 2,
                resource: adjustment_buffer.as_entire_binding(),
            },
            wgpu::BindGroupEntry {
                binding: 5,
                resource: wgpu::BindingResource::Sampler(&lut_sampler),
            },
            wgpu::BindGroupEntry {
                binding: 11,
                resource: wgpu::BindingResource::Sampler(&flare_sampler),
            },
        ]);
        let group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: None,
            layout: &bind_group_layout,
            entries: &bindings,
        });
        let padded_bpr = (width * pixel_bytes).div_ceil(256) * 256;
        let buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: u64::from(padded_bpr * height),
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });
        let mut encoder = device.create_command_encoder(&Default::default());
        {
            let mut pass = encoder.begin_compute_pass(&Default::default());
            pass.set_pipeline(&pipeline);
            pass.set_bind_group(0, &group, &[]);
            pass.dispatch_workgroups(width.div_ceil(8), height.div_ceil(8), 1);
        }
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture: &output,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: &buffer,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(padded_bpr),
                    rows_per_image: Some(height),
                },
            },
            size,
        );
        queue.submit(Some(encoder.finish()));
        let slice = buffer.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |r| {
            let _ = tx.send(r);
        });
        device.poll(wgpu::PollType::Wait {
            submission_index: None,
            // Full native software-GPU reference matches the bounded export job deadline.
            timeout: Some(std::time::Duration::from_secs(if export_codec_reference { 120 } else { 30 })),
        })?;
        rx.recv_timeout(std::time::Duration::from_secs(1))??;
        let mapped = slice.get_mapped_range();
        let mut pixels = Vec::new();
        for row in mapped.chunks(padded_bpr as usize).take(height as usize) {
            pixels.extend_from_slice(&row[..(width * pixel_bytes) as usize]);
        }
        let mut frame = json!({"exposure":exposure,"bytes":pixels.len(),"sha256":hash(&pixels),"adjustmentSha256":hash(bytemuck::bytes_of(&adjustments))});
        if eight {
            frame["rgbaU8"] = json!(&pixels);
            if let Some(dir) = &png_dir {
                let image = image::DynamicImage::ImageRgba8(
                    image::RgbaImage::from_raw(width, height, pixels.clone())
                        .ok_or("invalid image")?,
                );
                let png = native_png::encode(&image, Some(300))?;
                let name = format!("frame-{index}.png");
                let mut file = std::fs::OpenOptions::new()
                    .create_new(true)
                    .write(true)
                    .open(dir.join(&name))?;
                file.write_all(&png)?;
                frame["png"] = json!({"filename":name,"sha256":hash(&png),"bytes":png.len(),"bitDepth":8,"colorType":6,"dpi":300});
            }
        } else {
            let words: Vec<u16> = pixels
                .chunks_exact(2)
                .map(|b| u16::from_le_bytes([b[0], b[1]]))
                .collect();
            assert!(words.iter().all(|v| v & 0x7c00 != 0x7c00));
            frame["rgbaF16Bits"] = json!(words);
        }
        frames.push(frame);
        drop(mapped);
        buffer.unmap();
    }
    println!(
        "{}",
        json!({"source":"b39884b38d8f148caef6fd0d52afd264951be329","highPrecisionOutput":if eight{0}else{1},"format":if eight{"rgba8unorm"}else{"rgba16float"},"shaderSha256":hash(SHADER.as_bytes()),"scope":"Independent native wgpu29 full original shader on neutral synthetic resources; not full native engine/preprocessing", "adapter":{"name":info.name,"driver":info.driver,"driverInfo":info.driver_info,"backend":format!("{:?}",info.backend),"deviceType":format!("{:?}",info.device_type)},"width":width,"height":height,"inputFormat":input_format,"inputF32Sha256":hash(bytemuck::cast_slice(&input_source)),"inputRgbaF16Sha256":hash(bytemuck::cast_slice(&input_f16)),"frames":frames,"camera":camera})
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn original_source_excerpts_and_shader_match_recorded_pin() {
        let upstream: serde_json::Value =
            serde_json::from_str(include_str!("../UPSTREAM.json")).unwrap();
        for (name, bytes) in [
            (
                "src/original_adjustments.rs",
                include_bytes!("original_adjustments.rs").as_slice(),
            ),
            (
                "src/original_bindings.rs",
                include_bytes!("original_bindings.rs").as_slice(),
            ),
            (
                "src/original_high_precision_pipeline.rs",
                include_bytes!("original_high_precision_pipeline.rs").as_slice(),
            ),
            (
                "src/original_upload.rs",
                include_bytes!("original_upload.rs").as_slice(),
            ),
            (
                "src/original_eight_bit_pipeline.rs",
                include_bytes!("original_eight_bit_pipeline.rs").as_slice(),
            ),
            ("../rapidraw-wasm-core/shader.wgsl", SHADER.as_bytes()),
        ] {
            assert_eq!(
                hash(bytes),
                upstream["files"][name]["sha256"].as_str().unwrap()
            );
        }
        assert_eq!(std::mem::size_of::<AllAdjustments>(), 45232);
    }
}
