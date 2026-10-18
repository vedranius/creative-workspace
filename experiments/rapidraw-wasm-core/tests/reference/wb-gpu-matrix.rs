fn mat3_to_gpu_mat3(m: Mat3) -> GpuMat3 {
    GpuMat3 {
        col0: [m.x_axis.x, m.x_axis.y, m.x_axis.z, 0.0],
        col1: [m.y_axis.x, m.y_axis.y, m.y_axis.z, 0.0],
        col2: [m.z_axis.x, m.z_axis.y, m.z_axis.z, 0.0],
    }
}
